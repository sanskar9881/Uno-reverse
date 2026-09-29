import { describe, expect, it } from 'vitest';
import {
  CARD_COLORS,
  DEFAULT_HOUSE_RULES,
  TOTAL_CARDS,
  canPlayCard,
  cardPoints,
  playableCardIds,
  wild4PlayWasLegal,
  type HouseRules,
} from '@shared';
import { createDeck, shuffle } from '../src/game/deck';
import { GameEngine, type GameState } from '../src/game/engine';
import { GameError } from '../src/game/errors';
import { card, cards, fillerCards, riggedDeck } from './helpers/cards';

const engine = new GameEngine(() => 0);

function setup(handCodes: string[], startCode = 'r5', drawCodes = '', fillerCount = 20, houseRules?: Partial<HouseRules>) {
  const hands = handCodes.map(cards);
  const deck = riggedDeck(hands, card(startCode), cards(drawCodes), fillerCards(fillerCount, 'g3'));
  const ids = hands.map((_, i) => `p${i}`);
  const { state, events } = engine.createGame(ids, {
    deck,
    startIndex: 0,
    houseRules: { ...DEFAULT_HOUSE_RULES, ...houseRules },
  });
  return { state, events, hands };
}

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(GameError);
    expect((error as GameError).code).toBe(code);
    return;
  }
  throw new Error(`Expected GameError ${code}, but nothing was thrown`);
}

const totalCards = (s: GameState): number =>
  s.drawPile.length + s.discardPile.length + Object.values(s.hands).reduce((sum, h) => sum + h.length, 0);

const find = (s: GameState, player: string, code: string) => {
  const probe = card(code);
  const found = s.hands[player].find((c) => c.color === probe.color && c.value === probe.value);
  if (!found) throw new Error(`${player} has no ${code}`);
  return found;
};

const play = (s: GameState, player: string, code: string, chosenColor?: 'red' | 'yellow' | 'green' | 'blue') =>
  engine.play(s, player, { cardId: find(s, player, code).id, turnId: s.turnId, chosenColor });

describe('deck', () => {
  it('has the standard 108-card composition with unique ids', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(TOTAL_CARDS);
    expect(new Set(deck.map((c) => c.id)).size).toBe(TOTAL_CARDS);
    for (const color of CARD_COLORS) {
      const ofColor = deck.filter((c) => c.color === color);
      expect(ofColor).toHaveLength(25);
      expect(ofColor.filter((c) => c.value === '0')).toHaveLength(1);
      for (const value of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2']) {
        expect(ofColor.filter((c) => c.value === value)).toHaveLength(2);
      }
    }
    expect(deck.filter((c) => c.value === 'wild')).toHaveLength(4);
    expect(deck.filter((c) => c.value === 'wild4')).toHaveLength(4);
  });

  it('shuffles into a permutation of the same cards', () => {
    const deck = createDeck();
    const ids = deck.map((c) => c.id).sort();
    expect(shuffle([...deck]).map((c) => c.id).sort()).toEqual(ids);
  });
});

describe('rules', () => {
  it('matches by color, symbol or wild', () => {
    const top = card('r5');
    expect(canPlayCard(card('r9'), top, 'red', [])).toBe(true);
    expect(canPlayCard(card('b5'), top, 'red', [])).toBe(true);
    expect(canPlayCard(card('b7'), top, 'red', [])).toBe(false);
    expect(canPlayCard(card('W'), top, 'red', [])).toBe(true);
    expect(canPlayCard(card('gS'), card('rS'), 'red', [])).toBe(true);
  });

  it('only matches the chosen color after a wild', () => {
    const top = card('W');
    expect(canPlayCard(card('g2'), top, 'green', [])).toBe(true);
    expect(canPlayCard(card('b2'), top, 'green', [])).toBe(false);
    expect(canPlayCard(card('W'), top, 'green', [])).toBe(true);
  });

  it('a wild +4 is always playable — the official rule makes it a matter of honesty, checked only on challenge', () => {
    const w4 = card('W4');
    expect(canPlayCard(w4, card('r5'), 'red', [w4, card('r1')])).toBe(true);
    expect(canPlayCard(w4, card('r5'), 'red', [w4, card('b5')])).toBe(true);
    expect(wild4PlayWasLegal(w4.id, 'red', [card('r1')])).toBe(false);
    expect(wild4PlayWasLegal(w4.id, 'red', [card('b5')])).toBe(true);
  });

  it('restricts playable cards to the drawn card after drawing', () => {
    const hand = cards('r1 r2 r3');
    expect(playableCardIds(hand, card('r5'), 'red', hand[1].id)).toEqual(new Set([hand[1].id]));
  });

  it('scores numbers at face value, actions 20 and wilds 50', () => {
    expect(cardPoints(card('r7'))).toBe(7);
    expect(cardPoints(card('b0'))).toBe(0);
    expect(cardPoints(card('gS'))).toBe(20);
    expect(cardPoints(card('yD'))).toBe(20);
    expect(cardPoints(card('W4'))).toBe(50);
  });
});

