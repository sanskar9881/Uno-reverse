import {
  CARD_COLORS,
  DEFAULT_HOUSE_RULES,
  HAND_SIZE,
  MIN_PLAYERS,
  UNO_PENALTY_CARDS,
  canJumpIn,
  canPlayCard,
  cardPoints,
  wild4PlayWasLegal,
  type Card,
  type CardColor,
  type DrawReason,
  type GameEvent,
  type HouseRules,
} from '@shared';
import { createDeck, secureRng, shuffle, type Rng } from './deck';
import { GameError } from './errors';

/** A Draw Two or Wild +4 (or a stacked chain of them) waiting on `toPlayerId` to accept, challenge or stack. */
export interface PendingDraw {
  kind: 'draw2' | 'wild4';
  amount: number;
  fromPlayerId: string;
  toPlayerId: string;
  /** The active color immediately before `fromPlayerId`'s card was played — a Wild +4 challenge checks this. */
  colorBeforePlay: CardColor;
}

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
  houseRules: HouseRules;
  pendingDraw: PendingDraw | null;
}

export interface CreateGameOptions {
  /** Pre-ordered deck (last element is drawn first). Used by tests; production shuffles a fresh deck. */
  deck?: Card[];
  startIndex?: number;
  houseRules?: HouseRules;
}

export interface PlayInput {
  cardId: string;
  chosenColor?: CardColor;
  turnId: number;
  /** Only read for a '7' when the Seven-0 house rule is on. */
  targetPlayerId?: string;
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
    const houseRules = options.houseRules ?? DEFAULT_HOUSE_RULES;
    let drawPile = options.deck ? [...options.deck] : shuffle(createDeck({ modern: houseRules.modernDeck }), this.rng);
    const hands: Record<string, Card[]> = {};
    for (const id of playerIds) hands[id] = [];

    for (let round = 0; round < HAND_SIZE; round++) {
      for (const id of playerIds) {
        const card = drawPile.pop();
        if (!card) throw new GameError('INTERNAL', 'The deck ran out while dealing.');
        hands[id].push(card);
      }
    }

    // Official start-card table: a Wild +4 is put back and reshuffled; every other
    // card applies its normal effect to the first player, exactly as if they'd
    // just been dealt it and played it themselves.
    let start: Card | undefined;
    for (let attempt = 0; attempt < 1000 && drawPile.length > 0; attempt++) {
      const card = drawPile.pop()!;
      if (card.value === 'wild4') {
        drawPile.push(card);
        drawPile = shuffle(drawPile, this.rng);
        continue;
      }
      start = card;
      break;
    }
    if (!start) throw new GameError('INTERNAL', 'No card available to start the round.');

    const n = playerIds.length;
    const startIndex = mod(options.startIndex ?? 0, n);
    const state: GameState = {
      players: [...playerIds],
      hands,
      drawPile,
      discardPile: [start],
      currentIndex: startIndex,
      direction: 1,
      currentColor: (start.color === 'wild' ? CARD_COLORS[this.rng(CARD_COLORS.length)] : start.color) as CardColor,
      turnId: 1,
      hasDrawn: false,
      drawnCardId: null,
      unoDeclared: [],
      unoPrimed: [],
      unoVulnerableId: null,
      finished: false,
      winnerId: null,
      forfeit: false,
      houseRules,
      pendingDraw: null,
    };

    const events: GameEvent[] = [];
    switch (start.value) {
      case 'skip':
        state.currentIndex = mod(startIndex + 1, n);
        events.push({ type: 'skipped', playerId: playerIds[startIndex] });
        break;
      case 'reverse':
        // The dealer (the seat before the starting seat) plays first, and play goes the other way.
        state.direction = -1;
        state.currentIndex = mod(startIndex - 1, n);
        events.push({ type: 'reversed', direction: -1 });
        break;
      case 'draw2': {
        const firstId = playerIds[startIndex];
        const drawn: Card[] = [];
        for (let i = 0; i < 2 && state.drawPile.length > 0; i++) drawn.push(state.drawPile.pop()!);
        state.hands[firstId].push(...drawn);
        state.currentIndex = mod(startIndex + 1, n);
        events.push({ type: 'cardDrawn', playerId: firstId, count: drawn.length, reason: 'draw2' });
        events.push({ type: 'skipped', playerId: firstId });
        break;
      }
      default:
        break;
    }
    events.push({ type: 'turnChanged', playerId: this.currentPlayerId(state) });
    return { state, events };
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
    if (state.pendingDraw && state.pendingDraw.toPlayerId === playerId && this.currentPlayerId(state) === playerId) {
      const pending = state.pendingDraw;
      const held = state.hands[playerId]?.find((c) => c.id === input.cardId);
      if (state.houseRules.stacking && held && held.value === pending.kind) {
        return this.stackPendingDraw(state, playerId, input);
      }
      throw new GameError('PENDING_DRAW', 'Accept the cards or challenge before you can play.');
    }

