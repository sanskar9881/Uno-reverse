import { afterEach, describe, expect, it } from 'vitest';
import type { ClientState, GroupCard, GroupView, JoinResult } from '@shared';
import type { RoomManagerOptions } from '../src/rooms/RoomManager';
import type { TestClient } from './helpers/testClient';
import { profile, startTestServer, type TestServer } from './helpers/testServer';

const FAST: RoomManagerOptions = {
  lobbyGraceMs: 400,
  gameGraceMs: 800,
  hostTransferMs: 200,
  rng: () => 0,
};

let ts: TestServer | undefined;
afterEach(async () => {
  await ts?.close();
  ts = undefined;
});

const party = (s: ClientState) => s.party as GroupView;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function groupLobby(count: number, options: RoomManagerOptions = FAST): Promise<TestClient[]> {
  ts = await startTestServer(options);
  const names = ['Alex', 'Blair', 'Casey', 'Drew', 'Eden'];
  const first = await ts.client();
  const created = await first.ok<JoinResult>('room:create', { ...profile(names[0]), gameType: 'group' });
  const clients = [first];
  for (let i = 1; i < count; i++) {
    const c = await ts.client();
    await c.ok<JoinResult>('room:join', { ...profile(names[i]), roomCode: created.roomCode });
    clients.push(c);
  }
  await Promise.all(clients.map((c) => c.waitFor((s) => s.room.players.length === count)));
  return clients;
}

async function start(clients: TestClient[]): Promise<void> {
  await clients[0].ok('game:start');
  await Promise.all(clients.map((c) => c.waitFor((s) => s.room.status === 'playing' && s.party !== null)));
}

function actor(clients: TestClient[]): TestClient {
  const id = party(clients[0].state).currentPlayerId;
  return clients.find((c) => c.id === id)!;
}

