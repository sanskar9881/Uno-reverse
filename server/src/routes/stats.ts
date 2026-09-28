import { Router } from 'express';
import { UUID_REGEX } from '@shared';
import type { StatsService } from '../services/stats/StatsService';
import { KeyedRateLimiter } from '../utils/rateLimiter';

/** Read-only stats endpoints. Stats are only ever written by the server when a round ends. */
export function createStatsRouter(stats: StatsService): Router {
  const router = Router();
  const limiter = new KeyedRateLimiter({ capacity: 30, refillPerSecond: 1 });

  router.use((req, res, next) => {
    if (!limiter.tryTake(req.ip ?? 'unknown')) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    next();
  });

  router.get('/stats/:profileId', async (req, res) => {
    const { profileId } = req.params;
    if (!UUID_REGEX.test(profileId)) {
      res.status(400).json({ error: 'Invalid profile id' });
      return;
    }
    const found = await stats.getPlayerStats(profileId);
    res.json(found ?? { nickname: null, gamesPlayed: 0, wins: 0, points: 0, lastPlayedAt: null });
  });

  router.get('/leaderboard', async (_req, res) => {
    res.json({ entries: await stats.getLeaderboard(10), backend: stats.kind });
  });

  return router;
}