    this.assertTurn(state, playerId, input.turnId);
    const hand = state.hands[playerId];
    const index = hand.findIndex((c) => c.id === input.cardId);
    if (index === -1) throw new GameError('CARD_NOT_IN_HAND', "You don't have that card.");
    const card = hand[index];

    if (state.hasDrawn && state.drawnCardId !== card.id) {
      throw new GameError('MUST_PLAY_DRAWN_CARD', 'After drawing you can only play the card you drew, or pass.');
    }
    if (!canPlayCard(card, this.topCard(state), state.currentColor, hand)) {
      throw new GameError('INVALID_PLAY', "That card doesn't match the color or symbol.");
    }
    if (card.color === 'wild' && !input.chosenColor) {
      throw new GameError('COLOR_REQUIRED', 'Choose a color for your wild card.');
    }
    if (card.value === '7' && state.houseRules.sevenZero) {
      const target = input.targetPlayerId;
      if (!target || target === playerId || !state.hands[target]) {
        throw new GameError('TARGET_REQUIRED', 'Choose another player to swap hands with.');
      }
    }

    const events: GameEvent[] = [];
    this.closeUnoWindow(state, playerId);

    hand.splice(index, 1);
    state.discardPile.push(card);
    const colorBeforePlay = state.currentColor;
    const chosenColor = card.color === 'wild' ? input.chosenColor! : null;
    state.currentColor = chosenColor ?? (card.color as CardColor);
    events.push({
      type: 'cardPlayed',
      playerId,
      card,
      chosenColor,
      targetPlayerId: card.value === '7' ? input.targetPlayerId : undefined,
    });

    this.primeOrExposeUno(state, playerId);

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

