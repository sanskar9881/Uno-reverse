import mongoose, { Schema, type Connection, type Model } from 'mongoose';
import {
  dedupeParticipants,
  type LeaderboardEntry,
  type PlayerStats,
  type RoundRecord,
  type StatsService,
} from './StatsService';

interface PlayerStatsDoc {
  profileId: string;
  nickname: string;
  gamesPlayed: number;
  wins: number;
  points: number;
  lastPlayedAt: Date | null;
}

const playerStatsSchema = new Schema<PlayerStatsDoc>(
  {
    profileId: { type: String, required: true, unique: true },
    nickname: { type: String, required: true, maxlength: 32 },
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    lastPlayedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'player_stats' },
);
playerStatsSchema.index({ wins: -1, points: -1 });

/** One small document per player profile, updated once per finished round. */
export class MongoStatsService implements StatsService {
  readonly kind = 'mongodb' as const;

  private constructor(
    private readonly connection: Connection,
    private readonly PlayerStatsModel: Model<PlayerStatsDoc>,
  ) {}

  static async connect(uri: string): Promise<MongoStatsService> {
    const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
    const model = connection.model<PlayerStatsDoc>('PlayerStats', playerStatsSchema);
    await model.init();
    return new MongoStatsService(connection, model);
  }

  async recordRound(record: RoundRecord): Promise<void> {
    const participants = dedupeParticipants(record.participants);
    if (participants.length === 0) return;
    const now = new Date();
    await this.PlayerStatsModel.bulkWrite(
      participants.map((p) => {
        const won = p.profileId === record.winnerProfileId;
        return {
          updateOne: {
            filter: { profileId: p.profileId },
            update: {
              $set: { nickname: p.nickname, lastPlayedAt: now },
              $inc: { gamesPlayed: 1, wins: won ? 1 : 0, points: won ? record.points : 0 },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
  }

  async getPlayerStats(profileId: string): Promise<PlayerStats | null> {
    const doc = await this.PlayerStatsModel.findOne({ profileId }).lean();
    if (!doc) return null;
    return {
      nickname: doc.nickname,
      gamesPlayed: doc.gamesPlayed,
      wins: doc.wins,
      points: doc.points,
      lastPlayedAt: doc.lastPlayedAt ? new Date(doc.lastPlayedAt).toISOString() : null,
    };
  }

  async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    const docs = await this.PlayerStatsModel.find({ wins: { $gt: 0 } })
      .sort({ wins: -1, points: -1, gamesPlayed: 1 })
      .limit(limit)
      .select({ nickname: 1, gamesPlayed: 1, wins: 1, points: 1, _id: 0 })
      .lean();
    return docs.map((d) => ({ nickname: d.nickname, gamesPlayed: d.gamesPlayed, wins: d.wins, points: d.points }));
  }

  async close(): Promise<void> {
    await this.connection.close();
  }
}
