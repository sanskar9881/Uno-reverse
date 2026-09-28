import {
  HAND_SIZE,
  MIN_PLAYERS,
  UNO_PENALTY_CARDS,
  canPlayCard,
  cardPoints,
  isNumberCard,
  type Card,
  type CardColor,
  type DrawReason,
  type GameEvent,
} from '@shared';
import { createDeck, secureRng, shuffle, type Rng } from './deck';
import { GameError } from './errors';

/**
 * Complete state of one round. Plain JSON (arrays/records only) so it can be
 * serialized to Redis or a database later without changes.
 */
export interface GameState {
  /** Player ids in seat order. Direction 1 = increasing index (clockwise on screen). */
  players: string[];
  hands: Record<string, Card[]>;
  /** Top of the pile is the LAST element. */
  drawPile: Card[];
  /** Top card is the LAST element. */
  discardPile: Card[];
  currentIndex: number;
  direction: 1 | -1;
  currentColor: CardColor;
  /** Increments every time the turn moves. Clients must echo it to prevent stale/duplicate actions. */
  turnId: number;
  hasDrawn: boolean;
  drawnCardId: string | null;
  unoDeclared: string[];
  /** Players who called UNO at two cards, before playing down to one. */
  unoPrimed: string[];
  unoVulnerableId: string | null;
  finished: boolean;
  winnerId: string | null;
  forfeit: boolean;
}

export interface CreateGameOptions {
  /** Pre-ordered deck (last element is drawn first). Used by tests; production shuffles a fresh deck. */
  deck?: Card[];
  startIndex?: number;
}

export interface PlayInput {
  cardId: string;
  chosenColor?: CardColor;
  turnId: number;
}

export interface RoundTally {
  points: number;
  pointsByPlayer: Record<string, number>;
  cardsLeft: Record<string, number>;
}

const mod = (n: number, m: number): number => ((n % m) + m) % m;
const removeFrom = (list: string[], id: string): void => {
  const i = list.indexOf(id);
  if (i !== -1) list.splice(i, 1);
};

export class GameEngine {
  constructor(private readonly rng: Rng = secureRng) {}

  createGame(playerIds: string[], options: CreateGameOptions = {}): { state: GameState; events: GameEvent[] } {
    if (playerIds.length < MIN_PLAYERS) {
      throw new GameError('NOT_ENOUGH_PLAYERS', `At least ${MIN_PLAYERS} players are needed to start.`);
    }
    const drawPile = options.deck ? [...options.deck] : shuffle(createDeck(), this.rng);
    const hands: Record<string, Card[]> = {};
    for (const id of playerIds) hands[id] = [];

    for (let round = 0; round < HAND_SIZE; round++) {
      for (const id of playerIds) {
        const card = drawPile.pop();
        if (!card) throw new GameError('INTERNAL', 'The deck ran out while dealing.');
        hands[id].push(card);
      }
    }

    // Flip until we hit a number card; action/wild cards go back under the pile.
    const setAside: Card[] = [];
    let start: Card | undefined;
    while (drawPile.length > 0) {
      const card = drawPile.pop()!;
      if (isNumberCard(card)) {
        start = card;
        break;
      }
      setAside.push(card);
    }
    if (!start) throw new GameError('INTERNAL', 'No number card available to start the round.');
    drawPile.unshift(...setAside);

    const state: GameState = {
      players: [...playerIds],
      hands,
      drawPile,
      discardPile: [start],
      currentIndex: mod(options.startIndex ?? 0, playerIds.length),
      direction: 1,
      currentColor: start.color as CardColor,
      turnId: 1,
      hasDrawn: false,
      drawnCardId: null,
      unoDeclared: [],
      unoPrimed: [],
      unoVulnerableId: null,
      finished: false,
      winnerId: null,
      forfeit: false,
    };
    return { state, events: [{ type: 'turnChanged', playerId: this.currentPlayerId(state) }] };
  }

  currentPlayerId(state: GameState): string {
    return state.players[state.currentIndex];
  }

  topCard(state: GameState): Card {
    return state.discardPile[state.discardPile.length - 1];
  }

  hasPlayableCard(state: GameState, playerId: string): boolean {
    const hand = state.hands[playerId] ?? [];
    const top = this.topCard(state);
    return hand.some(
      (card) =>
        (!state.hasDrawn || card.id === state.drawnCardId) && canPlayCard(card, top, state.currentColor, hand),
    );
  }

