import type { RoomSettings, RoomStatus, RoundResult } from '@shared';
import type { GameState } from '../game/engine';

/** Server-side player record. `token` and `profileId` never leave the server except to their owner. */
export interface PlayerRecord {
  id: string;
  token: string;
  nickname: string;
  avatar: number;
  /** Anonymous browser profile id, used only for stats. */
  profileId: string | null;
  socketId: string | null;
  connected: boolean;
  joinedAt: number;
  disconnectedAt: number | null;
}

/**
 * A room is plain JSON (no sockets, no timers) so the whole thing can be moved
 * into Redis or a database later. Timers live in RoomManager.
 */
export interface Room {
  code: string;
  hostId: string;
  /** Join order = seat order. */
  players: PlayerRecord[];
  settings: RoomSettings;
  status: RoomStatus;
  game: GameState | null;
  scores: Record<string, number>;
  roundNumber: number;
  lastRound: RoundResult | null;
  /** Epoch ms when the current turn auto-ends (0 = no timer running). */
  turnEndsAt: number;
  turnDurationMs: number;
  /** Random offset so the first round doesn't always start with the host; rotates each round. */
  starterSeed: number;
  createdAt: number;
  lastActivityAt: number;
}
