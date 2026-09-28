import { afterEach, describe, expect, it } from 'vitest';
import {
  ROOM_CODE_REGEX,
  TOTAL_CARDS,
  playableCardIds,
  type Card,
  type CardColor,
  type ClientState,
  type JoinResult,
} from '@shared';
import type { RoomManagerOptions } from '../src/rooms/RoomManager';
import { cards, card, fillerCards, is, riggedDeck } from './helpers/cards';
import type { TestClient } from './helpers/testClient';
import { profile, startTestServer, type TestServer } from './helpers/testServer';

const FAST: RoomManagerOptions = {
  lobbyGraceMs: 400,
  gameGraceMs: 800,
  hostTransferMs: 200,
  disconnectedTurnMs: 300,
  minTimeAfterDrawMs: 100,
  rng: () => 0, // host always starts round 1
};

let ts: TestServer | undefined;
afterEach(async () => {
  await ts?.close();
  ts = undefined;
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Table {
  code: string;
  players: TestClient[];
  seats: JoinResult[];
}

async function lobby(n: number, options: RoomManagerOptions = FAST): Promise<Table> {
  ts = await startTestServer(options);
  const host = await ts.client();
  const created = await host.ok<JoinResult>('room:create', profile('Host'));
  const players = [host];
  const seats = [created];
  for (let i = 1; i < n; i++) {
    const c = await ts.client();
    seats.push(await c.ok<JoinResult>('room:join', { ...profile(`Player${i}`, i % 12), roomCode: created.roomCode }));
    players.push(c);
  }
  await Promise.all(players.map((p) => p.waitFor((s) => s.room.players.length === n)));
  return { code: created.roomCode, players, seats };
}

async function start(table: Table, hands?: string[], startCard = 'r5', draws = '', filler = 'y9'): Promise<void> {
  if (hands) ts!.nextDeck = riggedDeck(hands.map(cards), card(startCard), cards(draws), fillerCards(40, filler));
  await table.players[0].ok('game:start');
  await Promise.all(table.players.map((p) => p.waitFor((s) => s.room.status === 'playing' && s.game !== null)));
}

function findCard(c: TestClient, code: string): Card {
  const found = c.state.hand.find(is(code));
  if (!found) throw new Error(`No ${code} in hand`);
  return found;
}

async function playCode(c: TestClient, code: string, chosenColor?: CardColor) {
  return c.send('game:play', { turnId: c.state.game!.turnId, cardId: findCard(c, code).id, chosenColor });
}

const waitAll = (players: TestClient[], predicate: (s: ClientState) => boolean) =>
  Promise.all(players.map((p) => p.waitFor(predicate)));

const current = (s: ClientState) => s.game?.currentPlayerId;

const tableTotal = (s: ClientState) =>
  s.game ? s.game.drawPileCount + s.game.discardCount + Object.values(s.game.cardCounts).reduce((a, b) => a + b, 0) : 0;

/** Scripted two-player win: five skips keep the turn, then UNO, then the last two blue cards. */
const WINNING_HAND = 'rS rS gS gS bS b1 b2';

async function scriptedWin(winner: TestClient, other: TestClient, callUno = true): Promise<void> {
  for (const code of ['rS', 'rS', 'gS', 'gS', 'bS']) {
    const res = await playCode(winner, code);
    expect(res.ok).toBe(true);
  }
  if (callUno) await winner.ok('game:uno');
  expect((await playCode(winner, 'b1')).ok).toBe(true);
  await other.waitFor((s) => current(s) === other.id);
  // The other player draws a dead card (auto-pass), then the winner goes out.
  expect((await other.send('game:draw', { turnId: other.state.game!.turnId })).ok).toBe(true);
  await winner.waitFor((s) => current(s) === winner.id);
  expect((await playCode(winner, 'b2')).ok).toBe(true);
}

describe('rooms', () => {
  it('creates a room with a shareable 6-character code', async () => {
    ts = await startTestServer(FAST);
    const host = await ts.client();
    const res = await host.ok<JoinResult>('room:create', profile('Sanskar'));
    expect(res.roomCode).toMatch(ROOM_CODE_REGEX);
    expect(res.token).toMatch(/^[a-f0-9]{48}$/);
    const s = await host.waitFor((st) => st.room.code === res.roomCode);
    expect(s.selfId).toBe(res.playerId);
    expect(s.room.status).toBe('lobby');
    expect(s.room.players).toEqual([
      expect.objectContaining({ id: res.playerId, nickname: 'Sanskar', isHost: true, connected: true }),
    ]);
    expect(s.game).toBeNull();
    expect(JSON.stringify(s)).not.toContain(res.token);
  });

  it('lets friends join by code (case and spaces forgiven) and shows everyone the list', async () => {
    ts = await startTestServer(FAST);
    const host = await ts.client();
    const { roomCode } = await host.ok<JoinResult>('room:create', profile('Host'));
    const guest = await ts.client();
    const joined = await guest.ok<JoinResult>('room:join', { ...profile('  Guest   One '), roomCode: ` ${roomCode.toLowerCase()} ` });
    expect(joined.roomCode).toBe(roomCode);
    const hostView = await host.waitFor((s) => s.room.players.length === 2);
    expect(hostView.events).toContainEqual({ type: 'playerJoined', playerId: joined.playerId, nickname: 'Guest One' });
    const guestView = guest.state;
    expect(guestView.room.players.map((p) => [p.nickname, p.isHost])).toEqual([
      ['Host', true],
      ['Guest One', false],
    ]);
  });

  it('transfers host immediately when the host leaves the lobby', async () => {
    const { players, seats } = await lobby(3);
    const [host, p1, p2] = players;
    await host.ok('room:leave');
    const s = await p1.waitFor((st) => st.room.hostId === seats[1].playerId);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'hostChanged', playerId: seats[1].playerId }));
    expect(s.room.players).toHaveLength(2);
    await p2.waitFor((st) => st.room.players.length === 2);
  });

  it('deletes the room once everyone has left', async () => {
    const { code, players } = await lobby(2);
    await players[1].ok('room:leave');
    await players[0].ok('room:leave');
    expect(ts!.server.manager.getRoom(code)).toBeUndefined();
    const late = await ts!.client();
    const res = await late.send('room:join', { ...profile('Late'), roomCode: code });
    expect(res).toMatchObject({ ok: false, error: { code: 'ROOM_NOT_FOUND' } });
  });

  it('lets the host kick a player', async () => {
    const { players, seats } = await lobby(2);
    const [host, guest] = players;
    await host.ok('room:kick', { playerId: seats[1].playerId });
    await host.waitFor((s) => s.room.players.length === 1);
    await sleep(50);
    expect(guest.endedSessions).toEqual([expect.objectContaining({ reason: 'kicked' })]);
    const res = await guest.send('game:uno');
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_IN_ROOM' } });
  });

  it('lets the host change settings (and only the host)', async () => {
    const { players } = await lobby(2);
    const [host, guest] = players;
    expect(await guest.send('room:settings', { turnSeconds: 15 })).toMatchObject({ error: { code: 'NOT_HOST' } });
    expect(await host.send('room:settings', { turnSeconds: 7 })).toMatchObject({ error: { code: 'INVALID_PAYLOAD' } });
    await host.ok('room:settings', { turnSeconds: 15, targetScore: 250 });
    const s = await guest.waitFor((st) => st.room.settings.turnSeconds === 15);
    expect(s.room.settings.targetScore).toBe(250);
  });
});

