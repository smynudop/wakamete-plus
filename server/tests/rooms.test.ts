import { describe, expect, it } from "vitest";
import type { CreateRoomPayload } from "@wakamete-plus/shared";
import { DEFAULT_ROOM_SETTINGS, GameRoom } from "../src/game.js";
import { RoomManager } from "../src/rooms.js";

function roomPayload(roomName: string, playerName: string): CreateRoomPayload {
  return {
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      roomName,
      durationSeconds: { ...DEFAULT_ROOM_SETTINGS.durationSeconds }
    },
    player: {
      name: playerName
    }
  };
}

describe("RoomManager", () => {
  it("creates public rooms and makes only the creator the game master", () => {
    const ids = ["room-a"];
    const manager = new RoomManager(() => ids.shift() ?? "unexpected");

    const created = manager.create("creator", roomPayload("テスト村", "owner"));
    const joined = manager.join("guest", {
      roomId: created.roomId,
      player: { name: "guest" }
    });

    expect(created.roomId).toBe("room-a");
    expect(joined.bundle.state.players.find((player) => player.name === "owner")?.gameMaster).toBe(true);
    expect(joined.bundle.state.players.find((player) => player.name === "guest")?.gameMaster).toBe(false);
    expect(() => joined.room.addBot("guest")).toThrow("ゲームマスターだけが実行できます。");
    expect(joined.room.addBot("creator").state.players.some((player) => player.bot)).toBe(true);
  });

  it("publishes complete lobby summaries as rooms change", () => {
    const ids = ["room-a", "room-b"];
    const manager = new RoomManager(() => ids.shift() ?? "unexpected");
    manager.create("creator-a", roomPayload("一番村", "owner-a"));
    manager.create("creator-b", roomPayload("二番村", "owner-b"));
    manager.join("guest-a", { roomId: "room-a", player: { name: "guest-a" } });

    expect(manager.list()).toEqual([
      expect.objectContaining({
        id: "room-a",
        roomName: "一番村",
        pr: DEFAULT_ROOM_SETTINGS.pr,
        playerCount: 3,
        playerLimit: 6,
        phase: "waiting",
        day: 0,
        status: "waiting"
      }),
      expect.objectContaining({
        id: "room-b",
        roomName: "二番村",
        playerCount: 2,
        status: "waiting"
      })
    ]);
  });

  it("keeps players, chat history, and game state isolated by room", () => {
    const ids = ["room-a", "room-b"];
    const manager = new RoomManager(() => ids.shift() ?? "unexpected");
    const roomA = manager.create("creator-a", roomPayload("一番村", "owner-a")).room;
    const roomB = manager.create("creator-b", roomPayload("二番村", "owner-b")).room;

    roomA.sendChat("creator-a", "一番村だけの発言");
    roomA.addBot("creator-a");

    expect(roomA.getState().players.some((player) => player.bot)).toBe(true);
    expect(roomB.getState().players.some((player) => player.bot)).toBe(false);
    expect(roomA.getPrivateState("creator-a").log.some((entry) => entry.kind === "chat" && entry.text === "一番村だけの発言")).toBe(true);
    expect(roomB.getPrivateState("creator-b").log.some((entry) => entry.kind === "chat" && entry.text === "一番村だけの発言")).toBe(false);
  });

  it("requires room membership for game actions and one room per socket", () => {
    const manager = new RoomManager(() => "room-a");
    manager.create("creator", roomPayload("テスト村", "owner"));

    expect(() => manager.roomForSocket("outsider")).toThrow("先にルームへ参加してください。");
    expect(() => manager.join("creator", {
      roomId: "room-a",
      player: { name: "duplicate" }
    })).toThrow("別のルームから退出してから操作してください。");
  });

  it("scopes reconnect session tokens to their original room", () => {
    const ids = ["room-a", "room-b"];
    const tokens = ["token-a", "token-b"];
    const manager = new RoomManager(
      () => ids.shift() ?? "unexpected",
      () => new GameRoom(() => 1_000, DEFAULT_ROOM_SETTINGS, () => tokens.shift() ?? "unexpected-token")
    );
    const createdA = manager.create("creator-a", roomPayload("一番村", "owner-a"));
    manager.create("creator-b", roomPayload("二番村", "owner-b"));
    const token = createdA.bundle.privateStates.get("creator-a")?.sessionToken;
    manager.leave("creator-a");

    expect(manager.join("return-a", {
      roomId: "room-a",
      player: { name: "", sessionToken: token ?? undefined }
    }).bundle.privateStates.get("return-a")?.playerId).toBe("p1");

    expect(() => manager.join("intruder", {
      roomId: "room-b",
      player: { name: "", sessionToken: token ?? undefined }
    })).toThrow("名前を入力してください。");
  });

  it("removes a closed room and clears its socket memberships", () => {
    const manager = new RoomManager(() => "room-a");
    manager.create("creator", roomPayload("終了村", "owner"));

    manager.close("room-a");

    expect(manager.list()).toEqual([]);
    expect(() => manager.getRoom("room-a")).toThrow("指定したルームが見つかりません。");
    expect(() => manager.roomForSocket("creator")).toThrow("先にルームへ参加してください。");
  });

  it("finds only waiting rooms that have remained unstarted past the maximum age", () => {
    let now = 1_000;
    const ids = ["expired-waiting", "started", "ended", "recent-waiting"];
    const manager = new RoomManager(
      () => ids.shift() ?? "unexpected",
      () => new GameRoom(() => now),
      () => now
    );
    manager.create("creator-expired", roomPayload("期限切れ村", "owner-expired"));
    const started = manager.create("creator-started", roomPayload("進行中村", "owner-started"));
    for (let index = 0; index < 4; index += 1) {
      started.room.addBot("creator-started");
    }
    started.room.start("creator-started");
    const ended = manager.create("creator-ended", roomPayload("終了済み村", "owner-ended"));
    for (let index = 0; index < 4; index += 1) {
      ended.room.addBot("creator-ended");
    }
    ended.room.start("creator-ended");
    ended.room.advanceTimer();
    ended.room.advanceTimer();
    ended.room.advanceTimer();
    for (let voteRound = 0; voteRound < 4; voteRound += 1) {
      ended.room.advanceTimer();
    }
    expect(ended.room.getState().phase).toBe("ended");

    now += 3 * 60 * 60 * 1000 + 1;
    manager.create("creator-recent", roomPayload("新しい村", "owner-recent"));

    expect(manager.expiredWaitingRoomIds(3 * 60 * 60 * 1000)).toEqual(["expired-waiting"]);
  });

  it("allows closing the same room more than once without throwing", () => {
    const manager = new RoomManager(() => "room-a");
    manager.create("creator", roomPayload("終了村", "owner"));

    expect(manager.close("room-a")).toBe(true);
    expect(manager.close("room-a")).toBe(false);
  });
});
