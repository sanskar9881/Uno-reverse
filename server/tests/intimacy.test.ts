import { afterEach, describe, expect, it } from 'vitest';
import type { ClientState, IntimacyCard, IntimacyView, JoinResult } from '@shared';
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

const party = (s: ClientState) => s.party as IntimacyView;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Pair {
  a: TestClient;
  b: TestClient;
}

async function intimacyLobby(options: RoomManagerOptions = FAST): Promise<Pair> {
  ts = await startTestServer(options);
  const a = await ts.client();
  const created = await a.ok<JoinResult>('room:create', { ...profile('Alex'), gameType: 'intimacy' });
  const b = await ts.client();
  await b.ok<JoinResult>('room:join', { ...profile('Blair'), roomCode: created.roomCode });
  await Promise.all([a, b].map((p) => p.waitFor((s) => s.room.players.length === 2)));
  return { a, b };
}

async function start(pair: Pair): Promise<void> {
  await pair.a.ok('game:start');
  await Promise.all([pair.a, pair.b].map((p) => p.waitFor((s) => s.room.status === 'playing' && s.party !== null)));
}

function current(pair: Pair): { first: TestClient; other: TestClient } {
  const first = party(pair.a.state).currentPartnerId === pair.a.id ? pair.a : pair.b;
  const other = first === pair.a ? pair.b : pair.a;
  return { first, other };
}

/** Whoever's turn it currently is. Draw-then-done alternates the turn every time, unlike Couples. */
const actor = (pair: Pair): TestClient => (party(pair.a.state).currentPartnerId === pair.a.id ? pair.a : pair.b);