describe('starting games', () => {
  it('starts a 2-player game and deals 7 private cards each', async () => {
    const table = await lobby(2);
    const [host, guest] = table.players;
    await start(table);
    for (const p of table.players) {
      const g = p.state.game!;
      expect(p.state.hand).toHaveLength(7);
      expect(Object.values(g.cardCounts)).toEqual([7, 7]);
      expect(g.drawPileCount).toBe(TOTAL_CARDS - 15);
      expect(g.discardCount).toBe(1);
      expect(g.topCard.color).not.toBe('wild');
      expect(current(p.state)).toBe(table.seats[0].playerId);
    }
    // Hidden information: nobody's snapshot contains another player's cards.
    const hostJson = JSON.stringify(host.states);
    const guestJson = JSON.stringify(guest.states);
    for (const c of guest.state.hand) expect(hostJson).not.toContain(c.id);
    for (const c of host.state.hand) expect(guestJson).not.toContain(c.id);
  });

  it('starts a 5-player game with correct counts and disjoint hands', async () => {
    const table = await lobby(5);
    await start(table);
    const ids = new Set<string>();
    for (const p of table.players) {
      expect(p.state.hand).toHaveLength(7);
      expect(p.state.game!.turnOrder).toHaveLength(5);
      expect(p.state.game!.drawPileCount).toBe(TOTAL_CARDS - 36);
      for (const c of p.state.hand) ids.add(c.id);
    }
    expect(ids.size).toBe(35);
  });

  it('rejects starting without the host or without enough players', async () => {
    ts = await startTestServer(FAST);
    const host = await ts.client();
    const { roomCode } = await host.ok<JoinResult>('room:create', profile('Host'));
    expect(await host.send('game:start')).toMatchObject({ error: { code: 'NOT_ENOUGH_PLAYERS' } });
    const guest = await ts.client();
    await guest.ok('room:join', { ...profile('Guest'), roomCode });
    expect(await guest.send('game:start')).toMatchObject({ error: { code: 'NOT_HOST' } });
  });
});

