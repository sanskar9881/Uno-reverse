import { create } from 'zustand';
import type { ClientState, SessionEndReason } from '@shared';
import type { ConnectionStatus, Profile } from '../types';
import { loadProfile, saveProfile } from '../utils/storage';

interface GameStore {
  connection: ConnectionStatus;
  /** True once this socket connection has claimed a seat (create/join/rejoin succeeded). */
  bound: boolean;
  rejoining: boolean;
  state: ClientState | null;
  /** serverTime − local time, used to render server deadlines correctly. */
  clockOffset: number;
  ended: { reason: SessionEndReason; message: string } | null;
  /** Some action is waiting for the server; blocks double submits. */
  busy: boolean;
  profile: Profile;

  setConnection(status: ConnectionStatus): void;
  setBound(bound: boolean): void;
  setRejoining(value: boolean): void;
  receive(state: ClientState): void;
  setEnded(ended: GameStore['ended']): void;
  setBusy(busy: boolean): void;
  updateProfile(patch: Partial<Profile>): void;
  reset(): void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  connection: 'connecting',
  bound: false,
  rejoining: false,
  state: null,
  clockOffset: 0,
  ended: null,
  busy: false,
  profile: loadProfile(),

  setConnection: (connection) => set({ connection }),
  setBound: (bound) => set({ bound }),
  setRejoining: (rejoining) => set({ rejoining }),
  receive(state) {
    const measured = state.serverTime - Date.now();
    const previous = get().clockOffset;
    // Smooth out network jitter; jump immediately on the first sample or a big correction.
    const clockOffset = previous === 0 || Math.abs(measured - previous) > 2000 ? measured : previous * 0.8 + measured * 0.2;
    set({ state, clockOffset });
  },
  setEnded: (ended) => set({ ended }),
  setBusy: (busy) => set({ busy }),
  updateProfile(patch) {
    const profile = { ...get().profile, ...patch };
    saveProfile(profile);
    set({ profile });
  },
  reset: () => set({ bound: false, rejoining: false, state: null, ended: null, busy: false }),
}));

export const serverNow = (): number => Date.now() + useGameStore.getState().clockOffset;