describe('intimacy night online', () => {
  it('creates an intimacy room with the right game type and a 2-player cap', async () => {
    const pair = await intimacyLobby();
    expect(pair.a.state.room.gameType).toBe('intimacy');
    expect(pair.a.state.room.players.length).toBeLessThanOrEqual(2);
  });

  it('starts with every category included and both partners at Sweet', async () => {
    const pair = await intimacyLobby();
    await start(pair);
    expect(party(pair.a.state).categories.sort()).toEqual(['flirtyTalk', 'kiss', 'mood', 'romance', 'touch'].sort());
    expect(party(pair.a.state).levels[pair.a.id]).toBe('sweet');
  });

  it('draws a card for whoever is current, and both partners see the same card', async () => {
    const pair = await intimacyLobby();
    await start(pair);
    const { first, other } = current(pair);

    const res = await first.ok<{ card: IntimacyCard }>('intimacy:draw', { turnId: party(first.state).turnId });
    expect(res.card.level).toBe('sweet');
    await other.waitFor((s) => party(s).card?.text === res.card.text);
    expect(party(other.state).card).toEqual(res.card);
  });

  it('only the current partner can draw, and rejects a stale turnId', async () => {
    const pair = await intimacyLobby();
    await start(pair);
    const { first, other } = current(pair);

    const badTurn = await other.send('intimacy:draw', { turnId: party(other.state).turnId });
    expect(badTurn.ok).toBe(false);
    if (!badTurn.ok) expect(badTurn.error.code).toBe('NOT_YOUR_TURN');

    const stale = await first.send('intimacy:draw', { turnId: party(first.state).turnId + 9 });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('STALE_ACTION');
  });

  it('Done passes the turn to the other partner and clears the card', async () => {
    const pair = await intimacyLobby();
    await start(pair);
    const { first, other } = current(pair);

    await first.ok('intimacy:draw', { turnId: party(first.state).turnId });
    const turnId = party(first.state).turnId;
    await first.ok('intimacy:done', { turnId });
    await Promise.all([first, other].map((p) => p.waitFor((s) => party(s).currentPartnerId === other.id)));
    expect(party(other.state).card).toBeNull();
    expect(party(other.state).turnId).toBe(turnId + 1);
  });

  it('plays at the lower of the two levels', async () => {
    const pair = await intimacyLobby();
    await start(pair);
    const { first, other } = current(pair);

    await first.ok('intimacy:level', { level: 'spicy' });
    // other stays at the default 'sweet'
    await first.waitFor((s) => party(s).levels[first.id] === 'spicy');
    const res = await first.ok<{ card: IntimacyCard }>('intimacy:draw', { turnId: party(first.state).turnId });
    expect(res.card.level).toBe('sweet');
    void other;
  });

  it('only draws from the categories currently included', async () => {
    const pair = await intimacyLobby();
    await start(pair);
    await pair.a.ok('intimacy:categories', { categories: ['kiss'] });
    await pair.b.waitFor((s) => party(s).categories.length === 1);
    for (let i = 0; i < 5; i++) {
      const drawer = actor(pair);
      const res = await drawer.ok<{ card: IntimacyCard }>('intimacy:draw', { turnId: party(drawer.state).turnId });
      expect(res.card.category).toBe('kiss');
      await sleep(150);
      await drawer.ok('intimacy:done', { turnId: party(drawer.state).turnId });
      await sleep(150);
    }
  }, 15_000);

  it('rejects an empty category list', async () => {
    const pair = await intimacyLobby();
    await start(pair);
    const res = await pair.a.send('intimacy:categories', { categories: [] });
    expect(res.ok).toBe(false);
  });

  it('the deck does not repeat a card until the pool is exhausted, within one category', async () => {
    const pair = await intimacyLobby();
    await start(pair);
    await pair.a.ok('intimacy:categories', { categories: ['kiss'] });
    await pair.b.waitFor((s) => party(s).categories.length === 1);
    const seen = new Set<string>();
    let repeats = 0;
    // Sweet kiss has 10 unique entries.
    for (let i = 0; i < 10; i++) {
      const drawer = actor(pair);
      const res = await drawer.ok<{ card: IntimacyCard }>('intimacy:draw', { turnId: party(drawer.state).turnId });
      if (seen.has(res.card.text)) repeats++;
      seen.add(res.card.text);
      await drawer.ok('intimacy:done', { turnId: party(drawer.state).turnId });
      await sleep(150);
    }
    expect(repeats).toBe(0);
    expect(seen.size).toBe(10);
  }, 15_000);

  it('custom cards can be added and later drawn', async () => {
    const pair = await intimacyLobby();
    await start(pair);
    await pair.a.ok('intimacy:categories', { categories: ['kiss'] });
    await pair.b.waitFor((s) => party(s).categories.length === 1);
    const { first } = current(pair);
    await first.ok('intimacy:addCard', { level: 'sweet', category: 'kiss', text: 'A custom test kiss just for us.' });

    let found = false;
    for (let i = 0; i < 11 && !found; i++) {
      const drawer = actor(pair);
      const res = await drawer.ok<{ card: IntimacyCard }>('intimacy:draw', { turnId: party(drawer.state).turnId });
      if (res.card.text === 'A custom test kiss just for us.') found = true;
      await drawer.ok('intimacy:done', { turnId: party(drawer.state).turnId });
      await sleep(150);
    }
    expect(found).toBe(true);
  }, 15_000);

  it('"Play only our cards" draws only from Our Deck, and errors when it is empty', async () => {
    const pair = await intimacyLobby();
    await start(pair);
    await pair.a.ok('intimacy:categories', { categories: ['kiss'] });
    await pair.b.waitFor((s) => party(s).categories.length === 1);
    const { first } = current(pair);

    await first.ok('intimacy:onlyOurs', { value: true });
    await first.waitFor((s) => party(s).onlyOurs === true);
    const empty = await first.send('intimacy:draw', { turnId: party(first.state).turnId });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error.code).toBe('INVALID_STATE');

    await first.ok('intimacy:addCard', { level: 'sweet', category: 'kiss', text: 'Only ours.' });
    const res = await first.ok<{ card: IntimacyCard }>('intimacy:draw', { turnId: party(first.state).turnId });
    expect(res.card.text).toBe('Only ours.');
  });
});
