import type { GameType, JoinResult } from '@shared';
import { reactToState } from '../game/feedback';
import { playSound, setMuted, unlockAudio } from '../game/sounds';
import { useGameStore } from '../store/gameStore';
import { clearSession, saveSession } from '../utils/storage';
import type { Profile, StoredSession } from '../types';
import { ensureConnected, request, socket, type RequestResult } from './socket';

let started = false;
let failures = 0;

/** Wires socket events into the store once, then connects. */
export function startSocket(): void {
  if (started) return;
  started = true;
  const store = useGameStore.getState;

  setMuted(store().profile.muted);
  const unlock = () => unlockAudio();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  socket.on('connect', () => {
    failures = 0;
    store().setConnection('connected');
  });
  socket.on('disconnect', (reason) => {
    store().setBound(false);
    // A server-initiated disconnect doesn't auto-reconnect, so kick it off ourselves.
    if (reason === 'io server disconnect') socket.connect();
    store().setConnection('reconnecting');
  });
  socket.on('connect_error', () => {
    failures += 1;
    if (store().connection !== 'reconnecting') store().setConnection(failures >= 4 ? 'offline' : 'connecting');
  });
  socket.on('state', (next) => {
    const prev = store().state;
    store().receive(next);
    reactToState(prev, next);
  });
  socket.on('session:ended', (payload) => {
    store().setBound(false);
    store().setEnded(payload);
    if (payload.reason !== 'replaced') clearSession();
    playSound('leave');
  });

  socket.connect();
}

const profilePayload = (p: Profile) => ({ nickname: p.nickname.trim(), avatar: p.avatar, profileId: p.profileId });

async function claimSeat(run: () => Promise<RequestResult<JoinResult>>): Promise<RequestResult<JoinResult>> {
  if (!(await ensureConnected())) {
    return { ok: false, error: { code: 'NETWORK', message: "Couldn't reach the game server. Try again in a moment." } };
  }
  const res = await run();
  if (res.ok) {
    saveSession({ roomCode: res.roomCode, playerId: res.playerId, token: res.token });
    useGameStore.getState().setEnded(null);
    useGameStore.getState().setBound(true);
  }
  return res;
}

export const createRoom = (profile: Profile, gameType?: GameType) =>
  claimSeat(() => request('room:create', { ...profilePayload(profile), gameType }, 10_000));

export const joinRoom = (roomCode: string, profile: Profile) =>
  claimSeat(() => request('room:join', { ...profilePayload(profile), roomCode }, 10_000));

let rejoinInFlight: Promise<RequestResult<{ roomCode: string; playerId: string }>> | null = null;

/** Reclaims this tab's seat after a refresh or reconnect. Safe to call repeatedly. */
export function rejoin(session: StoredSession): Promise<RequestResult<{ roomCode: string; playerId: string }>> {
  if (rejoinInFlight) return rejoinInFlight;
  const store = useGameStore.getState();
  store.setRejoining(true);
  rejoinInFlight = request('room:rejoin', { roomCode: session.roomCode, token: session.token }, 10_000)
    .then((res) => {
      if (res.ok) {
        useGameStore.getState().setEnded(null);
        useGameStore.getState().setBound(true);
      } else if (res.error.code !== 'NETWORK' && res.error.code !== 'RATE_LIMITED') {
        clearSession();
      }
      return res;
    })
    .finally(() => {
      rejoinInFlight = null;
      useGameStore.getState().setRejoining(false);
    });
  return rejoinInFlight;
}