  // ------------------------------------------------------------------ actions

  play(state: GameState, playerId: string, input: PlayInput): GameEvent[] {
    this.assertTurn(state, playerId, input.turnId);
    const hand = state.hands[playerId];
    const index = hand.findIndex((c) => c.id === input.cardId);
    if (index === -1) throw new GameError('CARD_NOT_IN_HAND', "You don't have that card.");
    const card = hand[index];

    if (state.hasDrawn && state.drawnCardId !== card.id) {
      throw new GameError('MUST_PLAY_DRAWN_CARD', 'After drawing you can only play the card you drew, or pass.');
    }
    if (!canPlayCard(card, this.topCard(state), state.currentColor, hand)) {
      if (card.value === 'wild4') {
        throw new GameError('INVALID_PLAY', `Wild +4 is only allowed when you have no ${state.currentColor} cards.`);
      }
      throw new GameError('INVALID_PLAY', "That card doesn't match the color or symbol.");
    }
    if (card.color === 'wild' && !input.chosenColor) {
      throw new GameError('COLOR_REQUIRED', 'Choose a color for your wild card.');
    }

    const events: GameEvent[] = [];
    this.closeUnoWindow(state, playerId);

    hand.splice(index, 1);
    state.discardPile.push(card);
    const chosenColor = card.color === 'wild' ? input.chosenColor! : null;
    state.currentColor = chosenColor ?? (card.color as CardColor);
    events.push({ type: 'cardPlayed', playerId, card, chosenColor });

    // UNO bookkeeping: reaching one card without having called UNO makes you catchable.
    if (hand.length === 1) {
      if (state.unoPrimed.includes(playerId)) {
        if (!state.unoDeclared.includes(playerId)) state.unoDeclared.push(playerId);
      } else {
        state.unoVulnerableId = playerId;
      }
    }
    removeFrom(state.unoPrimed, playerId);

    if (hand.length === 0) {
      removeFrom(state.unoDeclared, playerId);
      // Official rule: a final +2/+4 still makes the next player draw (it counts toward points).
      if (card.value === 'draw2' || card.value === 'wild4') {
        const victim = this.playerAt(state, 1);
        events.push(...this.giveCards(state, victim, card.value === 'draw2' ? 2 : 4, card.value));
      }
      state.finished = true;
      state.winnerId = playerId;
      state.unoVulnerableId = null;
      return events;
    }

    const playerCount = state.players.length;
    switch (card.value) {
      case 'skip': {
        events.push({ type: 'skipped', playerId: this.playerAt(state, 1) });
        this.advance(state, 2);
        break;
      }
      case 'reverse': {
        state.direction = state.direction === 1 ? -1 : 1;
        events.push({ type: 'reversed', direction: state.direction });
        if (playerCount === 2) {
          // With two players Reverse acts like Skip.
          events.push({ type: 'skipped', playerId: this.playerAt(state, 1) });
          this.advance(state, 2);
        } else {
          this.advance(state, 1);
        }
        break;
      }
      case 'draw2':
      case 'wild4': {
        const victim = this.playerAt(state, 1);
        events.push(...this.giveCards(state, victim, card.value === 'draw2' ? 2 : 4, card.value));
        events.push({ type: 'skipped', playerId: victim });
        this.advance(state, 2);
        break;
      }
      default:
        this.advance(state, 1);
    }
    this.startNextTurn(state, events);
    return events;
  }

  draw(state: GameState, playerId: string, turnId: number): { events: GameEvent[]; playable: boolean } {
    this.assertTurn(state, playerId, turnId);
    if (state.hasDrawn) {
      throw new GameError('ALREADY_DRAWN', 'You already drew this turn. Play the drawn card or pass.');
    }
    const events: GameEvent[] = [];
    this.closeUnoWindow(state, playerId);

    const [card] = this.takeFromDrawPile(state, 1, events);
    if (!card) {
      // No cards left anywhere (extremely rare): the turn simply passes.
      events.push({ type: 'turnPassed', playerId, auto: true });
      this.advance(state, 1);
      this.startNextTurn(state, events);
      return { events, playable: false };
    }

    const hand = state.hands[playerId];
    hand.push(card);
    this.resetUnoFlags(state, playerId);
    events.push({ type: 'cardDrawn', playerId, count: 1, reason: 'draw' });

    const playable = canPlayCard(card, this.topCard(state), state.currentColor, hand);
    if (playable) {
      state.hasDrawn = true;
      state.drawnCardId = card.id;
    } else {
      events.push({ type: 'turnPassed', playerId, auto: true });
      this.advance(state, 1);
      this.startNextTurn(state, events);
    }
    return { events, playable };
  }