describe('dealing', () => {
  it('deals 7 cards each with a real (unrigged) deck', () => {
    const game = new GameEngine();
    const { state, events } = game.createGame(['a', 'b', 'c']);
    for (const id of ['a', 'b', 'c']) expect(state.hands[id]).toHaveLength(7);
    expect(state.discardPile).toHaveLength(1);
    expect(state.discardPile[0].value).not.toBe('wild4');
    expect(totalCards(state)).toBe(TOTAL_CARDS);
    expect(events.length).toBeGreaterThan(0);
    expect(events.at(-1)).toEqual({ type: 'turnChanged', playerId: state.players[state.currentIndex] });
  });

  it('needs at least two players', () => {
    expectCode(() => engine.createGame(['solo']), 'NOT_ENOUGH_PLAYERS');
  });
});

// Every official start-card case: docs/PARTY_PLAN_2.md's Phase 10 table, verified against Mattel's rules.
describe('start card', () => {
  it('a number card starts normally', () => {
    const hands = [cards('b1 b2 b3 b4 b6 b7 b8'), cards('y1 y2 y3 y4 y6 y7 y8')];
    const { state, events } = engine.createGame(['p0', 'p1'], { deck: riggedDeck(hands, card('r5'), [], fillerCards(5)) });
    expect(state.discardPile[0]).toMatchObject({ color: 'red', value: '5' });
    expect(state.currentColor).toBe('red');
    expect(state.direction).toBe(1);
    expect(state.players[state.currentIndex]).toBe('p0');
    expect(events).toEqual([{ type: 'turnChanged', playerId: 'p0' }]);
  });

  it('skip skips the first player', () => {
    const hands = [cards('b1 b2 b3 b4 b6 b7 b8'), cards('y1 y2 y3 y4 y6 y7 y8'), cards('g1 g2 g3 g4 g6 g7 g8')];
    const { state, events } = engine.createGame(['p0', 'p1', 'p2'], { deck: riggedDeck(hands, card('rS'), [], fillerCards(5)) });
    expect(state.players[state.currentIndex]).toBe('p1');
    expect(events).toEqual([
      { type: 'skipped', playerId: 'p0' },
      { type: 'turnChanged', playerId: 'p1' },
    ]);
  });

  it('reverse makes the dealer (the seat before the starting seat) go first, the other way', () => {
    const hands = [cards('b1 b2 b3 b4 b6 b7 b8'), cards('y1 y2 y3 y4 y6 y7 y8'), cards('g1 g2 g3 g4 g6 g7 g8')];
    const { state, events } = engine.createGame(['p0', 'p1', 'p2'], { deck: riggedDeck(hands, card('rR'), [], fillerCards(5)) });
    expect(state.direction).toBe(-1);
    expect(state.players[state.currentIndex]).toBe('p2');
    expect(events).toEqual([
      { type: 'reversed', direction: -1 },
      { type: 'turnChanged', playerId: 'p2' },
    ]);
  });

  it('draw two makes the first player draw two and lose their turn', () => {
    const hands = [cards('b1 b2 b3 b4 b6 b7 b8'), cards('y1 y2 y3 y4 y6 y7 y8')];
    const { state, events } = engine.createGame(['p0', 'p1'], { deck: riggedDeck(hands, card('rD'), [], fillerCards(5)) });
    expect(state.hands.p0).toHaveLength(9);
    expect(state.players[state.currentIndex]).toBe('p1');
    expect(events).toEqual([
      { type: 'cardDrawn', playerId: 'p0', count: 2, reason: 'draw2' },
      { type: 'skipped', playerId: 'p0' },
      { type: 'turnChanged', playerId: 'p1' },
    ]);
  });

  it('wild lets the first player choose the color and take the first turn', () => {
    const hands = [cards('b1 b2 b3 b4 b6 b7 b8'), cards('y1 y2 y3 y4 y6 y7 y8')];
    const { state, events } = engine.createGame(['p0', 'p1'], { deck: riggedDeck(hands, card('W'), [], fillerCards(5)) });
    expect(state.discardPile[0].value).toBe('wild');
    expect(CARD_COLORS as readonly string[]).toContain(state.currentColor);
    expect(state.players[state.currentIndex]).toBe('p0');
    expect(events).toEqual([{ type: 'turnChanged', playerId: 'p0' }]);
  });

  it('wild draw four is put back and reshuffled, then the next card applies normally', () => {
    const hands = [cards('b1 b2 b3 b4 b6 b7 b8'), cards('y1 y2 y3 y4 y6 y7 y8')];
    // Every non-wild4 card left is an identical green 4, so whichever one the reshuffle
    // surfaces next is deterministic to assert on.
    const deck = riggedDeck(hands, card('W4'), [], fillerCards(10, 'g4'));
    const { state } = engine.createGame(['p0', 'p1'], { deck });
    expect(state.discardPile[0]).toMatchObject({ color: 'green', value: '4' });
    expect(state.currentColor).toBe('green');
    expect(state.drawPile.some((c) => c.value === 'wild4')).toBe(true);
  });
});

