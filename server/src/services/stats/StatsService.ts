export interface RoundParticipant {
  profileId: string;
  nickname: string;
}

export interface RoundRecord {
  participants: RoundParticipant[];
  winnerProfileId: string | null;
  points: number;
}

export interface PlayerStats {
  nickname: string;
  gamesPlayed: number;
  wins: number;
  points: number;
  lastPlayedAt: string | null;
}

export type LeaderboardEntry = Omit<PlayerStats, 'lastPlayedAt'>;

/**
 * Long-lived player statistics. Only finished rounds are recorded — never
 * individual moves — and live game state never touches this service.
 */
export interface StatsService {
  readonly kind: 'memory' | 'mongodb';
  recordRound(record: RoundRecord): Promise<void>;
  getPlayerStats(profileId: string): Promise<PlayerStats | null>;
  getLeaderboard(limit?: number): Promise<LeaderboardEntry[]>;
  close(): Promise<void>;
}

/** Same browser in two tabs shares a profile id; count it once per round. */
export function dedupeParticipants(participants: RoundParticipant[]): RoundParticipant[] {
  const seen = new Map<string, RoundParticipant>();
  for (const p of participants) if (!seen.has(p.profileId)) seen.set(p.profileId, p);
  return [...seen.values()];
}
