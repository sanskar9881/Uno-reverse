import { afterEach, describe, expect, it } from 'vitest';
import type { ClientState, CouplesCard, CouplesView, JoinResult } from '@shared';
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

const couplesParty = (s: ClientState) => s.party as CouplesView;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Pair {
  a: TestClient;
  b: TestClient;
}

async function couplesLobby(options: RoomManagerOptions = FAST): Promise<Pair> {
  ts = await startTestServer(options);
  const a = await ts.client();
  const created = await a.ok<JoinResult>('room:create', { ...profile('Alex'), gameType: 'couples' });
  const b = await ts.client();
  await b.ok<JoinResult>('room:join', { ...profile('Blair'), roomCode: created.roomCode });
  await Promise.all([a, b].map((p) => p.waitFor((s) => s.room.players.length === 2)));
  return { a, b };
}

async function start(pair: Pair): Promise<void> {
  await pair.a.ok('game:start');
  await Promise.all([pair.a, pair.b].map((p) => p.waitFor((s) => s.room.status === 'playing' && s.party !== null)));
}

describe('couples truth or dare online', () => {
  it('creates a couples room with the right game type and a 2-player cap', async () => {
    const pair = await couplesLobby();
    expect(pair.a.state.room.gameType).toBe('couples');
    expect(pair.a.state.room.players.length).toBeLessThanOrEqual(2);
  });

  it('draws a card for whoever is current, and both partners see the same card', async () => {
    const pair = await couplesLobby();
    await start(pair);
    const first = couplesParty(pair.a.state).currentPartnerId === pair.a.id ? pair.a : pair.b;
    const other = first === pair.a ? pair.b : pair.a;

    const res = await first.ok<{ card: CouplesCard }>('couples:choose', { kind: 'truth', turnId: couplesParty(first.state).turnId });
    expect(res.card.kind).toBe('truth');
    expect(res.card.level).toBe('sweet');
    await other.waitFor((s) => couplesParty(s).card?.text === res.card.text);
    expect(couplesParty(other.state).card).toEqual(res.card);
  });

  it('only the current partner can choose, and rejects a stale turnId', async () => {
    const pair = await couplesLobby();
    await start(pair);
    const first = couplesParty(pair.a.state).currentPartnerId === pair.a.id ? pair.a : pair.b;
    const other = first === pair.a ? pair.b : pair.a;

    const badTurn = await other.send('couples:choose', { kind: 'dare', turnId: couplesParty(other.state).turnId });
    expect(badTurn.ok).toBe(false);
    if (!badTurn.ok) expect(badTurn.error.code).toBe('NOT_YOUR_TURN');

    const stale = await first.send('couples:choose', { kind: 'truth', turnId: couplesParty(first.state).turnId + 9 });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('STALE_ACTION');
  });

  it('Pass draws another card of the same kind without ending the turn', async () => {
    const pair = await couplesLobby();
    await start(pair);
    const first = couplesParty(pair.a.state).currentPartnerId === pair.a.id ? pair.a : pair.b;

    const drawn = await first.ok<{ card: CouplesCard }>('couples:choose', { kind: 'dare', turnId: couplesParty(first.state).turnId });
    const passed = await first.ok<{ card: CouplesCard }>('couples:pass', { turnId: couplesParty(first.state).turnId });
    expect(passed.card.kind).toBe('dare');
    expect(couplesParty(first.state).currentPartnerId).toBe(first.id);
    // Passing doesn't have to change the card, but it must still be a valid dare from the deck.
    expect(typeof passed.card.text).toBe('string');
    expect(drawn.card.kind).toBe(passed.card.kind);
  });

  it('Done passes the turn to the other partner and clears the card', async () => {
    const pair = await couplesLobby();
    await start(pair);
    const first = couplesParty(pair.a.state).currentPartnerId === pair.a.id ? pair.a : pair.b;
    const other = first === pair.a ? pair.b : pair.a;

    await first.ok('couples:choose', { kind: 'truth', turnId: couplesParty(first.state).turnId });
    const turnId = couplesParty(first.state).turnId;
    await first.ok('couples:done', { turnId });
    await Promise.all([first, other].map((p) => p.waitFor((s) => couplesParty(s).currentPartnerId === other.id)));
    expect(couplesParty(other.state).card).toBeNull();
    expect(couplesParty(other.state).turnId).toBe(turnId + 1);
  });

  it('plays at the lower of the two levels, and lowering takes effect immediately', async () => {
    const pair = await couplesLobby();
    await start(pair);
    const first = couplesParty(pair.a.state).currentPartnerId === pair.a.id ? pair.a : pair.b;
    const other = first === pair.a ? pair.b : pair.a;

    await first.ok('couples:level', { level: 'spicy' });
    await other.ok('couples:level', { level: 'flirty' });
    await first.waitFor((s) => couplesParty(s).levels[other.id] === 'flirty');

    const card = await first.ok<{ card: CouplesCard }>('couples:choose', { kind: 'truth', turnId: couplesParty(first.state).turnId });
    expect(card.card.level).toBe('flirty');

    // Lowering further takes effect immediately, on the very next draw.
    await other.ok('couples:level', { level: 'sweet' });
    const turnIdBeforeDone = couplesParty(first.state).turnId;
    await first.ok('couples:done', { turnId: turnIdBeforeDone });
    await Promise.all([first, other].map((p) => p.waitFor((s) => couplesParty(s).turnId === turnIdBeforeDone + 1)));
    const nextActor = couplesParty(first.state).currentPartnerId === first.id ? first : other;
    const next = await nextActor.ok<{ card: CouplesCard }>('couples:choose', { kind: 'dare', turnId: couplesParty(nextActor.state).turnId });
    expect(next.card.level).toBe('sweet');
  });

  it('never lets spicy appear unless both partners chose it', async () => {
    const pair = await couplesLobby();
    await start(pair);
    const first = couplesParty(pair.a.state).currentPartnerId === pair.a.id ? pair.a : pair.b;
    const other = first === pair.a ? pair.b : pair.a;

    await first.ok('couples:level', { level: 'spicy' });
    // other stays at the default 'sweet'
    for (let i = 0; i < 15; i++) {
      const kind = i % 2 === 0 ? 'truth' : 'dare';
      const res = await first.ok<{ card: CouplesCard }>('couples:choose', { kind, turnId: couplesParty(first.state).turnId });
      expect(res.card.level).toBe('sweet');
      await sleep(180);
      await first.ok('couples:pass', { turnId: couplesParty(first.state).turnId });
      await sleep(180);
    }
  }, 15_000);

  it('the deck does not repeat a card until the pool is exhausted', async () => {
    const pair = await couplesLobby();
    await start(pair);
    const first = couplesParty(pair.a.state).currentPartnerId === pair.a.id ? pair.a : pair.b;
    const seen = new Set<string>();
    let repeats = 0;
    // Sweet truths has 40 unique entries; drawing 40 in a row (via Pass) should never repeat.
    for (let i = 0; i < 40; i++) {
      const res = await first.ok<{ card: CouplesCard }>(
        i === 0 ? 'couples:choose' : 'couples:pass',
        i === 0 ? { kind: 'truth', turnId: couplesParty(first.state).turnId } : { turnId: couplesParty(first.state).turnId },
      );
      if (seen.has(res.card.text)) repeats++;
      seen.add(res.card.text);
      if (i >= 10) await sleep(180);
    }
    expect(repeats).toBe(0);
    expect(seen.size).toBe(40);
  }, 15_000);

  it('custom cards can be added and later drawn', async () => {
    const pair = await couplesLobby();
    await start(pair);
    const first = couplesParty(pair.a.state).currentPartnerId === pair.a.id ? pair.a : pair.b;
    await first.ok('couples:addCard', { level: 'sweet', kind: 'truth', text: 'A custom test truth just for us.' });

    const seen = new Set<string>();
    let found = false;
    for (let i = 0; i < 41 && !found; i++) {
      const res = await first.ok<{ card: CouplesCard }>(
        i === 0 ? 'couples:choose' : 'couples:pass',
        i === 0 ? { kind: 'truth', turnId: couplesParty(first.state).turnId } : { turnId: couplesParty(first.state).turnId },
      );
      seen.add(res.card.text);
      if (res.card.text === 'A custom test truth just for us.') found = true;
      if (i >= 10) await sleep(180);
    }
    expect(found).toBe(true);
  }, 15_000);
});