describe('playing cards', () => {
  it('plays a matching card and passes the turn', () => {
    const { state } = setup(['r1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8']);
    const events = play(state, 'p0', 'r1');
    expect(state.hands.p0).toHaveLength(6);
    expect(state.discardPile.at(-1)).toMatchObject({ color: 'red', value: '1' });
    expect(state.currentIndex).toBe(1);
    expect(state.turnId).toBe(2);
    expect(events.map((e) => e.type)).toEqual(['cardPlayed', 'turnChanged']);
  });

  it('rejects illegal plays without changing anything', () => {
    const { state } = setup(['r1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8']);
    const before = JSON.stringify(state);
    expectCode(() => play(state, 'p0', 'b2'), 'INVALID_PLAY');
    expectCode(() => play(state, 'p1', 'y1'), 'NOT_YOUR_TURN');
    expectCode(() => engine.play(state, 'p0', { cardId: 'nope', turnId: 1 }), 'CARD_NOT_IN_HAND');
    expectCode(() => engine.play(state, 'p0', { cardId: state.hands.p1[0].id, turnId: 1 }), 'CARD_NOT_IN_HAND');
    expectCode(() => engine.play(state, 'p0', { cardId: find(state, 'p0', 'r1').id, turnId: 99 }), 'STALE_ACTION');
    expectCode(() => engine.play(state, 'ghost', { cardId: 'x', turnId: 1 }), 'NOT_IN_GAME');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('requires a color for wilds and enforces it for the next player', () => {
    const { state } = setup(['W b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 g8']);
    expectCode(() => play(state, 'p0', 'W'), 'COLOR_REQUIRED');
    play(state, 'p0', 'W', 'green');
    expect(state.currentColor).toBe('green');
    expectCode(() => play(state, 'p1', 'y1'), 'INVALID_PLAY');
    play(state, 'p1', 'g8');
    expect(state.currentColor).toBe('green');
  });

  it('skip jumps over the next player', () => {
    const { state, hands } = setup(['rS b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9']);
    const events = play(state, 'p0', 'rS');
    expect(events).toContainEqual({ type: 'skipped', playerId: 'p1' });
    expect(state.players[state.currentIndex]).toBe('p2');
    expect(hands).toBeDefined();
  });

  it('reverse flips direction with 3+ players', () => {
    const { state } = setup(['rR b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 r8', 'r1 g2 g4 g6 g7 g8 g9']);
    play(state, 'p0', 'rR');
    expect(state.direction).toBe(-1);
    expect(state.players[state.currentIndex]).toBe('p2');
    play(state, 'p2', 'r1');
    expect(state.players[state.currentIndex]).toBe('p1');
  });

  it('reverse acts like skip with 2 players', () => {
    const { state } = setup(['rR b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8']);
    const events = play(state, 'p0', 'rR');
    expect(state.players[state.currentIndex]).toBe('p0');
    expect(state.turnId).toBe(2);
    expect(events).toContainEqual({ type: 'skipped', playerId: 'p1' });
  });

  it('draw two gives the next player two cards and skips them', () => {
    const { state } = setup(['rD b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9']);
    play(state, 'p0', 'rD');
    expect(state.hands.p1).toHaveLength(9);
    expect(state.players[state.currentIndex]).toBe('p2');
  });

  it('wild draw four is always legal to play, but only sets a pending draw (no cards move yet)', () => {
    // p0 holds a red card — the play is illegal — but it's still allowed; only a challenge matters.
    const { state } = setup(['W4 r1 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9']);
    const events = play(state, 'p0', 'W4', 'blue');
    expect(state.hands.p1).toHaveLength(7);
    expect(state.currentColor).toBe('blue');
    expect(state.players[state.currentIndex]).toBe('p1');
    expect(state.pendingDraw).toEqual({ kind: 'wild4', amount: 4, fromPlayerId: 'p0', toPlayerId: 'p1', colorBeforePlay: 'red' });
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'cardDrawn' }));
  });

  it('accepting a pending wild draw four gives the cards and skips to the following player', () => {
    const { state } = setup(['W4 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9']);
    play(state, 'p0', 'W4', 'blue');
    const events = engine.acceptPendingDraw(state, 'p1', state.turnId);
    expect(state.hands.p1).toHaveLength(11);
    expect(state.pendingDraw).toBeNull();
    expect(state.players[state.currentIndex]).toBe('p2');
    expect(events).toContainEqual({ type: 'cardDrawn', playerId: 'p1', count: 4, reason: 'wild4' });
  });

  it('challenging a legal wild draw four costs the challenger 6 cards and their turn', () => {
    // p0 holds no red card: the play is legal.
    const { state } = setup(['W4 b1 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9']);
    play(state, 'p0', 'W4', 'blue');
    const events = engine.challengeWild4(state, 'p1', state.turnId);
    expect(state.hands.p1).toHaveLength(13); // 7 + 4 + 2
    expect(state.hands.p0).toHaveLength(6); // untouched, still down one for the play
    expect(state.pendingDraw).toBeNull();
    expect(state.players[state.currentIndex]).toBe('p2'); // the challenger loses their turn
    expect(events).toContainEqual({ type: 'wild4Challenged', challengerId: 'p1', challengedId: 'p0', legal: true });
  });

  it('challenging an illegal wild draw four makes the challenged player draw instead, and the challenger keeps their turn', () => {
    // p0 holds a red card: the play is illegal.
    const { state } = setup(['W4 r1 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9']);
    play(state, 'p0', 'W4', 'blue');
    const events = engine.challengeWild4(state, 'p1', state.turnId);
    expect(state.hands.p0).toHaveLength(10); // 6 + 4
    expect(state.hands.p1).toHaveLength(7); // untouched
    expect(state.pendingDraw).toBeNull();
    expect(state.players[state.currentIndex]).toBe('p1'); // the challenger keeps their turn
    expect(events).toContainEqual({ type: 'wild4Challenged', challengerId: 'p1', challengedId: 'p0', legal: false });
  });

  it('the timer expiring on a pending draw accepts it automatically', () => {
    const { state } = setup(['W4 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9']);
    play(state, 'p0', 'W4', 'blue');
    const events = engine.timeoutTurn(state);
    expect(state.hands.p1).toHaveLength(11);
    expect(state.pendingDraw).toBeNull();
    expect(state.players[state.currentIndex]).toBe('p2');
    expect(events).toContainEqual({ type: 'turnTimedOut', playerId: 'p1' });
  });
});