describe('playing', () => {
  it('accepts a valid play and rejects invalid ones', async () => {
    const table = await lobby(2);
    const [host, guest] = table.players;
    await start(table, ['r1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8']);

    expect(await playCode(guest, 'y1')).toMatchObject({ error: { code: 'NOT_YOUR_TURN' } });
    expect(await playCode(host, 'b2')).toMatchObject({ error: { code: 'INVALID_PLAY' } });
    expect(await host.send('game:play', { turnId: 1, cardId: 'notacard' })).toMatchObject({
      error: { code: 'CARD_NOT_IN_HAND' },
    });
    expect(await host.send('game:play', { turnId: 1, cardId: guest.state.hand[0].id })).toMatchObject({
      error: { code: 'CARD_NOT_IN_HAND' },
    });
    expect(await host.send('game:play', { turnId: 0, cardId: findCard(host, 'r1').id })).toMatchObject({
      error: { code: 'STALE_ACTION' },
    });
    expect(host.state.hand).toHaveLength(7);

    const r1 = findCard(host, 'r1');
    expect((await playCode(host, 'r1')).ok).toBe(true);
    const seen = await guest.waitFor((s) => s.game!.topCard.id === r1.id);
    expect(current(seen)).toBe(guest.id);
    expect(seen.game!.cardCounts[host.id]).toBe(6);
    expect(seen.events).toContainEqual({ type: 'cardPlayed', playerId: host.id, card: r1, chosenColor: null });
  });

  it('draws a card: dead cards auto-pass, playable ones can be played or passed', async () => {
    const table = await lobby(2);
    const [host, guest] = table.players;
    await start(table, ['b1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8'], 'r5', 'y9 r9');

    const res = await host.send<{ playable: boolean }>('game:draw', { turnId: 1 });
    expect(res).toMatchObject({ ok: true, playable: false });
    expect(host.state.hand).toHaveLength(8);
    const guestView = await guest.waitFor((s) => current(s) === guest.id);
    expect(guestView.game!.cardCounts[host.id]).toBe(8);
    expect(guestView.events).toContainEqual({ type: 'cardDrawn', playerId: host.id, count: 1, reason: 'draw' });
    const drawnByHost = host.state.hand.find(is('y9'))!;
    expect(JSON.stringify(guest.states)).not.toContain(drawnByHost.id);

    const res2 = await guest.send<{ playable: boolean }>('game:draw', { turnId: guest.state.game!.turnId });
    expect(res2).toMatchObject({ ok: true, playable: true });
    expect(guest.state.game!.drawnCardId).toBe(findCard(guest, 'r9').id);
    const hostView = await host.waitFor((s) => s.game!.hasDrawnThisTurn);
    expect(hostView.game!.drawnCardId).toBeNull();
    expect(await playCode(guest, 'y1')).toMatchObject({ error: { code: 'MUST_PLAY_DRAWN_CARD' } });
    expect(await guest.send('game:draw', { turnId: guest.state.game!.turnId })).toMatchObject({
      error: { code: 'ALREADY_DRAWN' },
    });
    await guest.ok('game:pass', { turnId: guest.state.game!.turnId });
    await host.waitFor((s) => current(s) === host.id);
  });

  it('wild asks for a color and the table follows it', async () => {
    const table = await lobby(2);
    const [host, guest] = table.players;
    await start(table, ['W b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 g8']);
    expect(await playCode(host, 'W')).toMatchObject({ error: { code: 'COLOR_REQUIRED' } });
    expect(
      await host.send('game:play', { turnId: 1, cardId: findCard(host, 'W').id, chosenColor: 'purple' }),
    ).toMatchObject({ error: { code: 'INVALID_PAYLOAD' } });
    expect((await playCode(host, 'W', 'green')).ok).toBe(true);
    const s = await guest.waitFor((st) => current(st) === guest.id);
    expect(s.game!.currentColor).toBe('green');
    expect(await playCode(guest, 'y1')).toMatchObject({ error: { code: 'INVALID_PLAY' } });
    expect((await playCode(guest, 'g8')).ok).toBe(true);
  });

  it('wild draw four: +4, skip, color change, and the no-matching-color rule', async () => {
    const table = await lobby(3);
    const [host, p1, p2] = table.players;
    await start(table, ['W4 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'W4 b9 g2 g4 g6 g7 g8']);
    expect((await playCode(host, 'W4', 'blue')).ok).toBe(true);
    const s = await p2.waitFor((st) => current(st) === p2.id);
    expect(s.game!.cardCounts[p1.id]).toBe(11);
    expect(s.game!.currentColor).toBe('blue');
    expect(s.events).toContainEqual({ type: 'skipped', playerId: p1.id });
    // p2 holds a blue card, so their Wild +4 is illegal.
    expect(await playCode(p2, 'W4', 'green')).toMatchObject({ error: { code: 'INVALID_PLAY' } });
  });

  it('skip jumps the next player', async () => {
    const table = await lobby(3);
    const [host, p1, p2] = table.players;
    await start(table, ['rS b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9']);
    await host.ok('game:play', { turnId: 1, cardId: findCard(host, 'rS').id });
    const s = await p2.waitFor((st) => current(st) === p2.id);
    expect(s.events).toContainEqual({ type: 'skipped', playerId: p1.id });
  });

  it('reverse flips direction (and acts as skip with two players)', async () => {
    const table = await lobby(3);
    const [host, , p2] = table.players;
    await start(table, ['rR b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9']);
    await host.ok('game:play', { turnId: 1, cardId: findCard(host, 'rR').id });
    const s = await p2.waitFor((st) => current(st) === p2.id);
    expect(s.game!.direction).toBe(-1);
    expect(s.events).toContainEqual({ type: 'reversed', direction: -1 });

    await ts!.close();
    const duo = await lobby(2);
    await start(duo, ['rR b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8']);
    await duo.players[0].ok('game:play', { turnId: 1, cardId: findCard(duo.players[0], 'rR').id });
    expect(current(duo.players[0].state)).toBe(duo.players[0].id);
  });

  it('draw two makes the next player draw 2 and lose their turn', async () => {
    const table = await lobby(3);
    const [host, p1, p2] = table.players;
    await start(table, ['rD b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9']);
    await host.ok('game:play', { turnId: 1, cardId: findCard(host, 'rD').id });
    const s = await p2.waitFor((st) => current(st) === p2.id);
    expect(s.game!.cardCounts[p1.id]).toBe(9);
    expect(p1.state.hand).toHaveLength(9);
  });
});

describe('UNO', () => {
  it('calling UNO early protects the player', async () => {
    const table = await lobby(2);
    const [host, guest] = table.players;
    await start(table, [WINNING_HAND, 'y1 y2 y3 y4 y6 y7 y8']);
    for (const code of ['rS', 'rS', 'gS', 'gS', 'bS']) await playCode(host, code);
    expect(host.state.hand).toHaveLength(2);
    await host.ok('game:uno');
    await guest.waitFor((s) => s.game!.unoDeclared.includes(host.id));
    expect((await playCode(host, 'b1')).ok).toBe(true);
    const s = await guest.waitFor((st) => current(st) === guest.id);
    expect(s.game!.unoVulnerableId).toBeNull();
    expect(await guest.send('game:catch', { targetId: host.id })).toMatchObject({ error: { code: 'NOTHING_TO_CATCH' } });
  });

  it('a missed UNO can be caught for +2', async () => {
    const table = await lobby(2);
    const [host, guest] = table.players;
    await start(table, [WINNING_HAND, 'y1 y2 y3 y4 y6 y7 y8']);
    for (const code of ['rS', 'rS', 'gS', 'gS', 'bS', 'b1']) await playCode(host, code);
    const s = await guest.waitFor((st) => st.game!.unoVulnerableId === host.id);
    expect(s.game!.cardCounts[host.id]).toBe(1);
    await guest.ok('game:catch', { targetId: host.id });
    const after = await host.waitFor((st) => st.hand.length === 3);
    expect(after.events).toContainEqual({ type: 'unoCaught', playerId: host.id, catcherId: guest.id });
    expect(after.game!.unoVulnerableId).toBeNull();
  });
});

describe('rounds and matches', () => {
  it('declares a winner, scores the round, then supports next round and rematch', async () => {
    const table = await lobby(2);
    const [host, guest] = table.players;
    await start(table, [WINNING_HAND, 'y1 y2 y3 y4 y6 y7 W']);
    await scriptedWin(host, guest);

    const s = await guest.waitFor((st) => st.room.status === 'roundOver');
    const expected = 1 + 2 + 3 + 4 + 6 + 7 + 50 + 9; // guest's hand plus the y9 they drew
    expect(s.room.lastRound).toMatchObject({ winnerId: host.id, points: expected, reason: 'emptiedHand', matchWinnerId: null });
    expect(s.room.players.find((p) => p.id === host.id)!.score).toBe(expected);
    expect(s.events).toContainEqual({ type: 'roundOver', winnerId: host.id, points: expected, reason: 'emptiedHand' });
    expect(s.game!.finished).toBe(true);
    expect(await host.send('game:draw', { turnId: s.game!.turnId })).toMatchObject({ error: { code: 'INVALID_STATE' } });

    // Next round keeps scores; the starting seat rotates to the guest.
    expect(await guest.send('game:nextRound')).toMatchObject({ error: { code: 'NOT_HOST' } });
    ts!.nextDeck = riggedDeck([cards('y1 y2 y3 y4 y6 y7 y8'), cards(WINNING_HAND)], card('r5'), [], fillerCards(40, 'y9'));
    await host.ok('game:nextRound');
    const r2 = await guest.waitFor((st) => st.room.status === 'playing' && st.room.roundNumber === 2);
    expect(current(r2)).toBe(guest.id);
    expect(r2.room.players.find((p) => p.id === host.id)!.score).toBe(expected);
    await scriptedWin(guest, host);
    await host.waitFor((st) => st.room.status === 'roundOver');

    // Rematch resets every score.
    await host.ok('game:rematch');
    const r3 = await guest.waitFor((st) => st.room.status === 'playing' && st.room.roundNumber === 1);
    expect(r3.room.players.map((p) => p.score)).toEqual([0, 0]);
    expect(r3.hand).toHaveLength(7);
  });

  it('ends the match when a player reaches the target score', async () => {
    const table = await lobby(2);
    const [host, guest] = table.players;
    await host.ok('room:settings', { targetScore: 100 });
    await start(table, [WINNING_HAND, 'W W W4 W4 y1 y2 y3']);
    await scriptedWin(host, guest);
    const s = await guest.waitFor((st) => st.room.status === 'roundOver');
    expect(s.room.lastRound!.matchWinnerId).toBe(host.id);
    expect(s.events).toContainEqual({ type: 'matchOver', winnerId: host.id });
    expect(await host.send('game:nextRound')).toMatchObject({ error: { code: 'INVALID_STATE' } });
    await host.ok('game:rematch');
    await guest.waitFor((st) => st.room.status === 'playing');
  });

  it('rejects joining during a round but allows it between rounds', async () => {
    const table = await lobby(2);
    const [host, guest] = table.players;
    await start(table, [WINNING_HAND, 'y1 y2 y3 y4 y6 y7 y8']);
    const late = await ts!.client();
    expect(await late.send('room:join', { ...profile('Late'), roomCode: table.code })).toMatchObject({
      error: { code: 'GAME_IN_PROGRESS' },
    });
    await scriptedWin(host, guest);
    await host.waitFor((s) => s.room.status === 'roundOver');
    await late.ok('room:join', { ...profile('Late'), roomCode: table.code });
    const s = await late.waitFor((st) => st.room.players.length === 3);
    expect(s.room.players.find((p) => p.id === late.id)!.inRound).toBe(false);
    await host.ok('game:nextRound');
    const r2 = await late.waitFor((st) => st.room.status === 'playing');
    expect(r2.hand).toHaveLength(7);
  });
});

describe('disconnects and reconnects', () => {
  it('a disconnected player keeps their seat, their turn auto-passes, then they are removed', async () => {
    const table = await lobby(3);
    const [host, p1, p2] = table.players;
    await start(table, ['r1 b2 b3 b4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8', 'g1 g2 g4 g6 g7 g8 g9']);
    const total = tableTotal(host.state);

    p1.disconnect();
    const s = await host.waitFor((st) => st.room.players.find((p) => p.id === table.seats[1].playerId)!.connected === false);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'playerDisconnected' }));

    await playCode(host, 'r1');
    // p1's turn times out quickly because they're offline: auto-draw + pass.
    const timedOut = await p2.waitFor((st) => current(st) === p2.id);
    expect(timedOut.game!.cardCounts[table.seats[1].playerId]).toBe(8);
    expect(p2.states.some((st) => st.events.some((e) => e.type === 'turnTimedOut'))).toBe(true);

    // After the grace period the seat is released and their cards return to the deck.
    const removed = await host.waitFor((st) => st.room.players.length === 2, 3000);
    expect(removed.events).toContainEqual(expect.objectContaining({ type: 'playerLeft', reason: 'timeout' }));
    expect(removed.game!.turnOrder).toHaveLength(2);
    expect(tableTotal(removed)).toBe(total);
  });

  it('reconnecting with the saved token restores the same seat and hand', async () => {
    const table = await lobby(2);
    const [host, guest] = table.players;
    await start(table);
    const handBefore = guest.state.hand.map((c) => c.id);
    guest.disconnect();
    await host.waitFor((s) => s.room.players.some((p) => !p.connected));

    const again = await ts!.client();
    const res = await again.ok<{ playerId: string }>('room:rejoin', { roomCode: table.code, token: table.seats[1].token });
    expect(res.playerId).toBe(table.seats[1].playerId);
    const s = await again.waitFor((st) => st.selfId === table.seats[1].playerId);
    expect(s.hand.map((c) => c.id)).toEqual(handBefore);
    const hostView = await host.waitFor((st) => st.room.players.every((p) => p.connected));
    expect(hostView.events).toContainEqual(expect.objectContaining({ type: 'playerReconnected' }));
  });

  it('opening the same seat in a new tab replaces the old connection', async () => {
    const table = await lobby(2);
    const guest = table.players[1];
    const tab2 = await ts!.client();
    await tab2.ok('room:rejoin', { roomCode: table.code, token: table.seats[1].token });
    await sleep(50);
    expect(guest.endedSessions).toEqual([expect.objectContaining({ reason: 'replaced' })]);
    expect(await guest.send('room:leave')).toMatchObject({ error: { code: 'NOT_IN_ROOM' } });
  });

  it('a disconnected host hands over the host role, then is removed after the grace period', async () => {
    const table = await lobby(3);
    const [host, p1] = table.players;
    host.disconnect();
    const s = await p1.waitFor((st) => st.room.hostId === table.seats[1].playerId, 2000);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'hostChanged', playerId: table.seats[1].playerId }));
    const gone = await p1.waitFor((st) => st.room.players.length === 2, 2000);
    expect(gone.events).toContainEqual(expect.objectContaining({ type: 'playerLeft', reason: 'timeout' }));
    await p1.ok('room:settings', { turnSeconds: 45 });
  });

  it('a host that comes back quickly keeps the host role', async () => {
    const table = await lobby(2);
    const [host, guest] = table.players;
    host.disconnect();
    await guest.waitFor((s) => s.room.players.some((p) => !p.connected));
    const back = await ts!.client();
    await back.ok('room:rejoin', { roomCode: table.code, token: table.seats[0].token });
    await sleep(400);
    expect(guest.state.room.hostId).toBe(table.seats[0].playerId);
  });

  it('when the other player leaves mid-round, the last player wins by forfeit', async () => {
    const table = await lobby(2);
    const [host, guest] = table.players;
    await start(table);
    await guest.ok('room:leave');
    const s = await host.waitFor((st) => st.room.status === 'roundOver');
    expect(s.room.lastRound).toMatchObject({ winnerId: host.id, reason: 'forfeit', points: 0 });
  });

  it('cleans up the room when everyone disconnects and never returns', async () => {
    const table = await lobby(2);
    for (const p of table.players) p.disconnect();
    await sleep(700);
    expect(ts!.server.manager.getRoom(table.code)).toBeUndefined();
  });
});

