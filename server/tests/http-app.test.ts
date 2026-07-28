import { createServer } from "node:http";
import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import type { ArchivedGameLog, ArchivedGameSummary } from "@wakamete-plus/shared";
import { ROLE_SETS } from "../src/role-sets.js";
import type { GameLogRepository } from "../src/game-log-store.js";
import { createHttpApp } from "../src/http-app.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => {
    server.close();
    await once(server, "close");
  }));
});

describe("role set API", () => {
  it("returns every public role set as JSON", async () => {
    const server = createServer(createHttpApp("C:\\not-used-by-this-test"));
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("テストサーバーのポートを取得できませんでした。");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/api/role-sets`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(ROLE_SETS);
  });
});

describe("archived game log API", () => {
  it("returns the game list, a saved log, and 404 for an unknown room", async () => {
    const archived: ArchivedGameLog = {
      schemaVersion: 1,
      roomId: "room-a",
      room: {
        roomName: "保存済み村",
        pr: "テスト",
        playerLimit: 4,
        durationSeconds: {
          dayDiscussion: 180,
          dayVote: 60,
          nightDiscussion: 90,
          nightAttack: 60
        }
      },
      startedAt: 1_000,
      endedAt: 2_000,
      closedAt: 3_000,
      winner: "villagers",
      players: [],
      entries: [{
        id: "e1",
        kind: "event",
        eventType: "game",
        text: "村人陣営の勝利です。",
        day: 2,
        phase: "ended",
        sentAt: 2_000
      }]
    };
    const store = new MemoryGameLogRepository([archived]);

    const server = createServer(createHttpApp("C:\\not-used-by-this-test", store));
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("テストサーバーのポートを取得できませんでした。");
    }

    const listResponse = await fetch(`http://127.0.0.1:${address.port}/api/logs`);
    const savedResponse = await fetch(`http://127.0.0.1:${address.port}/api/logs/room-a`);
    const missingResponse = await fetch(`http://127.0.0.1:${address.port}/api/logs/unknown`);

    expect(listResponse.status).toBe(200);
    const { entries: _entries, ...summary } = archived;
    expect(await listResponse.json()).toEqual([summary]);
    expect(savedResponse.status).toBe(200);
    expect(await savedResponse.json()).toEqual(archived);
    expect(missingResponse.status).toBe(404);
  });
});

class MemoryGameLogRepository implements GameLogRepository {
  constructor(private readonly logs: ArchivedGameLog[]) {}

  async save(log: ArchivedGameLog): Promise<void> {
    this.logs.push(log);
  }

  async find(roomId: string): Promise<ArchivedGameLog | null> {
    return this.logs.find((log) => log.roomId === roomId) ?? null;
  }

  async list(): Promise<ArchivedGameSummary[]> {
    return this.logs.map(({ entries: _entries, ...game }) => game);
  }
}