describe('drawing and passing', () => {
  it('auto-passes when the drawn card cannot be played', () => {
    const { state } = setup(['b1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8'], 'r5', 'y9');
    const { events, playable } = engine.draw(state, 'p0', 1);
    expect(playable).toBe(false);
    expect(state.hands.p0).toHaveLength(8);
    expect(state.players[state.currentIndex]).toBe('p1');
    expect(events.map((e) => e.type)).toEqual(['cardDrawn', 'turnPassed', 'turnChanged']);
  });

  it('lets you play only the drawn card, or pass', () => {
    const { state } = setup(['r1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8'], 'r5', 'r9');
    expectCode(() => engine.pass(state, 'p0', 1), 'MUST_DRAW_FIRST');
    const { playable } = engine.draw(state, 'p0', 1);
    expect(playable).toBe(true);
    expect(state.hasDrawn).toBe(true);
    expect(state.turnId).toBe(1);
    expectCode(() => play(state, 'p0', 'r1'), 'MUST_PLAY_DRAWN_CARD');
    expectCode(() => engine.draw(state, 'p0', 1), 'ALREADY_DRAWN');
    engine.play(state, 'p0', { cardId: state.drawnCardId!, turnId: 1 });
    expect(state.discardPile.at(-1)).toMatchObject({ color: 'red', value: '9' });
    expect(state.players[state.currentIndex]).toBe('p1');
  });

  it('passes after drawing a playable card', () => {
    const { state } = setup(['r1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8'], 'r5', 'r9');
    engine.draw(state, 'p0', 1);
    const events = engine.pass(state, 'p0', 1);
    expect(events[0]).toEqual({ type: 'turnPassed', playerId: 'p0', auto: false });
    expect(state.players[state.currentIndex]).toBe('p1');
    expect(state.hasDrawn).toBe(false);
  });

  it('reshuffles the discard pile when the draw pile runs out', () => {
    const { state } = setup(['r1 b1 b2 b3 b4 b6 b7', 'r2 g1 g2 g4 g6 g7 g8'], 'r5', 'y9', 0);
    const initial = totalCards(state);
    play(state, 'p0', 'r1');
    play(state, 'p1', 'r2');
    engine.draw(state, 'p0', state.turnId); // takes the last card (y9, unplayable)
    expect(state.drawPile).toHaveLength(0);
    const { events } = engine.draw(state, 'p1', state.turnId);
    expect(events).toContainEqual({ type: 'deckReshuffled' });
    expect(state.discardPile).toHaveLength(1);
    expect(totalCards(state)).toBe(initial);
  });
});