describe('security and validation', () => {
  it('rejects malformed payloads', async () => {
    ts = await startTestServer(FAST);
    const bad = [
      ['room:create', { nickname: '', avatar: 0 }],
      ['room:create', { nickname: 'a', avatar: 0 }],
      ['room:create', { nickname: 'x'.repeat(40), avatar: 0 }],
      ['room:create', { nickname: '<script>', avatar: 0 }],
      ['room:create', { nickname: 'Valid', avatar: 99 }],
      ['room:create', { nickname: 'Valid', avatar: 0, profileId: 'not-a-uuid' }],
      ['room:create', 'just a string'],
      ['room:join', { nickname: 'Valid', avatar: 0, roomCode: 'abc' }],
      ['room:join', { nickname: 'Valid', avatar: 0, roomCode: 'O0O0O0' }],
      ['room:rejoin', { roomCode: 'ABCDEF', token: 'short' }],
      ['game:play', { turnId: 'one', cardId: 'x' }],
      ['game:play', { turnId: 1, cardId: '../../etc' }],
      ['game:catch', {}],
    ] as const;
    for (const [event, payload] of bad) {
      // Fresh socket per attempt: the create limit (3 per socket) would otherwise kick in first.
      const c = await ts.client();
      expect(await c.send(event, payload), `${event} ${JSON.stringify(payload)}`).toMatchObject({
        ok: false,
        error: { code: 'INVALID_PAYLOAD' },
      });
    }
  });

  it('rejects unknown rooms, duplicate names, full rooms, bad tokens and out-of-room actions', async () => {
    const table = await lobby(8);
    const extra = await ts!.client();
    expect(await extra.send('room:join', { ...profile('Ninth'), roomCode: table.code })).toMatchObject({
      error: { code: 'ROOM_FULL' },
    });
    expect(await extra.send('room:join', { ...profile('Ninth'), roomCode: 'ZZZZZZ' })).toMatchObject({
      error: { code: 'ROOM_NOT_FOUND' },
    });
    await table.players[7].ok('room:leave');
    expect(await extra.send('room:join', { ...profile('HOST'), roomCode: table.code })).toMatchObject({
      error: { code: 'NAME_TAKEN' },
    });
    expect(await extra.send('room:rejoin', { roomCode: table.code, token: 'a'.repeat(48) })).toMatchObject({
      error: { code: 'SESSION_EXPIRED' },
    });
    expect(await extra.send('game:uno')).toMatchObject({ error: { code: 'NOT_IN_ROOM' } });
    expect(await table.players[0].send('game:uno')).toMatchObject({ error: { code: 'INVALID_STATE' } });
  });

  it('never broadcasts tokens, and ignores extra fields that try to set scores', async () => {
    const table = await lobby(3);
    await table.players[0].send('room:settings', { turnSeconds: 45, score: 9999, hostId: 'me' });
    await table.players[1].waitFor((s) => s.room.settings.turnSeconds === 45);
    const everything = table.players.map((p) => JSON.stringify(p.states)).join('');
    for (const seat of table.seats) expect(everything).not.toContain(seat.token);
    expect(table.players[1].state.room.players.every((p) => p.score === 0)).toBe(true);
    expect(table.players[1].state.room.hostId).toBe(table.seats[0].playerId);
  });

  it('only one of several simultaneous plays goes through', async () => {
    const table = await lobby(2);
    const [host] = table.players;
    await start(table, ['r1 r2 r3 r4 b6 b7 b8', 'y1 y2 y3 y4 y6 y7 y8']);
    const turnId = host.state.game!.turnId;
    const attempts = ['r1', 'r2', 'r3', 'r4', 'r1'].map((code) =>
      host.send('game:play', { turnId, cardId: findCard(host, code).id }),
    );
    const results = await Promise.all(attempts);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(host.state.hand).toHaveLength(6);
  });

  it('rate limits floods of socket events', async () => {
    const table = await lobby(2);
    const results = await Promise.all(Array.from({ length: 40 }, () => table.players[1].send('game:uno')));
    expect(results.some((r) => !r.ok && r.error.code === 'RATE_LIMITED')).toBe(true);

    const spammer = await ts!.client();
    const creates = [];
    for (let i = 0; i < 6; i++) creates.push(await spammer.send('room:create', profile(`Spam${i}`)));
    expect(creates.some((r) => !r.ok && r.error.code === 'RATE_LIMITED')).toBe(true);
    expect(ts!.server.manager.metrics().rooms).toBeLessThanOrEqual(2);
  });
});

