import {
  dedupeParticipants,
  type LeaderboardEntry,
  type PlayerStats,
  type RoundRecord,
  type StatsService,
} from './StatsService';

const MAX_PROFILES = 50_000;

/** Default stats backend: works with zero setup, resets when the server restarts. */
export class MemoryStatsService implements StatsService {
  readonly kind = 'memory' as const;
  private readonly profiles = new Map<string, PlayerStats>();

  async recordRound(record: RoundRecord): Promise<void> {
    const now = new Date().toISOString();
    for (const p of dedupeParticipants(record.participants)) {
      const won = p.profileId === record.winnerProfileId;
      const current = this.profiles.get(p.profileId) ?? {
        nickname: p.nickname,
        gamesPlayed: 0,
        wins: 0,
        points: 0,
        lastPlayedAt: null,
      };
      this.profiles.delete(p.profileId); // re-insert to keep Map in recency order
      this.profiles.set(p.profileId, {
        nickname: p.nickname,
        gamesPlayed: current.gamesPlayed + 1,
        wins: current.wins + (won ? 1 : 0),
        points: current.points + (won ? record.points : 0),
        lastPlayedAt: now,
      });
    }
    while (this.profiles.size > MAX_PROFILES) {
      const oldest = this.profiles.keys().next().value;
      if (oldest === undefined) break;
      this.profiles.delete(oldest);
    }
  }

  async getPlayerStats(profileId: string): Promise<PlayerStats | null> {
    const stats = this.profiles.get(profileId);
    return stats ? { ...stats } : null;
  }

  async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    return [...this.profiles.values()]
      .filter((p) => p.wins > 0)
      .sort((a, b) => b.wins - a.wins || b.points - a.points || a.gamesPlayed - b.gamesPlayed)
      .slice(0, limit)
      .map(({ nickname, gamesPlayed, wins, points }) => ({ nickname, gamesPlayed, wins, points }));
  }

  async close(): Promise<void> {}
}