describe('UNO', () => {
  const unoSetup = () => {
    const ctx = setup(['r1 r2 b3 b4 b6 b7 b8', 'r3 y2 y3 y4 y6 y7 y8', 'r4 g2 g4 g6 g7 g8 g9']);
    ctx.state.hands.p0 = cards('r1 r2');
    return ctx;
  };

  it('a missed UNO can be caught for a two-card penalty', () => {
    const { state } = unoSetup();
    play(state, 'p0', 'r1');
    expect(state.unoVulnerableId).toBe('p0');
    expectCode(() => engine.catchUno(state, 'p0', 'p0'), 'NOTHING_TO_CATCH');
    const events = engine.catchUno(state, 'p2', 'p0');
    expect(events[0]).toEqual({ type: 'unoCaught', playerId: 'p0', catcherId: 'p2' });
    expect(state.hands.p0).toHaveLength(3);
    expect(state.unoVulnerableId).toBeNull();
    expectCode(() => engine.catchUno(state, 'p1', 'p0'), 'NOTHING_TO_CATCH');
  });

  it('the catch window closes once the next player acts', () => {
    const { state } = unoSetup();
    play(state, 'p0', 'r1');
    play(state, 'p1', 'r3');
    expect(state.unoVulnerableId).toBeNull();
    expectCode(() => engine.catchUno(state, 'p2', 'p0'), 'NOTHING_TO_CATCH');
  });

  it('calling UNO right after reaching one card protects you', () => {
    const { state } = unoSetup();
    play(state, 'p0', 'r1');
    engine.callUno(state, 'p0');
    expect(state.unoVulnerableId).toBeNull();
    expect(state.unoDeclared).toContain('p0');
    expectCode(() => engine.catchUno(state, 'p2', 'p0'), 'NOTHING_TO_CATCH');
    expectCode(() => engine.callUno(state, 'p0'), 'CANNOT_CALL_UNO');
  });

  it('calling UNO early (two cards, on your turn) carries over to the play', () => {
    const { state } = unoSetup();
    engine.callUno(state, 'p0');
    expectCode(() => engine.callUno(state, 'p0'), 'CANNOT_CALL_UNO');
    play(state, 'p0', 'r1');
    expect(state.unoVulnerableId).toBeNull();
    expect(state.unoDeclared).toContain('p0');
  });

  it('rejects UNO calls that make no sense', () => {
    const { state } = unoSetup();
    expectCode(() => engine.callUno(state, 'p1'), 'CANNOT_CALL_UNO'); // 7 cards
    state.hands.p1 = cards('y2 y3');
    expectCode(() => engine.callUno(state, 'p1'), 'CANNOT_CALL_UNO'); // two cards but not their turn
  });

  it('drawing back above one card clears a declared UNO', () => {
    const { state } = unoSetup();
    play(state, 'p0', 'r1');
    engine.callUno(state, 'p0');
    play(state, 'p1', 'r3');
    play(state, 'p2', 'r4');
    state.hands.p0 = cards('b9'); // make the remaining card unplayable
    engine.draw(state, 'p0', state.turnId);
    expect(state.hands.p0).toHaveLength(2);
    expect(state.unoDeclared).not.toContain('p0');
  });
});