    this.applyCardEffect(state, card, colorBeforePlay, input.targetPlayerId, events);
    this.startNextTurn(state, events);
    return events;
  }

  /** The player facing a pending Draw Two / Wild +4 accepts it (or the timer expired). */
  acceptPendingDraw(state: GameState, playerId: string, turnId: number): GameEvent[] {
    this.assertActive(state);
    this.assertInGame(state, playerId);
    if (!state.pendingDraw || state.pendingDraw.toPlayerId !== playerId) {
      throw new GameError('NOTHING_TO_CHALLENGE', 'There is nothing to accept right now.');
    }
    if (this.currentPlayerId(state) !== playerId) throw new GameError('NOT_YOUR_TURN', "It's not your turn.");
    if (turnId !== state.turnId) throw new GameError('STALE_ACTION', 'That action was for an earlier turn.');
    const pending = state.pendingDraw;
    const events = this.giveCards(state, playerId, pending.amount, pending.kind);
    state.pendingDraw = null;
    this.advance(state, 1);
    this.startNextTurn(state, events);
    return events;
  }

  /** Only legal against a pending Wild +4. Reveals the challenged player's hand either way. */
  challengeWild4(state: GameState, playerId: string, turnId: number): GameEvent[] {
    this.assertActive(state);
    this.assertInGame(state, playerId);
    if (!state.pendingDraw || state.pendingDraw.toPlayerId !== playerId || state.pendingDraw.kind !== 'wild4') {
      throw new GameError('NOTHING_TO_CHALLENGE', 'There is nothing to challenge right now.');
    }
    if (this.currentPlayerId(state) !== playerId) throw new GameError('NOT_YOUR_TURN', "It's not your turn.");
    if (turnId !== state.turnId) throw new GameError('STALE_ACTION', 'That action was for an earlier turn.');
    const pending = state.pendingDraw;
    const challengedHand = state.hands[pending.fromPlayerId] ?? [];
    const wildFourCardId = this.topCard(state).id;
    const wasLegal = wild4PlayWasLegal(wildFourCardId, pending.colorBeforePlay, challengedHand);

    const events: GameEvent[] = [
      { type: 'wild4Challenged', challengerId: playerId, challengedId: pending.fromPlayerId, legal: wasLegal },
    ];
    state.pendingDraw = null;
    if (wasLegal) {
      // The play was legal: the challenger pays for guessing wrong, and loses their turn.
      events.push(...this.giveCards(state, playerId, pending.amount + 2, 'wild4Challenge'));
      this.advance(state, 1);
    } else {
      // The play was illegal: the challenged player pays instead, and the challenger keeps their turn.
      events.push(...this.giveCards(state, pending.fromPlayerId, pending.amount, 'wild4Challenge'));
    }
    this.startNextTurn(state, events);
    return events;
  }

  /** House rule: play an exact color+value match for the top card, out of turn. */
  jumpIn(state: GameState, playerId: string, cardId: string, chosenColor?: CardColor, targetPlayerId?: string): GameEvent[] {
    this.assertActive(state);
    this.assertInGame(state, playerId);
    if (!state.houseRules.jumpIn) throw new GameError('CANNOT_JUMP_IN', 'Jump-in is off.');
    if (state.pendingDraw) throw new GameError('CANNOT_JUMP_IN', 'Someone still has to accept or challenge a pending draw.');
    if (this.currentPlayerId(state) === playerId) throw new GameError('CANNOT_JUMP_IN', "It's already your turn — just play.");
    const hand = state.hands[playerId];
    const index = hand.findIndex((c) => c.id === cardId);
    if (index === -1) throw new GameError('CARD_NOT_IN_HAND', "You don't have that card.");
    const card = hand[index];
    if (!canJumpIn(card, this.topCard(state), state.currentColor)) {
      throw new GameError('CANNOT_JUMP_IN', "That's not an exact match for the top card.");
    }
    if (card.value === '7' && state.houseRules.sevenZero) {
      if (!targetPlayerId || targetPlayerId === playerId || !state.hands[targetPlayerId]) {
        throw new GameError('TARGET_REQUIRED', 'Choose another player to swap hands with.');
      }
    }

    const events: GameEvent[] = [{ type: 'jumpedIn', playerId }];
    this.closeUnoWindow(state, playerId);
    hand.splice(index, 1);
    state.discardPile.push(card);
    const colorBeforePlay = state.currentColor;
    state.currentColor = card.color as CardColor;
    events.push({ type: 'cardPlayed', playerId, card, chosenColor: null, targetPlayerId });

    state.currentIndex = state.players.indexOf(playerId);
    state.hasDrawn = false;
    state.drawnCardId = null;
    this.primeOrExposeUno(state, playerId);

    if (hand.length === 0) {
      removeFrom(state.unoDeclared, playerId);
      if (card.value === 'draw2') {
        const victim = this.playerAt(state, 1);
        events.push(...this.giveCards(state, victim, 2, 'draw2'));
      }
      state.finished = true;
      state.winnerId = playerId;
      state.unoVulnerableId = null;
      return events;
    }

    this.applyCardEffect(state, card, colorBeforePlay, targetPlayerId, events);
    this.startNextTurn(state, events);
    return events;
  }

  draw(state: GameState, playerId: string, turnId: number): { events: GameEvent[]; playable: boolean } {
    this.assertTurn(state, playerId, turnId);
    if (state.pendingDraw && state.pendingDraw.toPlayerId === playerId) {
      throw new GameError('PENDING_DRAW', 'Accept the cards or challenge before you can draw.');
    }
    if (state.hasDrawn) {
      throw new GameError('ALREADY_DRAWN', 'You already drew this turn. Play the drawn card or pass.');
    }
    const events: GameEvent[] = [];
    this.closeUnoWindow(state, playerId);

    const hand = state.hands[playerId];
    const top = this.topCard(state);
    const drawUntilPlayable = state.houseRules.drawUntilPlayable;
    let playableCard: Card | null = null;
    let drewAny = false;
    do {
      const [card] = this.takeFromDrawPile(state, 1, events);
      if (!card) break;
      drewAny = true;
      hand.push(card);
      this.resetUnoFlags(state, playerId);
      events.push({ type: 'cardDrawn', playerId, count: 1, reason: 'draw' });
      if (canPlayCard(card, top, state.currentColor, hand)) {
        playableCard = card;
        break;
      }
    } while (drawUntilPlayable && this.hasDrawablesLeft(state));

    if (!drewAny) {
      events.push({ type: 'turnPassed', playerId, auto: true });
      this.advance(state, 1);
      this.startNextTurn(state, events);
      return { events, playable: false };
    }

    if (playableCard) {
      state.hasDrawn = true;
      state.drawnCardId = playableCard.id;
    } else {
      events.push({ type: 'turnPassed', playerId, auto: true });
      this.advance(state, 1);
      this.startNextTurn(state, events);
    }
    return { events, playable: playableCard !== null };
  }

  pass(state: GameState, playerId: string, turnId: number): GameEvent[] {
    this.assertTurn(state, playerId, turnId);
    if (!state.hasDrawn) throw new GameError('MUST_DRAW_FIRST', 'Draw a card before passing.');
    if (state.houseRules.mustPlayDrawn) {
      throw new GameError('MUST_PLAY_DRAWN_CARD', 'You drew a playable card — you have to play it.');
    }
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

  /** Called by the server when the turn timer expires: resolve a pending draw, or draw (if needed) and pass. */
  timeoutTurn(state: GameState): GameEvent[] {
    if (state.finished) return [];
    const playerId = this.currentPlayerId(state);
    if (state.pendingDraw && state.pendingDraw.toPlayerId === playerId) {
      const events: GameEvent[] = [{ type: 'turnTimedOut', playerId }];
      const pending = state.pendingDraw;
      events.push(...this.giveCards(state, playerId, pending.amount, pending.kind));
      state.pendingDraw = null;
      this.advance(state, 1);
      this.startNextTurn(state, events);
      return events;
    }
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
    if (state.pendingDraw && (state.pendingDraw.fromPlayerId === playerId || state.pendingDraw.toPlayerId === playerId)) {
      state.pendingDraw = null;
    }

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

  /** Applies a just-played (or jumped-in) card's effect. `state.currentIndex` must still be the player who played it. */
  private applyCardEffect(
    state: GameState,
    card: Card,
    colorBeforePlay: CardColor,
    targetPlayerId: string | undefined,
    events: GameEvent[],
  ): void {
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
          events.push({ type: 'skipped', playerId: this.playerAt(state, 1) });
          this.advance(state, 2);
        } else {
          this.advance(state, 1);
        }
        break;
      }
      case 'draw2': {
        if (!state.houseRules.stacking) {
          const victim = this.playerAt(state, 1);
          events.push(...this.giveCards(state, victim, 2, 'draw2'));
          events.push({ type: 'skipped', playerId: victim });
          this.advance(state, 2);
        } else {
          this.startPendingDraw(state, 'draw2', 2, colorBeforePlay);
        }
        break;
      }
      case 'wild4': {
        this.startPendingDraw(state, 'wild4', 4, colorBeforePlay);
        break;
      }
      case '7': {
        if (state.houseRules.sevenZero && targetPlayerId) {
          const me = this.currentPlayerId(state);
          const tmp = state.hands[me];
          state.hands[me] = state.hands[targetPlayerId];
          state.hands[targetPlayerId] = tmp;
          this.resetUnoFlags(state, me);
          this.resetUnoFlags(state, targetPlayerId);
          events.push({ type: 'handsSwapped', playerId: me, targetPlayerId });
        }
        this.advance(state, 1);
        break;
      }
      case '0': {
        if (state.houseRules.sevenZero) {
          this.rotateHands(state);
          events.push({ type: 'handsRotated' });
        }
        this.advance(state, 1);
        break;
      }
      case 'wildShuffle': {
        const dealer = this.currentPlayerId(state);
        this.shuffleAllHands(state);
        events.push({ type: 'handsShuffled', playerId: dealer });
        this.advance(state, 1);
        break;
      }
      default:
        this.advance(state, 1);
    }
  }

  private startPendingDraw(state: GameState, kind: 'draw2' | 'wild4', amount: number, colorBeforePlay: CardColor): void {
    const fromPlayerId = this.currentPlayerId(state);
    const toPlayerId = this.playerAt(state, 1);
    state.pendingDraw = { kind, amount, fromPlayerId, toPlayerId, colorBeforePlay };
    this.advance(state, 1);
  }

  /** House rule: the player facing a pending draw answers with a matching Draw Two / Wild +4 instead. */
  private stackPendingDraw(state: GameState, playerId: string, input: PlayInput): GameEvent[] {
    const pending = state.pendingDraw!;
    const hand = state.hands[playerId];
    const index = hand.findIndex((c) => c.id === input.cardId);
    if (index === -1) throw new GameError('CARD_NOT_IN_HAND', "You don't have that card.");
    const card = hand[index];
    if (card.value !== pending.kind) {
      throw new GameError(
        'INVALID_PLAY',
        pending.kind === 'draw2' ? 'You can only stack another Draw Two.' : 'You can only stack another Wild +4.',
      );
    }
    if (card.color === 'wild' && !input.chosenColor) {
      throw new GameError('COLOR_REQUIRED', 'Choose a color for your wild card.');
    }

    const events: GameEvent[] = [];
    this.closeUnoWindow(state, playerId);
    hand.splice(index, 1);
    state.discardPile.push(card);
    const colorBeforePlay = state.currentColor;
    const chosenColor = card.color === 'wild' ? input.chosenColor! : null;
    state.currentColor = chosenColor ?? (card.color as CardColor);
    events.push({ type: 'cardPlayed', playerId, card, chosenColor });
    this.primeOrExposeUno(state, playerId);

    const amount = pending.amount + (pending.kind === 'draw2' ? 2 : 4);
    if (hand.length === 0) {
      removeFrom(state.unoDeclared, playerId);
      const victim = this.playerAt(state, 1);
      events.push(...this.giveCards(state, victim, amount, pending.kind));
      state.pendingDraw = null;
      state.finished = true;
      state.winnerId = playerId;
      state.unoVulnerableId = null;
      return events;
    }

    state.pendingDraw = { kind: pending.kind, amount, fromPlayerId: playerId, toPlayerId: this.playerAt(state, 1), colorBeforePlay };
    events.push({ type: 'drawStacked', playerId, amount });
    this.advance(state, 1);
    this.startNextTurn(state, events);
    return events;
  }

  private rotateHands(state: GameState): void {
    const ids = state.players;
    const n = ids.length;
    if (n < 2) return;
    const before = ids.map((id) => state.hands[id]);
    for (let i = 0; i < n; i++) {
      state.hands[ids[i]] = before[mod(i - state.direction, n)];
    }
  }

  private shuffleAllHands(state: GameState): void {
    const n = state.players.length;
    const pool: Card[] = [];
    for (const id of state.players) {
      pool.push(...state.hands[id]);
      state.hands[id] = [];
    }
    shuffle(pool, this.rng);
    const starter = mod(state.currentIndex + state.direction, n);
    let i = 0;
    while (pool.length > 0) {
      state.hands[state.players[mod(starter + i, n)]].push(pool.pop()!);
      i++;
    }
    for (const id of state.players) {
      this.resetUnoFlags(state, id);
      if (state.hands[id].length === 1 && !state.unoDeclared.includes(id)) state.unoVulnerableId = id;
    }
  }

  /** Reaching one card without a prior early call makes you catchable; a primed early call confirms instead. */
  private primeOrExposeUno(state: GameState, playerId: string): void {
    const hand = state.hands[playerId];
    if (hand.length === 1) {
      if (state.unoPrimed.includes(playerId)) {
        if (!state.unoDeclared.includes(playerId)) state.unoDeclared.push(playerId);
      } else {
        state.unoVulnerableId = playerId;
      }
    }
    removeFrom(state.unoPrimed, playerId);
  }

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

  private hasDrawablesLeft(state: GameState): boolean {
    return state.drawPile.length > 0 || state.discardPile.length > 1;
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
