import type { BottlePartySettings, GameType, RoomSettings, RoomStatus, RoundResult } from '@shared';
import type { GameState } from '../game/engine';
import type { BottleState } from '../games/bottle/engine';
import type { CouplesState } from '../games/couples/engine';
import type { IntimacyState } from '../games/intimacy/engine';

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
  gameType: GameType;
  /** Join order = seat order. */
  players: PlayerRecord[];
  settings: RoomSettings;
  status: RoomStatus;
  game: GameState | null;
  /** Lobby-editable options for a non-UNO game, e.g. the bottle's prompt pack. Unused by UNO rooms. */
  partySettings: BottlePartySettings;
  /** Live state for a non-UNO game once it has started. Always null in a UNO room. */
  party: BottleState | CouplesState | IntimacyState | null;
  scores: Record<string, number>;
  roundNumber: number;
  lastRound: RoundResult | null;
  /** Epoch ms when the current turn auto-ends (0 = no timer running). Doubles as the Wild +4 challenge deadline. */
  turnEndsAt: number;
  turnDurationMs: number;
  /**
   * The one deliberate exception to hand privacy: right after a Wild +4 challenge,
   * `revealViewerId` briefly sees `revealOwnerId`'s hand (0 = no reveal running).
   */
  revealViewerId: string | null;
  revealOwnerId: string | null;
  revealEndsAt: number;
  /** Random offset so the first round doesn't always start with the host; rotates each round. */
  starterSeed: number;
  createdAt: number;
  lastActivityAt: number;
}