describe('winning and scoring', () => {
  it('ends the round and scores the other hands', () => {
    const { state } = setup(['r1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9']);
    state.hands.p0 = cards('r1');
    state.hands.p1 = cards('y5 bS W');
    state.hands.p2 = cards('g9 W4');
    play(state, 'p0', 'r1');
    expect(state.finished).toBe(true);
    expect(state.winnerId).toBe('p0');
    const tally = engine.scoreRound(state);
    expect(tally.points).toBe(5 + 20 + 50 + 9 + 50);
    expect(tally.pointsByPlayer).toEqual({ p1: 75, p2: 59 });
    expect(tally.cardsLeft).toEqual({ p0: 0, p1: 3, p2: 2 });
    expectCode(() => engine.draw(state, 'p1', state.turnId), 'INVALID_STATE');
  });

  it('a final draw two still makes the next player draw', () => {
    const { state } = setup(['rD b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8']);
    state.hands.p0 = cards('rD');
    play(state, 'p0', 'rD');
    expect(state.finished).toBe(true);
    expect(state.hands.p1).toHaveLength(9);
  });
});

describe('turn timeout', () => {
  it('auto-draws and passes', () => {
    const { state } = setup(['r1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8']);
    const events = engine.timeoutTurn(state);
    expect(events.map((e) => e.type)).toEqual(['turnTimedOut', 'cardDrawn', 'turnPassed', 'turnChanged']);
    expect(state.hands.p0).toHaveLength(8);
    expect(state.players[state.currentIndex]).toBe('p1');
  });

  it('does not draw again if the player already drew', () => {
    const { state } = setup(['r1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8'], 'r5', 'r9');
    engine.draw(state, 'p0', 1);
    engine.timeoutTurn(state);
    expect(state.hands.p0).toHaveLength(8);
    expect(state.players[state.currentIndex]).toBe('p1');
  });
});

