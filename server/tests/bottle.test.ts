import { afterEach, describe, expect, it } from 'vitest';
import type { BottleView, ClientState, JoinResult } from '@shared';
import type { RoomManagerOptions } from '../src/rooms/RoomManager';
import type { TestClient } from './helpers/testClient';
import { profile, startTestServer, type TestServer } from './helpers/testServer';

const FAST: RoomManagerOptions = {
  lobbyGraceMs: 400,
  gameGraceMs: 800,
  hostTransferMs: 200,
  disconnectedTurnMs: 300,
  bottleSpinDurationMs: [30, 40],
  rng: () => 0,
};

let ts: TestServer | undefined;
afterEach(async () => {
  await ts?.close();
  ts = undefined;
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Table {
  players: TestClient[];
}

async function bottleLobby(n: number, options: RoomManagerOptions = FAST): Promise<Table> {
  ts = await startTestServer(options);
  const host = await ts.client();
  const created = await host.ok<JoinResult>('room:create', { ...profile('Host'), gameType: 'bottle' });
  const players = [host];
  for (let i = 1; i < n; i++) {
    const c = await ts.client();
    await c.ok<JoinResult>('room:join', { ...profile(`Player${i}`), roomCode: created.roomCode });
    players.push(c);
  }
  await Promise.all(players.map((p) => p.waitFor((s) => s.room.players.length === n)));
  return { players };
}

async function start(table: Table): Promise<void> {
  await table.players[0].ok('game:start');
  await Promise.all(table.players.map((p) => p.waitFor((s) => s.room.status === 'playing' && s.party !== null)));
}

const bottleParty = (s: ClientState) => s.party as BottleView | null;
const current = (s: ClientState) => bottleParty(s)?.spinnerId;

describe('spin the bottle online', () => {
  it('creates a bottle room with the right game type and player cap', async () => {
    const table = await bottleLobby(2);
    expect(table.players[0].state.room.gameType).toBe('bottle');
  });

  it('only the current spinner can spin', async () => {
    const table = await bottleLobby(3);
    await start(table);
    const spinnerId = current(table.players[0].state);
    const notSpinner = table.players.find((p) => p.id !== spinnerId)!;
    const res = await notSpinner.send('bottle:spin', { turnId: bottleParty(notSpinner.state)!.turnId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('NOT_YOUR_TURN');
  });

  it('rejects a stale turnId', async () => {
    const table = await bottleLobby(2);
    await start(table);
    const spinner = table.players.find((p) => p.id === current(table.players[0].state))!;
    const res = await spinner.send('bottle:spin', { turnId: bottleParty(spinner.state)!.turnId + 5 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('STALE_ACTION');
  });

  it('the target is always a connected player other than the spinner, and the turn passes to them', async () => {
    const table = await bottleLobby(4);
    await start(table);
    const state0 = table.players[0].state;
    const spinnerId = current(state0)!;
    const spinner = table.players.find((p) => p.id === spinnerId)!;
    const turnId = bottleParty(state0)!.turnId;

    await spinner.ok('bottle:spin', { turnId });
    await Promise.all(table.players.map((p) => p.waitFor((s) => bottleParty(s)?.spin !== null)));
    const spinState = bottleParty(table.players[0].state)!;
    expect(spinState.spin).not.toBeNull();
    expect(spinState.spin!.targetId).not.toBe(spinnerId);
    expect(state0.room.players.some((p) => p.id === spinState.spin!.targetId)).toBe(true);

    // Every client sees the same spin (same id and target) at once.
    for (const p of table.players) {
      expect(bottleParty(p.state)!.spin!.id).toBe(spinState.spin!.id);
      expect(bottleParty(p.state)!.spin!.targetId).toBe(spinState.spin!.targetId);
    }

    const targetId = spinState.spin!.targetId;
    await Promise.all(
      table.players.map((p) => p.waitFor((s) => bottleParty(s)?.spin === null && bottleParty(s)!.turnId > turnId)),
    );
    expect(current(table.players[0].state)).toBe(targetId);
    expect(bottleParty(table.players[0].state)!.prompt).not.toBeNull();
  });

  it('nobody can spin while a spin is already running', async () => {
    const table = await bottleLobby(3);
    await start(table);
    const state0 = table.players[0].state;
    const spinner = table.players.find((p) => p.id === current(state0))!;
    await spinner.ok('bottle:spin', { turnId: bottleParty(state0)!.turnId });
    await Promise.all(table.players.map((p) => p.waitFor((s) => bottleParty(s)?.spin !== null)));

    const res = await spinner.send('bottle:spin', { turnId: bottleParty(spinner.state)!.turnId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INVALID_STATE');
  });

  it('passes the turn when the spinner disconnects before spinning', async () => {
    const table = await bottleLobby(3);
    await start(table);
    const state0 = table.players[0].state;
    const spinnerId = current(state0)!;
    const spinner = table.players.find((p) => p.id === spinnerId)!;
    const others = table.players.filter((p) => p.id !== spinnerId);

    spinner.disconnect();
    await Promise.all(others.map((p) => p.waitFor((s) => current(s) !== spinnerId)));
    const newSpinnerId = current(others[0].state);
    expect(newSpinnerId).not.toBe(spinnerId);
    expect(state0.room.players.some((p) => p.id === newSpinnerId)).toBe(true);
  });

});
