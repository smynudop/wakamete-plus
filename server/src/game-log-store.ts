import type { Collection, Db, WithId } from "mongodb";
import type {
  ArchivedGameLog,
  ArchivedGameSummary,
  GameLogEntry
} from "@wakamete-plus/shared";

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

type GameDocument = ArchivedGameSummary;
type LogDocument = GameLogEntry & {
  roomId: string;
  order: number;
};

export interface GameLogRepository {
  save(log: ArchivedGameLog): Promise<void>;
  find(roomId: string): Promise<ArchivedGameLog | null>;
  list(): Promise<ArchivedGameSummary[]>;
}

export class MongoGameLogStore implements GameLogRepository {
  private readonly games: Collection<GameDocument>;
  private readonly logs: Collection<LogDocument>;

  constructor(database: Db) {
    this.games = database.collection<GameDocument>("game");
    this.logs = database.collection<LogDocument>("log");
  }

  async createIndexes(): Promise<void> {
    await Promise.all([
      this.games.createIndex({ roomId: 1 }, { unique: true }),
      this.games.createIndex({ endedAt: -1 }),
      this.logs.createIndex({ roomId: 1, order: 1 }, { unique: true })
    ]);
  }

  async save(log: ArchivedGameLog): Promise<void> {
    validateRoomId(log.roomId);
    const { entries, ...game } = log;
    const operations = entries.map((entry, order) => ({
      replaceOne: {
        filter: { roomId: log.roomId, order },
        replacement: { ...entry, roomId: log.roomId, order },
        upsert: true
      }
    }));

    if (operations.length > 0) {
      await this.logs.bulkWrite(operations);
    }
    await this.logs.deleteMany({ roomId: log.roomId, order: { $gte: entries.length } });
    await this.games.replaceOne({ roomId: log.roomId }, game, { upsert: true });
  }

  async find(roomId: string): Promise<ArchivedGameLog | null> {
    validateRoomId(roomId);
    const game = await this.games.findOne({ roomId });
    if (!game) {
      return null;
    }
    const entries = await this.logs.find({ roomId }).sort({ order: 1 }).toArray();
    return {
      ...withoutMongoId(game),
      entries: entries.map(({ roomId: _roomId, order: _order, _id: _id, ...entry }) => entry)
    };
  }

  async list(): Promise<ArchivedGameSummary[]> {
    const games = await this.games.find().sort({ endedAt: -1 }).toArray();
    return games.map(withoutMongoId);
  }
}

function validateRoomId(roomId: string): void {
  if (!ROOM_ID_PATTERN.test(roomId)) {
    throw new Error("不正なルームIDです。");
  }
}

function withoutMongoId<T>(document: WithId<T>): T {
  const { _id: _id, ...value } = document;
  return value as T;
}