describe('removing players mid-round', () => {
  const four = () =>
    setup(['r1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9', 'b1 y9 g0 r0 b0 y0 r9']);

  it('keeps the turn when someone after the current player leaves', () => {
    const { state } = four();
    const before = totalCards(state);
    engine.removePlayer(state, 'p2');
    expect(state.players).toEqual(['p0', 'p1', 'p3']);
    expect(state.players[state.currentIndex]).toBe('p0');
    expect(totalCards(state)).toBe(before);
    expect(state.hands.p2).toBeUndefined();
  });

  it('moves the turn on when the current player leaves', () => {
    const { state } = four();
    const events = engine.removePlayer(state, 'p0');
    expect(state.players[state.currentIndex]).toBe('p1');
    expect(state.turnId).toBe(2);
    expect(events).toContainEqual({ type: 'turnChanged', playerId: 'p1' });
  });

  it('respects direction when the current player leaves', () => {
    const { state } = four();
    state.direction = -1;
    state.currentIndex = 1;
    engine.removePlayer(state, 'p1');
    expect(state.players[state.currentIndex]).toBe('p0');
  });

  it('keeps pointing at the same player when someone before them leaves', () => {
    const { state } = four();
    state.currentIndex = 2;
    engine.removePlayer(state, 'p0');
    expect(state.players[state.currentIndex]).toBe('p2');
  });

  it('wraps around when the last seat leaves on their turn', () => {
    const { state } = four();
    state.currentIndex = 3;
    engine.removePlayer(state, 'p3');
    expect(state.players[state.currentIndex]).toBe('p0');
  });

  it('ends the round as a forfeit when one player is left', () => {
    const { state } = setup(['r1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8']);
    engine.removePlayer(state, 'p0');
    expect(state.finished).toBe(true);
    expect(state.forfeit).toBe(true);
    expect(state.winnerId).toBe('p1');
  });
});