  pass(state: GameState, playerId: string, turnId: number): GameEvent[] {
    this.assertTurn(state, playerId, turnId);
    if (!state.hasDrawn) throw new GameError('MUST_DRAW_FIRST', 'Draw a card before passing.');
    const events: GameEvent[] = [{ type: 'turnPassed', playerId, auto: false }];
    this.advance(state, 1);
    this.startNextTurn(state, events);
    return events;
  }

  callUno(state: GameState, playerId: string): GameEvent[] {
    this.assertActive(state);
    this.assertInGame(state, playerId);
    const hand = state.hands[playerId];
    const alreadyCalled = state.unoDeclared.includes(playerId) || state.unoPrimed.includes(playerId);

    if (hand.length === 1) {
      if (alreadyCalled) throw new GameError('CANNOT_CALL_UNO', 'You already called UNO.');
      state.unoDeclared.push(playerId);
      if (state.unoVulnerableId === playerId) state.unoVulnerableId = null;
      return [{ type: 'unoCalled', playerId }];
    }
    // Calling early: on your turn with two cards and a legal play available.
    if (hand.length === 2 && this.currentPlayerId(state) === playerId && this.hasPlayableCard(state, playerId)) {
      if (alreadyCalled) throw new GameError('CANNOT_CALL_UNO', 'You already called UNO.');
      state.unoPrimed.push(playerId);
      return [{ type: 'unoCalled', playerId }];
    }
    throw new GameError('CANNOT_CALL_UNO', 'You can only call UNO when you are about to have one card left.');
  }

  catchUno(state: GameState, catcherId: string, targetId: string): GameEvent[] {
    this.assertActive(state);
    this.assertInGame(state, catcherId);
    if (catcherId === targetId) throw new GameError('NOTHING_TO_CATCH', "You can't catch yourself — call UNO instead!");
    if (state.unoVulnerableId !== targetId || state.hands[targetId]?.length !== 1) {
      throw new GameError('NOTHING_TO_CATCH', 'Too late — there is nobody to catch.');
    }
    const events: GameEvent[] = [{ type: 'unoCaught', playerId: targetId, catcherId }];
    events.push(...this.giveCards(state, targetId, UNO_PENALTY_CARDS, 'unoPenalty'));
    state.unoVulnerableId = null;
    return events;
  }

  /** Called by the server when the turn timer expires: draw a card (if not already drawn) and pass. */
  timeoutTurn(state: GameState): GameEvent[] {
    if (state.finished) return [];
    const playerId = this.currentPlayerId(state);
    const events: GameEvent[] = [{ type: 'turnTimedOut', playerId }];
    this.closeUnoWindow(state, playerId);
    if (!state.hasDrawn) {
      const cards = this.takeFromDrawPile(state, 1, events);
      if (cards.length > 0) {
        state.hands[playerId].push(...cards);
        this.resetUnoFlags(state, playerId);
        events.push({ type: 'cardDrawn', playerId, count: cards.length, reason: 'timeout' });
      }
    }
    events.push({ type: 'turnPassed', playerId, auto: true });
    this.advance(state, 1);
    this.startNextTurn(state, events);
    return events;
  }

