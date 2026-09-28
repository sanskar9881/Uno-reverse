import { logger } from '../../utils/logger';
import { MemoryStatsService } from './MemoryStatsService';
import { MongoStatsService } from './MongoStatsService';
import type { StatsService } from './StatsService';

export type { StatsService, PlayerStats, LeaderboardEntry, RoundRecord } from './StatsService';
export { MemoryStatsService } from './MemoryStatsService';

/** MongoDB when MONGODB_URI is set and reachable; otherwise in-memory so the game always boots. */
export async function createStatsService(mongoUri: string | null): Promise<StatsService> {
  if (!mongoUri) {
    logger.info('Stats: using in-memory store (set MONGODB_URI to persist stats)');
    return new MemoryStatsService();
  }
  try {
    const service = await MongoStatsService.connect(mongoUri);
    logger.info('Stats: connected to MongoDB');
    return service;
  } catch (error) {
    logger.warn('Stats: could not connect to MongoDB, falling back to in-memory store', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new MemoryStatsService();
  }
}