describe('house rules (all off by default)', () => {
  it('stacking: a draw two can be answered with another, and the total falls on whoever can\'t', () => {
    const { state } = setup(
      ['rD b2 b3 b4 b6 b7 b8', 'yD y2 y3 y4 y6 y7 y8', 'g1 g2 g3 g4 g6 g7 g8'],
      'r5',
      '',
      20,
      { stacking: true },
    );
    play(state, 'p0', 'rD');
    expect(state.pendingDraw).toMatchObject({ kind: 'draw2', amount: 2, fromPlayerId: 'p0', toPlayerId: 'p1' });
    play(state, 'p1', 'yD');
    expect(state.pendingDraw).toMatchObject({ kind: 'draw2', amount: 4, fromPlayerId: 'p1', toPlayerId: 'p2' });
    expect(state.hands.p1).toHaveLength(6); // played, hasn't drawn
    engine.acceptPendingDraw(state, 'p2', state.turnId);
    expect(state.hands.p2).toHaveLength(11); // 7 + 4
    expect(state.pendingDraw).toBeNull();
    expect(state.players[state.currentIndex]).toBe('p0');
  });

  it('stacking is off by default: a second draw two cannot answer the first', () => {
    const { state } = setup(['rD b2 b3 b4 b6 b7 b8', 'yD y2 y3 y4 y6 y7 y8']);
    play(state, 'p0', 'rD');
    expect(state.hands.p1).toHaveLength(9); // resolved immediately, no pendingDraw
    expect(state.pendingDraw).toBeNull();
    expectCode(() => play(state, 'p1', 'yD'), 'NOT_YOUR_TURN');
  });

  it('draw until playable: keeps drawing until a playable card turns up', () => {
    const { state } = setup(
      ['g1 g2 g3 g4 g6 g7 g8', 'y1 y2 y3 y4 y6 y7 y8'],
      'r5',
      'b1 b2 r9',
      20,
      { drawUntilPlayable: true },
    );
    const { events, playable } = engine.draw(state, 'p0', state.turnId);
    expect(playable).toBe(true);
    expect(state.hands.p0).toHaveLength(10); // 7 + 3 draws
    expect(state.drawnCardId).toBe(state.hands.p0.find((c) => c.color === 'red' && c.value === '9')!.id);
    expect(events.filter((e) => e.type === 'cardDrawn')).toHaveLength(3);
  });

  it('must play a drawn card: pass is blocked once a playable card was drawn', () => {
    const { state } = setup(['g1 g2 g3 g4 g6 g7 g8', 'y1 y2 y3 y4 y6 y7 y8'], 'r5', 'r9', 20, { mustPlayDrawn: true });
    engine.draw(state, 'p0', state.turnId);
    expect(state.hasDrawn).toBe(true);
    expectCode(() => engine.pass(state, 'p0', state.turnId), 'MUST_PLAY_DRAWN_CARD');
    play(state, 'p0', 'r9');
    expect(state.players[state.currentIndex]).toBe('p1');
  });

  it('seven-zero: playing a 7 swaps hands with the chosen player', () => {
    const { state } = setup(
      ['r7 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g3 g4 g6 g7 g8'],
      'r5',
      '',
      20,
      { sevenZero: true },
    );
    const playedId = find(state, 'p0', 'r7').id;
    const p0Before = state.hands.p0.filter((c) => c.id !== playedId).map((c) => c.id).sort();
    const p1Before = state.hands.p1.map((c) => c.id).sort();
    const events = engine.play(state, 'p0', { cardId: playedId, turnId: state.turnId, targetPlayerId: 'p1' });
    expect(state.hands.p1.map((c) => c.id).sort()).toEqual(p0Before);
    expect(state.hands.p0.map((c) => c.id).sort()).toEqual(p1Before);
    expect(events).toContainEqual({ type: 'handsSwapped', playerId: 'p0', targetPlayerId: 'p1' });
  });

  it('seven-zero requires a target for a 7', () => {
    const { state } = setup(['r7 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8'], 'r5', '', 20, { sevenZero: true });
    expectCode(
      () => engine.play(state, 'p0', { cardId: find(state, 'p0', 'r7').id, turnId: state.turnId }),
      'TARGET_REQUIRED',
    );
  });

  it('seven-zero: playing a 0 rotates every hand one seat in the direction of play', () => {
    const { state } = setup(
      ['r0 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g3 g4 g6 g7 g8'],
      'r5',
      '',
      20,
      { sevenZero: true },
    );
    const before = {
      p0: state.hands.p0.filter((c) => c.value !== '0').map((c) => c.id).sort(),
      p1: state.hands.p1.map((c) => c.id).sort(),
      p2: state.hands.p2.map((c) => c.id).sort(),
    };
    play(state, 'p0', 'r0');
    // direction is +1: each hand moves one seat forward, so seat i receives seat (i-1)'s old hand.
    expect(state.hands.p1.map((c) => c.id).sort()).toEqual(before.p0);
    expect(state.hands.p2.map((c) => c.id).sort()).toEqual(before.p1);
    expect(state.hands.p0.map((c) => c.id).sort()).toEqual(before.p2);
  });

  it('jump-in: an exact color-and-value match can be played out of turn', () => {
    const { state } = setup(
      ['b1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'r5 g2 g3 g4 g6 g7 g8'],
      'r5',
      '',
      20,
      { jumpIn: true },
    );
    const events = engine.jumpIn(state, 'p2', find(state, 'p2', 'r5').id);
    expect(state.discardPile.at(-1)).toMatchObject({ color: 'red', value: '5' });
    expect(state.hands.p2).toHaveLength(6);
    expect(state.players[state.currentIndex]).toBe('p0'); // a number card: play just continues from the jumper
    expect(events).toContainEqual({ type: 'jumpedIn', playerId: 'p2' });
  });

  it('jump-in is off by default', () => {
    const { state } = setup(['b1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'r5 g2 g3 g4 g6 g7 g8'], 'r5');
    expectCode(() => engine.jumpIn(state, 'p2', find(state, 'p2', 'r5').id), 'CANNOT_JUMP_IN');
  });

  it('wild shuffle hands (modern deck): collects, shuffles and redeals every hand', () => {
    const { state } = setup(
      ['WS b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g3 g4 g6 g7 g8'],
      'r5',
      '',
      20,
      { modernDeck: true },
    );
    const events = play(state, 'p0', 'WS', 'red');
    const total = state.hands.p0.length + state.hands.p1.length + state.hands.p2.length;
    expect(total).toBe(6 + 7 + 7); // p0 is down the one card it played
    expect(events).toContainEqual({ type: 'handsShuffled', playerId: 'p0' });
  });

  it('scores the modern deck\'s extra wilds at 40 points', () => {
    expect(cardPoints(card('WS'))).toBe(40);
    expect(cardPoints(card('WC'))).toBe(40);
  });
});