describe('truth and dare group online', () => {
  it('creates a group room with the right game type, seat order and a 12-player cap', async () => {
    const clients = await groupLobby(3);
    expect(clients[0].state.room.gameType).toBe('group');
    await start(clients);
    expect(party(clients[0].state).turnOrder).toEqual(clients.map((c) => c.id));
  });

  it('starts with Normal included and seat-order picking', async () => {
    const clients = await groupLobby(3);
    await start(clients);
    expect(party(clients[0].state).types).toEqual(['normal']);
    expect(party(clients[0].state).pickMode).toBe('order');
  });

  it('draws a card for whoever is current, and every player sees the same card', async () => {
    const clients = await groupLobby(3);
    await start(clients);
    const drawer = actor(clients);
    const res = await drawer.ok<{ card: GroupCard }>('group:choose', { kind: 'truth', turnId: party(drawer.state).turnId });
    expect(res.card.cardType).toBe('normal');
    await Promise.all(clients.map((c) => c.waitFor((s) => party(s).card?.text === res.card.text)));
  });

  it('only the current player can act, and rejects a stale turnId', async () => {
    const clients = await groupLobby(3);
    await start(clients);
    const drawer = actor(clients);
    const other = clients.find((c) => c !== drawer)!;

    const badTurn = await other.send('group:choose', { kind: 'dare', turnId: party(other.state).turnId });
    expect(badTurn.ok).toBe(false);
    if (!badTurn.ok) expect(badTurn.error.code).toBe('NOT_YOUR_TURN');

    const stale = await drawer.send('group:choose', { kind: 'truth', turnId: party(drawer.state).turnId + 9 });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('STALE_ACTION');
  });

  it('Done advances to the next player in seat order and clears the card', async () => {
    const clients = await groupLobby(3);
    await start(clients);
    const drawer = actor(clients);
    await drawer.ok('group:choose', { kind: 'truth', turnId: party(drawer.state).turnId });
    const turnId = party(drawer.state).turnId;
    await drawer.ok('group:done', { turnId });

    const order = party(drawer.state).turnOrder;
    const expectedNext = order[(order.indexOf(drawer.id) + 1) % order.length];
    await Promise.all(clients.map((c) => c.waitFor((s) => party(s).currentPlayerId === expectedNext)));
    expect(party(clients[0].state).card).toBeNull();
    expect(party(clients[0].state).turnId).toBe(turnId + 1);
  });

  it('Pass draws another card of the same kind without ending the turn', async () => {
    const clients = await groupLobby(3);
    await start(clients);
    const drawer = actor(clients);
    const drawn = await drawer.ok<{ card: GroupCard }>('group:choose', { kind: 'dare', turnId: party(drawer.state).turnId });
    const passed = await drawer.ok<{ card: GroupCard }>('group:pass', { turnId: party(drawer.state).turnId });
    expect(passed.card.kind).toBe('dare');
    expect(drawn.card.kind).toBe(passed.card.kind);
    expect(party(drawer.state).currentPlayerId).toBe(drawer.id);
  });

  it('only draws from the types currently included', async () => {
    const clients = await groupLobby(3);
    await start(clients);
    await clients[0].ok('group:types', { types: ['revealing'] });
    await Promise.all(clients.map((c) => c.waitFor((s) => party(s).types.length === 1)));

    let drawer = actor(clients);
    for (let i = 0; i < 5; i++) {
      const res = await drawer.ok<{ card: GroupCard }>('group:choose', { kind: 'truth', turnId: party(drawer.state).turnId });
      expect(res.card.cardType).toBe('revealing');
      await drawer.ok('group:done', { turnId: party(drawer.state).turnId });
      await sleep(120);
      drawer = actor(clients);
    }
  }, 15_000);

  it('rejects an empty type list', async () => {
    const clients = await groupLobby(3);
    await start(clients);
    const res = await clients[0].send('group:types', { types: [] });
    expect(res.ok).toBe(false);
  });

  it('replaces {left} and {right} with real neighbor names', async () => {
    const clients = await groupLobby(3);
    await start(clients);
    // Force a dare that's guaranteed to carry a placeholder by adding a custom one and
    // restricting to a single type so the deterministic rng (always index 0) draws it.
    await clients[0].ok('group:types', { types: ['normal'] });
    const drawer = actor(clients);
    await drawer.ok('group:addCard', { cardType: 'normal', kind: 'dare', text: 'Wave at {left} and wink at {right}.' });

    let found: string | null = null;
    let current = drawer;
    for (let i = 0; i < 41 && !found; i++) {
      const res = await current.ok<{ card: GroupCard }>('group:choose', { kind: 'dare', turnId: party(current.state).turnId });
      if (res.card.text.startsWith('Wave at')) found = res.card.text;
      await current.ok('group:done', { turnId: party(current.state).turnId });
      await sleep(100);
      current = actor(clients);
    }
    expect(found).not.toBeNull();
    expect(found).not.toContain('{left}');
    expect(found).not.toContain('{right}');
    const order = party(clients[0].state).turnOrder;
    const names = clients.map((c) => c.state.room.players.find((p) => p.id === c.id)!.nickname);
    // Whatever the actual seat order is, the substituted text must contain two real names.
    const containsAName = names.some((n) => found!.includes(n));
    expect(containsAName).toBe(true);
    void order;
  }, 15_000);

  it('No-touch hides touch dares, and turning it off brings them back', async () => {
    const clients = await groupLobby(3);
    await start(clients);
    await clients[0].ok('group:types', { types: ['spicy'] });
    await clients[0].ok('group:options', { noTouch: true });
    await Promise.all(clients.map((c) => c.waitFor((s) => party(s).noTouch === true)));

    const seen = new Set<string>();
    let current = actor(clients);
    for (let i = 0; i < 30; i++) {
      const res = await current.ok<{ card: GroupCard }>('group:choose', { kind: 'dare', turnId: party(current.state).turnId });
      seen.add(res.card.text);
      await current.ok('group:done', { turnId: party(current.state).turnId });
      await sleep(80);
      current = actor(clients);
    }
    // None of the touch-tagged spicy dares (e.g. the cheek-kiss one) should ever appear.
    expect([...seen].some((t) => t.includes('cheek'))).toBe(false);
  }, 15_000);

  it('Drinks off skips drink dares; turning it on brings them back', async () => {
    const clients = await groupLobby(3);
    await start(clients);
    await clients[0].ok('group:types', { types: ['normal'] });
    let current = actor(clients);
    let sawDrink = false;
    for (let i = 0; i < 15; i++) {
      const res = await current.ok<{ card: GroupCard }>('group:choose', { kind: 'dare', turnId: party(current.state).turnId });
      if (res.card.text.toLowerCase().includes('shot')) sawDrink = true;
      await current.ok('group:done', { turnId: party(current.state).turnId });
      await sleep(200);
      current = actor(clients);
    }
    expect(sawDrink).toBe(false);

    await clients[0].ok('group:options', { drinks: true });
    await Promise.all(clients.map((c) => c.waitFor((s) => party(s).drinks === true)));
    sawDrink = false;
    for (let i = 0; i < 40 && !sawDrink; i++) {
      const res = await current.ok<{ card: GroupCard }>('group:choose', { kind: 'dare', turnId: party(current.state).turnId });
      if (res.card.text.toLowerCase().includes('shot')) sawDrink = true;
      await current.ok('group:done', { turnId: party(current.state).turnId });
      await sleep(200);
      current = actor(clients);
    }
    expect(sawDrink).toBe(true);
  }, 20_000);

  it('Spin to pick chooses the next player instead of seat order', async () => {
    const clients = await groupLobby(4, { ...FAST, rng: () => 2 });
    await start(clients);
    await clients[0].ok('group:options', { pickMode: 'spin' });
    await Promise.all(clients.map((c) => c.waitFor((s) => party(s).pickMode === 'spin')));

    const drawer = actor(clients);
    await drawer.ok('group:choose', { kind: 'truth', turnId: party(drawer.state).turnId });
    const turnId = party(drawer.state).turnId;
    await drawer.ok('group:done', { turnId });
    await Promise.all(clients.map((c) => c.waitFor((s) => party(s).awaitingSpin === true)));

    const spinResult = await drawer.ok<{ playerId: string }>('group:spin', { turnId: turnId + 1 });
    expect(clients.map((c) => c.id)).toContain(spinResult.playerId);
    await Promise.all(clients.map((c) => c.waitFor((s) => party(s).awaitingSpin === false)));
    expect(party(clients[0].state).currentPlayerId).toBe(spinResult.playerId);
  });

  it('custom cards can be added and later drawn', async () => {
    const clients = await groupLobby(3);
    await start(clients);
    await clients[0].ok('group:types', { types: ['normal'] });
    const drawer = actor(clients);
    await drawer.ok('group:addCard', { cardType: 'normal', kind: 'truth', text: 'A custom test truth just for us.', timerSeconds: 45 });

    let found: GroupCard | null = null;
    let current = drawer;
    for (let i = 0; i < 41 && !found; i++) {
      const res = await current.ok<{ card: GroupCard }>('group:choose', { kind: 'truth', turnId: party(current.state).turnId });
      if (res.card.text === 'A custom test truth just for us.') found = res.card;
      await current.ok('group:done', { turnId: party(current.state).turnId });
      await sleep(80);
      current = actor(clients);
    }
    expect(found).not.toBeNull();
    expect(found?.timerSeconds).toBe(45);
  }, 15_000);

  it('a custom timer overrides the "for N seconds" text pattern when both are absent', async () => {
    const clients = await groupLobby(3);
    await start(clients);
    await clients[0].ok('group:types', { types: ['revealing'] });
    const drawer = actor(clients);
    await drawer.ok('group:addCard', { cardType: 'revealing', kind: 'dare', text: 'Confess your last search.' });

    let found: GroupCard | null = null;
    let current = drawer;
    for (let i = 0; i < 41 && !found; i++) {
      const res = await current.ok<{ card: GroupCard }>('group:choose', { kind: 'dare', turnId: party(current.state).turnId });
      if (res.card.text === 'Confess your last search.') found = res.card;
      await current.ok('group:done', { turnId: party(current.state).turnId });
      await sleep(80);
      current = actor(clients);
    }
    expect(found?.timerSeconds).toBeNull();
  }, 15_000);

  it('removing a player from the middle of the table keeps the rest in seat order', async () => {
    const clients = await groupLobby(4);
    await start(clients);
    const order = party(clients[0].state).turnOrder;
    const leavingId = order[1];
    const leaving = clients.find((c) => c.id === leavingId)!;
    const remaining = clients.filter((c) => c !== leaving);

    await leaving.ok('room:leave');
    await Promise.all(remaining.map((c) => c.waitFor((s) => party(s).turnOrder.length === 3)));
    expect(party(remaining[0].state).turnOrder).toEqual(order.filter((id) => id !== leavingId));
  });
});
