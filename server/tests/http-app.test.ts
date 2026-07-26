import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ArchivedGameLog } from "@wakamete-plus/shared";
import { ROLE_SETS } from "../src/role-sets.js";
import { GameLogStore } from "../src/game-log-store.js";
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
  it("returns a saved game log and responds with 404 for an unknown room", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "wakamete-logs-"));
    const store = new GameLogStore(directory);
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
        text: "村人陣営の勝利です。",
        day: 2,
        phase: "ended",
        sentAt: 2_000
      }]
    };
    await store.save(archived);

    const server = createServer(createHttpApp("C:\\not-used-by-this-test", store));
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("テストサーバーのポートを取得できませんでした。");
    }

    const savedResponse = await fetch(`http://127.0.0.1:${address.port}/api/logs/room-a`);
    const missingResponse = await fetch(`http://127.0.0.1:${address.port}/api/logs/unknown`);

    expect(savedResponse.status).toBe(200);
    expect(await savedResponse.json()).toEqual(archived);
    expect(missingResponse.status).toBe(404);
  });
});