  /** Removes a player mid-round. Their cards go back under the draw pile. */
  removePlayer(state: GameState, playerId: string): GameEvent[] {
    const index = state.players.indexOf(playerId);
    if (index === -1) return [];
    const events: GameEvent[] = [];
    const hand = state.hands[playerId] ?? [];
    delete state.hands[playerId];
    state.drawPile.unshift(...shuffle([...hand], this.rng));
    removeFrom(state.unoDeclared, playerId);
    removeFrom(state.unoPrimed, playerId);
    if (state.unoVulnerableId === playerId) state.unoVulnerableId = null;

    const wasCurrent = index === state.currentIndex;
    state.players.splice(index, 1);
    const remaining = state.players.length;
    if (state.finished) return events;

    if (remaining < MIN_PLAYERS) {
      state.finished = true;
      state.forfeit = true;
      state.winnerId = state.players[0] ?? null;
      return events;
    }
    if (index < state.currentIndex) {
      state.currentIndex -= 1;
    } else if (wasCurrent) {
      state.currentIndex = state.direction === 1 ? index % remaining : mod(index - 1, remaining);
      this.startNextTurn(state, events);
    }
    state.currentIndex = mod(state.currentIndex, remaining);
    return events;
  }

  scoreRound(state: GameState): RoundTally {
    const pointsByPlayer: Record<string, number> = {};
    const cardsLeft: Record<string, number> = {};
    let points = 0;
    for (const id of state.players) {
      const hand = state.hands[id] ?? [];
      cardsLeft[id] = hand.length;
      if (id === state.winnerId) continue;
      const handPoints = hand.reduce((sum, card) => sum + cardPoints(card), 0);
      pointsByPlayer[id] = handPoints;
      points += handPoints;
    }
    return { points, pointsByPlayer, cardsLeft };
  }

  // ------------------------------------------------------------------ helpers

  private assertActive(state: GameState): void {
    if (state.finished) throw new GameError('INVALID_STATE', 'This round is already over.');
  }

  private assertInGame(state: GameState, playerId: string): void {
    if (!state.hands[playerId]) throw new GameError('NOT_IN_GAME', "You're not dealt into this round.");
  }

  private assertTurn(state: GameState, playerId: string, turnId: number): void {
    this.assertActive(state);
    this.assertInGame(state, playerId);
    if (this.currentPlayerId(state) !== playerId) throw new GameError('NOT_YOUR_TURN', "It's not your turn.");
    if (turnId !== state.turnId) throw new GameError('STALE_ACTION', 'That action was for an earlier turn.');
  }

  /** The UNO catch window closes as soon as anyone else takes their turn. */
  private closeUnoWindow(state: GameState, actorId: string): void {
    if (state.unoVulnerableId && state.unoVulnerableId !== actorId) state.unoVulnerableId = null;
  }

  private resetUnoFlags(state: GameState, playerId: string): void {
    const size = state.hands[playerId]?.length ?? 0;
    if (size > 1) {
      removeFrom(state.unoDeclared, playerId);
      if (state.unoVulnerableId === playerId) state.unoVulnerableId = null;
    }
    if (size > 2) removeFrom(state.unoPrimed, playerId);
  }

  private giveCards(state: GameState, playerId: string, count: number, reason: DrawReason): GameEvent[] {
    const events: GameEvent[] = [];
    const cards = this.takeFromDrawPile(state, count, events);
    state.hands[playerId].push(...cards);
    this.resetUnoFlags(state, playerId);
    events.push({ type: 'cardDrawn', playerId, count: cards.length, reason });
    return events;
  }

  private takeFromDrawPile(state: GameState, count: number, events: GameEvent[]): Card[] {
    const drawn: Card[] = [];
    for (let i = 0; i < count; i++) {
      if (state.drawPile.length === 0) {
        if (!this.reshuffle(state)) break;
        events.push({ type: 'deckReshuffled' });
      }
      drawn.push(state.drawPile.pop()!);
    }
    return drawn;
  }

  /** Moves every discard except the top card back into the draw pile. */
  private reshuffle(state: GameState): boolean {
    if (state.discardPile.length <= 1) return false;
    const top = state.discardPile.pop()!;
    const recycled = shuffle(state.discardPile, this.rng);
    state.discardPile = [top];
    state.drawPile = [...recycled, ...state.drawPile];
    return true;
  }

  private playerAt(state: GameState, steps: number): string {
    return state.players[mod(state.currentIndex + state.direction * steps, state.players.length)];
  }

  private advance(state: GameState, steps: number): void {
    state.currentIndex = mod(state.currentIndex + state.direction * steps, state.players.length);
  }

  private startNextTurn(state: GameState, events: GameEvent[]): void {
    state.turnId += 1;
    state.hasDrawn = false;
    state.drawnCardId = null;
    events.push({ type: 'turnChanged', playerId: this.currentPlayerId(state) });
  }
}