describe('full game simulation', () => {
  it.each([4, 8])('%i bots play a complete random round with every card accounted for', async (botCount) => {
    const table = await lobby(botCount, { ...FAST, rng: undefined });
    const errors: string[] = [];
    let violations = 0;
    const tokens = table.seats.map((s) => s.token);

    const bestColor = (hand: Card[]): CardColor => {
      const counts: Record<string, number> = {};
      for (const c of hand) if (c.color !== 'wild') counts[c.color] = (counts[c.color] ?? 0) + 1;
      return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as CardColor) ?? 'red';
    };

    table.players.forEach((bot, index) => {
      const callsUno = index !== 1; // one forgetful bot…
      const catches = index === 2; // …and one sharp-eyed one
      let busy = false;
      let again = false;

      bot.socket.on('state', (s) => {
        if (s.game) {
          const total = tableTotal(s);
          if (total !== TOTAL_CARDS || s.hand.length !== s.game.cardCounts[s.selfId]) violations++;
        }
        const json = JSON.stringify(s);
        if (tokens.some((t) => json.includes(t))) violations++;
        void act();
      });

      async function act(): Promise<void> {
        if (busy) {
          again = true;
          return;
        }
        const s = bot.states.at(-1);
        const g = s?.game;
        if (!s || !g || s.room.status !== 'playing' || errors.length > 20) return;
        const canCatch = catches && g.unoVulnerableId !== null && g.unoVulnerableId !== s.selfId;
        if (!canCatch && g.currentPlayerId !== s.selfId) return;

        busy = true;
        let retry = false;
        try {
          await sleep(40);
          const now = bot.state;
          const game = now.game!;
          if (now.room.status !== 'playing') return;
          let res;
          if (catches && game.unoVulnerableId && game.unoVulnerableId !== now.selfId) {
            res = await bot.send('game:catch', { targetId: game.unoVulnerableId });
          } else if (game.currentPlayerId === now.selfId) {
            const playable = [...playableCardIds(now.hand, game.topCard, game.currentColor, game.drawnCardId)];
            if (playable.length > 0) {
              if (callsUno && now.hand.length === 2 && !game.unoDeclared.includes(now.selfId)) {
                await bot.send('game:uno');
              }
              const chosen = now.hand.find((c) => c.id === playable[0])!;
              res = await bot.send('game:play', {
                turnId: game.turnId,
                cardId: chosen.id,
                chosenColor: chosen.color === 'wild' ? bestColor(now.hand) : undefined,
              });
            } else if (!game.hasDrawnThisTurn) {
              res = await bot.send('game:draw', { turnId: game.turnId });
            } else {
              res = await bot.send('game:pass', { turnId: game.turnId });
            }
          }
          if (res && !res.ok) {
            retry = true;
            if (res.error.code === 'RATE_LIMITED') await sleep(300);
            else if (!['STALE_ACTION', 'NOT_YOUR_TURN', 'NOTHING_TO_CATCH', 'INVALID_STATE'].includes(res.error.code)) {
              errors.push(res.error.code);
            }
          }
        } finally {
          busy = false;
          if (again || retry) {
            again = false;
            void act();
          }
        }
      }
    });

    await table.players[0].ok('game:start');
    const final = await table.players[0].waitFor((s) => s.room.status === 'roundOver', 110_000);
    await sleep(100);

    expect(errors).toEqual([]);
    expect(violations).toBe(0);
    const result = final.room.lastRound!;
    expect(result.reason).toBe('emptiedHand');
    expect(result.cardsLeft[result.winnerId]).toBe(0);
    expect(final.room.players.find((p) => p.id === result.winnerId)!.score).toBe(result.points);
    const plays = table.players[0].states.flatMap((s) => s.events).filter((e) => e.type === 'cardPlayed').length;
    expect(plays).toBeGreaterThan(10);
  }, 120_000);
});
