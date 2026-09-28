import { describe, expect, it } from 'vitest';
import { CARD_COLORS, TOTAL_CARDS, canPlayCard, cardPoints, playableCardIds } from '@shared';
import { createDeck, shuffle } from '../src/game/deck';
import { GameEngine, type GameState } from '../src/game/engine';
import { GameError } from '../src/game/errors';
import { card, cards, fillerCards, riggedDeck } from './helpers/cards';

const engine = new GameEngine(() => 0);

function setup(handCodes: string[], startCode = 'r5', drawCodes = '', fillerCount = 20) {
  const hands = handCodes.map(cards);
  const deck = riggedDeck(hands, card(startCode), cards(drawCodes), fillerCards(fillerCount, 'g3'));
  const ids = hands.map((_, i) => `p${i}`);
  const { state, events } = engine.createGame(ids, { deck, startIndex: 0 });
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

  it('allows Wild +4 only without a card of the active color', () => {
    const w4 = card('W4');
    expect(canPlayCard(w4, card('r5'), 'red', [w4, card('r1')])).toBe(false);
    // A matching number of another color does not block it.
    expect(canPlayCard(w4, card('r5'), 'red', [w4, card('b5')])).toBe(true);
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
  it('deals 7 cards each and flips a number card to start', () => {
    const game = new GameEngine();
    const { state, events } = game.createGame(['a', 'b', 'c']);
    for (const id of ['a', 'b', 'c']) expect(state.hands[id]).toHaveLength(7);
    expect(state.discardPile).toHaveLength(1);
    expect(state.drawPile).toHaveLength(TOTAL_CARDS - 22);
    expect(state.discardPile[0].color).not.toBe('wild');
    expect(Number.isNaN(Number(state.discardPile[0].value))).toBe(false);
    expect(totalCards(state)).toBe(TOTAL_CARDS);
    expect(events).toEqual([{ type: 'turnChanged', playerId: 'a' }]);
  });

  it('puts action and wild cards flipped at the start back under the pile', () => {
    const hands = [cards('b1 b2 b3 b4 b6 b7 b8'), cards('y1 y2 y3 y4 y6 y7 y8')];
    const deck = riggedDeck(hands, card('rS'), cards('W g4'), fillerCards(5));
    const { state } = engine.createGame(['p0', 'p1'], { deck });
    expect(state.discardPile[0]).toMatchObject({ color: 'green', value: '4' });
    expect(state.currentColor).toBe('green');
    expect(state.drawPile.slice(0, 2).map((c) => c.value)).toEqual(['skip', 'wild']);
  });

  it('needs at least two players', () => {
    expectCode(() => engine.createGame(['solo']), 'NOT_ENOUGH_PLAYERS');
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

  it('wild draw four gives four cards, skips, and sets the color', () => {
    const { state } = setup(['W4 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9']);
    const events = play(state, 'p0', 'W4', 'blue');
    expect(state.hands.p1).toHaveLength(11);
    expect(state.players[state.currentIndex]).toBe('p2');
    expect(state.currentColor).toBe('blue');
    expect(events).toContainEqual({ type: 'cardDrawn', playerId: 'p1', count: 4, reason: 'wild4' });
  });

  it('refuses wild draw four while holding the active color', () => {
    const { state } = setup(['W4 r1 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8']);
    expectCode(() => play(state, 'p0', 'W4', 'blue'), 'INVALID_PLAY');
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
