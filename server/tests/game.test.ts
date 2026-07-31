import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYER_COLOR,
  DEFAULT_ROLE_PROPERTIES,
  FIRST_VICTIM_NAME,
  ROLE_PROPERTIES,
  type Role
} from "@wakamete-plus/shared";
import { DEFAULT_ROOM_SETTINGS, GameRoom } from "../src/game.js";
import { ROLE_SETS } from "../src/role-sets.js";

function createStartedRoom() {
  let now = 1_000;
  const room = new GameRoom(() => now, DEFAULT_ROOM_SETTINGS, undefined, () => 0);
  const sockets = ["s1", "s2", "s3", "s4", "s5"];
  room.create(sockets[0]!, { name: "player1" });
  sockets.slice(1).forEach((socketId, index) => room.join(socketId, `player${index + 2}`));
  const startBundle = room.start("s1");
  return {
    room,
    sockets,
    get now() {
      return now;
    },
    set now(value: number) {
      now = value;
    },
    startBundle
  };
}

function rolesFrom(bundle: ReturnType<GameRoom["start"]>) {
  return [...bundle.privateStates.entries()].map(([socketId, state]) => ({
    socketId,
    role: state.role as Role
  }));
}

function socketForRole(bundle: ReturnType<GameRoom["start"]>, role: Role) {
  const found = rolesFrom(bundle).find((entry) => entry.role === role);
  if (!found) {
    throw new Error(`Missing role ${role}`);
  }
  return found.socketId;
}

function playerIdForSocket(bundle: ReturnType<GameRoom["start"]>, socketId: string) {
  const privateState = bundle.privateStates.get(socketId);
  if (!privateState?.playerId) {
    throw new Error(`Missing player for ${socketId}`);
  }
  return privateState.playerId;
}

describe("GameRoom", () => {
  it("defines role properties using human villager defaults", () => {
    expect(DEFAULT_ROLE_PROPERTIES).toEqual({ species: "human", side: "villagers", knowsWerewolves: false });
    expect(ROLE_PROPERTIES.villager).toEqual(DEFAULT_ROLE_PROPERTIES);
    expect(ROLE_PROPERTIES.madman).toEqual({ species: "human", side: "werewolves", knowsWerewolves: false });
    expect(ROLE_PROPERTIES.werewolf).toEqual({
      species: "werewolf",
      side: "werewolves",
      knowsWerewolves: true
    });
    expect(ROLE_PROPERTIES.fox).toEqual({ species: "fox", side: "fox", knowsWerewolves: false });
  });

  it("has the first victim before players join the room", () => {
    const room = new GameRoom();

    expect(room.getState().players).toEqual([
      expect.objectContaining({
        id: "npc-first-victim",
        name: FIRST_VICTIM_NAME,
        alive: true,
        npc: true,
        bot: false,
        connected: false
      })
    ]);
    expect(room.getState().phase).toBe("waiting");
  });

  it("grants room controls only to the room creator", () => {
    const room = new GameRoom();
    room.create("s1", { name: "game-master" });
    room.join("s2", "player2");

    expect(room.getState().players.find((player) => player.name === "game-master")?.gameMaster).toBe(true);
    expect(room.getState().players.find((player) => player.name === "player2")?.gameMaster).toBe(false);
    expect(() => room.addBot("s2")).toThrow("ゲームマスターだけが実行できます。");
    expect(() => room.updateRoomSettings("s2", DEFAULT_ROOM_SETTINGS)).toThrow(
      "ゲームマスターだけが実行できます。"
    );

    room.updateRoomSettings("s1", {
      ...DEFAULT_ROOM_SETTINGS,
      roomName: "変更後の村",
      playerLimit: 6
    });
    expect(room.getState().room.roomName).toBe("変更後の村");

    for (let index = 0; index < 3; index += 1) {
      room.addBot("s1");
    }
    expect(() => room.start("s2")).toThrow("ゲームマスターだけが実行できます。");
    expect(room.start("s1").state.phase).toBe("nightDiscussion");
  });

  it("restores the same player and private state with a session token after the game starts", () => {
    const room = new GameRoom(() => 1_000, DEFAULT_ROOM_SETTINGS, () => "session-player1");
    const joined = room.create("s1", { name: "player1", password: "return-secret" });
    for (let index = 0; index < 4; index += 1) {
      room.addBot("s1");
    }
    const started = room.start("s1");
    const originalPrivateState = started.privateStates.get("s1");
    const sessionToken = joined.privateStates.get("s1")?.sessionToken;
    expect(sessionToken).toBe("session-player1");

    room.disconnect("s1");
    expect(room.getState().players.find((player) => player.id === originalPrivateState?.playerId)?.connected).toBe(false);

    const restored = room.join("s6", { name: "", sessionToken: sessionToken! });

    expect(restored.privateStates.get("s6")).toEqual({
      ...originalPrivateState,
      log: expect.arrayContaining([
        expect.objectContaining({ kind: "event", text: "player1 が復帰しました。" })
      ])
    });
    expect(restored.state.players.find((player) => player.id === originalPrivateState?.playerId)?.connected).toBe(true);
    expect(room.getPrivateState("s1").playerId).toBeNull();
  });

  it("allows password recovery for a disconnected player and rejects a wrong password", () => {
    const tokens = ["session-player1", "session-player1-recovered"];
    const room = new GameRoom(() => 1_000, DEFAULT_ROOM_SETTINGS, () => tokens.shift() ?? "unexpected-token");
    const joined = room.join("s1", { name: "player1", password: "return-secret" });
    const playerId = joined.privateStates.get("s1")?.playerId;
    room.disconnect("s1");

    expect(() => room.join("s2", { name: "player1", password: "wrong-secret" })).toThrow(
      "復帰用パスワードが一致しません。"
    );

    const restored = room.join("s2", { name: "player1", password: "return-secret" });
    expect(restored.privateStates.get("s2")?.playerId).toBe(playerId);
    expect(restored.privateStates.get("s2")?.sessionToken).toBe("session-player1-recovered");

    room.disconnect("s2");
    expect(() => room.join("s3", { name: "player1", sessionToken: "session-player1" })).toThrow(
      "復帰用パスワードが一致しません。"
    );
  });

  it("adds development bots as playable participants", () => {
    const room = new GameRoom();
    room.create("s1", { name: "player1" });
    for (let index = 0; index < 4; index += 1) {
      room.addBot("s1");
    }

    const bots = room.getState().players.filter((player) => player.bot);
    expect(bots).toHaveLength(4);
    expect(room.getState().canStart).toBe(true);
    expect(() => room.addBot("s1")).toThrow("参加枠は5人までです。");
  });

  it("makes bots act during each applicable phase", () => {
    const room = new GameRoom();
    room.create("s1", { name: "player1" });
    for (let index = 0; index < 4; index += 1) {
      room.addBot("s1");
    }
    room.start("s1");

    const nightActions = room.runBotActions();
    const botSeer = room.getDebugPlayersForTests().find(
      (player) => player.role === "seer" && player.name.startsWith("開発Bot")
    );
    const botWerewolf = room.getDebugPlayersForTests().find(
      (player) => player.role === "werewolf" && player.name.startsWith("開発Bot")
    );
    if (botSeer) {
      const seerState = [...nightActions.privateStates.values()].find((state) => state.playerId === botSeer.id);
      expect(seerState?.divineResults).toHaveLength(1);
    }

    room.advanceTimer();
    const attackActions = room.runBotActions();
    if (botWerewolf) {
      const firstVictim = room.getState().players.find((player) => player.name === FIRST_VICTIM_NAME);
      expect(firstVictim?.alive).toBe(false);
    }
    if (room.getState().phase === "nightAttack") {
      room.advanceTimer();
    }
    expect(room.getState().phase).toBe("dayDiscussion");

    const dayActions = attackActions.chats.length > 0 ? attackActions : room.runBotActions();
    expect(dayActions.chats).toHaveLength(4);
    expect(dayActions.chats.every((message) => message.text === "おはようございます。")).toBe(true);

    room.advanceTimer();
    room.runBotActions();
    expect(room.getState().phase).toBe("dayVote");
  });

  it("exposes fixed room settings on the public state", () => {
    const room = new GameRoom();

    expect(room.getState().room).toEqual(DEFAULT_ROOM_SETTINGS);
  });

  it("stores join properties while only publishing display color before game end", () => {
    const room = new GameRoom();
    const bundle = room.join("s1", {
      name: "player1",
      handleName: "owner1",
      color: "#2f80c7",
      password: "return-secret"
    });
    const player = bundle.state.players.find((candidate) => !candidate.npc);

    expect(player?.name).toBe("player1");
    expect(player?.color).toBe("#2f80c7");
    expect(player && "handleName" in player).toBe(false);
    expect(player && "password" in player).toBe(false);
    expect(player && "sessionToken" in player).toBe(false);
    expect(bundle.privateStates.get("s1")?.sessionToken).toBeTruthy();
  });

  it("allows public chat before play and the appropriate private channels at night", () => {
    const waitingRoom = new GameRoom();
    waitingRoom.join("s1", { name: "player1", color: "#2f80c7" });
    expect(waitingRoom.sendChat("s1", "開始前です\n二行目です", "werewolf", "strong").chats[0])
      .toEqual(expect.objectContaining({
        channel: "public",
        text: "開始前です\n二行目です",
        senderColor: "#2f80c7",
        size: "strong"
      }));

    const { room, startBundle } = createStartedRoom();
    const werewolfSocket = socketForRole(startBundle, "werewolf");
    const nonWerewolfSocket = rolesFrom(startBundle).find(({ role }) => role !== "werewolf")!.socketId;

    expect(room.sendChat(nonWerewolfSocket, "独り言", "monologue").chats[0]?.channel).toBe("monologue");
    expect(() => room.sendChat(nonWerewolfSocket, "狼会話", "werewolf")).toThrow(
      "このフェーズでは指定した発言を送信できません。"
    );
    expect(room.sendChat(werewolfSocket, "狼会話", "werewolf").chats[0]?.channel).toBe("werewolf");

    room.advanceTimer();
    expect(room.sendChat(nonWerewolfSocket, "襲撃中の独り言", "monologue").chats[0]?.channel).toBe("monologue");
    expect(() => room.sendChat(werewolfSocket, "襲撃中の狼会話", "werewolf")).toThrow(
      "このフェーズでは指定した発言を送信できません。"
    );
  });

  it("accepts night abilities in both night phases and keeps an early attack target", () => {
    const { room, startBundle } = createStartedRoom();
    const werewolfSocket = socketForRole(startBundle, "werewolf");
    const seerSocket = socketForRole(startBundle, "seer");
    const seerId = playerIdForSocket(startBundle, seerSocket);
    const divineTarget = room.getState().players.find((player) => player.alive && player.id !== seerId)!;
    const firstVictim = room.getState().players.find((player) => player.name === FIRST_VICTIM_NAME)!;

    expect(room.divine(seerSocket, divineTarget.id).state.phase).toBe("nightDiscussion");
    expect(room.attack(werewolfSocket, firstVictim.id).state.phase).toBe("nightDiscussion");
    expect(room.advanceTimer().state.phase).toBe("nightAttack");
    expect(() => room.divine(seerSocket, divineTarget.id)).toThrow("占いは一晩に1回だけ行えます。");
    expect(() => room.attack(werewolfSocket, firstVictim.id)).toThrow(
      "襲撃先の選択は一晩に1回だけ行えます。"
    );
    expect(room.advanceTimer().state.players.find((player) => player.id === firstVictim.id)?.alive).toBe(false);

    const secondRoom = createStartedRoom();
    const secondSeerSocket = socketForRole(secondRoom.startBundle, "seer");
    const secondSeerId = playerIdForSocket(secondRoom.startBundle, secondSeerSocket);
    const secondTarget = secondRoom.room.getState().players.find(
      (player) => player.alive && player.id !== secondSeerId
    )!;
    secondRoom.room.advanceTimer();
    expect(secondRoom.room.divine(secondSeerSocket, secondTarget.id).state.phase).toBe("nightAttack");
  });

  it("allows each hunter to guard only once per night", () => {
    const room = new GameRoom(() => 1_000, DEFAULT_ROOM_SETTINGS, undefined, () => 0);
    room.create("s1", { name: "player1" });
    room.updateRoomSettings("s1", { ...DEFAULT_ROOM_SETTINGS, playerLimit: 7 });
    for (let index = 0; index < 5; index += 1) {
      room.addBot("s1");
    }
    const started = room.start("s1");
    const hunterSocket = socketForRole(started, "hunter");
    const hunterId = playerIdForSocket(started, hunterSocket);
    const targets = room.getState().players.filter((player) => player.alive && player.id !== hunterId);

    room.guard(hunterSocket, targets[0]!.id);

    expect(() => room.guard(hunterSocket, targets[1]!.id)).toThrow("護衛は一晩に1回だけ行えます。");
  });

  it("assigns an eligible role to the first victim and auto-divines when it is the seer", () => {
    const room = new GameRoom(() => 1_000, DEFAULT_ROOM_SETTINGS, undefined, () => 0.4);
    room.create("s1", { name: "player1" });
    room.updateRoomSettings("s1", { ...DEFAULT_ROOM_SETTINGS, playerLimit: 4 });
    room.addBot("s1");
    room.addBot("s1");

    room.start("s1");

    const firstVictim = room.getDebugPlayersForTests().find((player) => player.npc);
    expect(firstVictim?.role).toBe("seer");
    expect(firstVictim?.divineResultCount).toBe(1);
  });

  it("keeps votes cast during day discussion for the vote phase", () => {
    const { room, sockets } = createStartedRoom();
    room.advanceTimer();
    room.advanceTimer();

    const voterId = room.getPrivateState(sockets[0]!).playerId;
    const target = room.getState().players.find((player) => !player.npc && player.id !== voterId)!;
    expect(room.vote(sockets[0]!, target.id).state.phase).toBe("dayDiscussion");

    const votePhase = room.advanceTimer().state;
    expect(votePhase.phase).toBe("dayVote");
    for (const socketId of sockets.slice(1)) {
      const currentVoterId = room.getPrivateState(socketId).playerId;
      room.vote(socketId, currentVoterId === target.id ? voterId! : target.id);
    }
    expect(room.getState().phase).not.toBe("dayVote");
  });

  it("creates immediate logs with public, werewolf, and private audiences", () => {
    const { room, startBundle } = createStartedRoom();
    const werewolfSocket = socketForRole(startBundle, "werewolf");
    const seerSocket = socketForRole(startBundle, "seer");
    const seerId = playerIdForSocket(startBundle, seerSocket);
    const divineTarget = room.getState().players.find((player) => player.alive && player.id !== seerId)!;
    const firstVictim = room.getState().players.find((player) => player.name === FIRST_VICTIM_NAME)!;

    const divineLog = room.divine(seerSocket, divineTarget.id).events[0];
    expect(divineLog?.audience).toBe("private");
    expect(divineLog?.playerId).toBe(seerId);
    expect(divineLog?.entry.text).toContain("占いました");

    const attackLog = room.attack(werewolfSocket, firstVictim.id).events[0];
    expect(attackLog?.audience).toBe("werewolves");
    expect(attackLog?.entry.text).toContain("襲撃先");

    room.advanceTimer();
    const deathLog = room.advanceTimer().events;
    expect(deathLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          audience: "public",
          entry: expect.objectContaining({ text: `${FIRST_VICTIM_NAME} が襲撃されました。` })
        })
      ])
    );
  });

  it("publishes vote totals and the execution after voting ends", () => {
    const { room, sockets } = createStartedRoom();
    room.advanceTimer();
    room.advanceTimer();
    room.advanceTimer();

    const players = room.getState().players.filter((player) => !player.npc);
    const target = players[0]!;
    const fallback = players[1]!;
    let finalEvents: ReturnType<GameRoom["vote"]>["events"] = [];
    for (const socketId of sockets) {
      const voterId = room.getPrivateState(socketId).playerId;
      finalEvents = room.vote(socketId, voterId === target.id ? fallback.id : target.id).events;
    }

    const publicTexts = finalEvents
      .filter((event) => event.audience === "public")
      .map((event) => event.entry.text);
    expect(publicTexts.some((text) => text.includes(`${target.name} 4票`))).toBe(true);
    expect(publicTexts.some((text) => text === `${target.name} が処刑されました。`)).toBe(true);
  });

  it("assigns the configured roles including the first victim", () => {
    const { room, startBundle } = createStartedRoom();
    const roles = room.getDebugPlayersForTests().map((player) => player.role);
    const firstVictim = room.getDebugPlayersForTests().find((player) => player.name === FIRST_VICTIM_NAME);

    for (const [role, count] of Object.entries(ROLE_SETS[6]!)) {
      expect(roles.filter((assignedRole) => assignedRole === role)).toHaveLength(count);
    }
    expect(firstVictim?.role).toBe("villager");
    expect(room.getState().players).toHaveLength(6);
    expect(firstVictim?.alive).toBe(true);
    expect(startBundle.state.phase).toBe("nightDiscussion");
  });

  it("moves through the planned phase order", () => {
    const { room } = createStartedRoom();

    expect(room.advanceTimer().state.phase).toBe("nightAttack");
    expect(room.advanceTimer().state.phase).toBe("dayDiscussion");
    expect(room.advanceTimer().state.phase).toBe("dayVote");
  });

  it("executes the top voted player", () => {
    const { room, sockets } = createStartedRoom();
    room.advanceTimer();
    room.advanceTimer();
    room.advanceTimer();

    const state = room.getState();
    const target = state.players.find((player) => player.name === "player5");
    const other = state.players.find((player) => player.name === "player1");
    expect(target).toBeDefined();
    expect(other).toBeDefined();
    for (const socketId of sockets.slice(0, 3)) {
      room.vote(socketId, target!.id);
    }
    room.vote(sockets[3]!, other!.id);
    room.vote(sockets[4]!, other!.id);

    const afterVote = room.getState().players.find((player) => player.id === target!.id);
    expect(afterVote?.alive).toBe(false);
  });

  it("resets tied votes without executing a player", () => {
    const { room, sockets } = createStartedRoom();
    room.advanceTimer();
    room.advanceTimer();
    room.advanceTimer();

    const players = room.getState().players.filter((player) => !player.npc);
    const targetA = players[0]!;
    const targetB = players[1]!;
    room.vote(sockets[2]!, targetA.id);
    room.vote(sockets[3]!, targetB.id);
    room.advanceTimer();

    const executedIds = room.getState().players
      .filter((player) => !player.npc && !player.alive)
      .map((player) => player.id);
    expect(executedIds).toHaveLength(0);
    expect(room.getState().phase).toBe("dayVote");
  });

  it("ends in a draw after four tied ballots", () => {
    const { room, sockets } = createStartedRoom();
    room.advanceTimer();
    room.advanceTimer();
    room.advanceTimer();
    const players = room.getState().players.filter((player) => !player.npc);

    let ended: ReturnType<GameRoom["vote"]>["ended"] = null;
    for (let round = 0; round < 4; round += 1) {
      const targets = [players[1]!, players[0]!, players[0]!, players[1]!, players[2]!];
      for (const [index, socketId] of sockets.entries()) {
        ended = room.vote(socketId, targets[index]!.id).ended;
      }
    }

    expect(ended?.winner).toBe("draw");
    expect(room.getState().phase).toBe("ended");
    expect(room.getState().players.filter((player) => !player.npc && !player.alive)).toHaveLength(0);
  });

  it("forces the first night attack to the first victim", () => {
    const { room, startBundle } = createStartedRoom();
    const werewolfSocket = socketForRole(startBundle, "werewolf");
    room.advanceTimer();

    const firstVictim = room.getState().players.find((player) => player.name === FIRST_VICTIM_NAME);
    expect(firstVictim).toBeDefined();
    room.attack(werewolfSocket, firstVictim!.id);

    const afterAttack = room.getState().players.find((player) => player.id === firstVictim!.id);
    expect(afterAttack?.alive).toBe(false);
  });

  it("ends with a villager win when the werewolf is executed", () => {
    const { room, startBundle, sockets } = createStartedRoom();
    const werewolfSocket = socketForRole(startBundle, "werewolf");
    const werewolfId = playerIdForSocket(startBundle, werewolfSocket);
    room.advanceTimer();
    room.advanceTimer();
    room.advanceTimer();

    let ended = null;
    const fallback = room.getState().players.find((player) => player.alive && !player.npc && player.id !== werewolfId);
    expect(fallback).toBeDefined();
    for (const socketId of sockets) {
      const voterId = startBundle.privateStates.get(socketId)?.playerId;
      ended = room.vote(socketId, voterId === werewolfId ? fallback!.id : werewolfId).ended;
      if (ended) {
        break;
      }
    }

    expect(ended?.winner).toBe("villagers");
  });

  it("ends with a werewolf win when werewolves reach parity with humans", () => {
    const { room, startBundle } = createStartedRoom();
    const werewolfSocket = socketForRole(startBundle, "werewolf");
    const werewolfId = playerIdForSocket(startBundle, werewolfSocket);
    const firstVictim = room.getState().players.find((player) => player.name === FIRST_VICTIM_NAME);
    room.advanceTimer();
    room.attack(werewolfSocket, firstVictim!.id);

    let ended = null;
    for (let guard = 0; guard < 8 && !ended; guard += 1) {
      if (room.getState().phase === "dayDiscussion") {
        room.advanceTimer();
      }
      if (room.getState().phase === "dayVote") {
        const target = room.getState().players.find((player) => player.alive && !player.npc && player.id !== werewolfId);
        const fallback = room.getState().players.find((player) => player.alive && !player.npc && player.id === werewolfId);
        if (!target || !fallback) {
          break;
        }
        for (const [socketId, privateState] of startBundle.privateStates) {
          const voter = room.getState().players.find((player) => player.id === privateState.playerId);
          if (!voter?.alive) {
            continue;
          }
          ended = room.vote(socketId, voter.id === target.id ? fallback.id : target.id).ended;
          if (ended) {
            break;
          }
        }
      }
      if (room.getState().phase === "nightDiscussion") {
        room.advanceTimer();
      }
      if (room.getState().phase === "nightAttack") {
        const target = room.getState().players.find((player) => player.alive && !player.npc && player.id !== werewolfId);
        if (!target) {
          break;
        }
        ended = room.attack(werewolfSocket, target.id).ended;
      }
    }

    expect(ended?.winner).toBe("werewolves");
    expect(room.getPostGameCloseDelay()).toBe(5 * 60 * 1_000);
    expect(room.getState().timer).toEqual({
      startedAt: 1_000,
      endsAt: 301_000
    });
    expect(room.createArchive("room-a", 301_000)).toEqual(expect.objectContaining({
      schemaVersion: 1,
      roomId: "room-a",
      startedAt: 1_000,
      endedAt: 1_000,
      closedAt: 301_000,
      winner: "werewolves",
      entries: expect.arrayContaining([
        expect.objectContaining({ text: "人狼陣営の勝利です。", phase: "ended" })
      ])
    }));
  });

  it("restores a unified chronological chat and event log", () => {
    const room = new GameRoom(() => 1_000);
    const joined = room.join("s1", { name: "player1" });
    room.sendChat("s1", "履歴に残る発言");
    const token = joined.privateStates.get("s1")?.sessionToken;
    room.disconnect("s1");

    const restored = room.join("s2", { name: "", sessionToken: token ?? undefined });
    const log = restored.privateStates.get("s2")?.log ?? [];

    expect(log.map((entry) => entry.kind)).toEqual(["event", "chat", "event"]);
    expect(log[1]).toEqual(expect.objectContaining({
      senderName: "player1",
      senderColor: DEFAULT_PLAYER_COLOR,
      size: "normal",
      text: "履歴に残る発言"
    }));
  });

  it("assigns and exposes all additional roles in a configured expanded room", () => {
    const room = new GameRoom(() => Date.now(), DEFAULT_ROOM_SETTINGS, undefined, () => 0);
    room.create("s1", { name: "player1" });
    room.updateRoomSettings("s1", { ...DEFAULT_ROOM_SETTINGS, playerLimit: 17 });
    for (let index = 0; index < 15; index += 1) {
      room.addBot("s1");
    }

    const started = room.start("s1");
    const roles = room.getDebugPlayersForTests().map((player) => player.role);
    expect(roles).toEqual(expect.arrayContaining([
      "medium",
      "hunter",
      "shared",
      "fox",
      "cat",
      "fanatic",
      "immoralist"
    ]));
    expect(roles.filter((role) => role === "shared")).toHaveLength(2);

    const sharedState = [...started.privateStates.values()].find((state) => state.role === "shared");
    expect(sharedState?.sharedPlayerIds).toHaveLength(1);
    const fanaticState = [...started.privateStates.values()].find((state) => state.role === "fanatic");
    expect(fanaticState?.knownWerewolfPlayerIds).toHaveLength(3);
    expect([...started.privateStates.values()].find((state) => state.role === "villager")?.knownWerewolfPlayerIds)
      .toHaveLength(0);
  });

  it("makes an executed cat take one living player with it", () => {
    const room = new GameRoom(() => 1_000, DEFAULT_ROOM_SETTINGS, undefined, () => 0);
    room.create("s1", { name: "player1" });
    room.updateRoomSettings("s1", { ...DEFAULT_ROOM_SETTINGS, playerLimit: 17 });
    for (let index = 0; index < 15; index += 1) {
      room.addBot("s1");
    }
    const started = room.start("s1");
    const catSocket = socketForRole(started, "cat");
    const catId = playerIdForSocket(started, catSocket);
    room.advanceTimer();
    room.advanceTimer();
    room.advanceTimer();

    for (const [socketId, state] of started.privateStates) {
      const targetId = state.playerId === catId
        ? started.privateStates.get(socketForRole(started, "werewolf"))!.playerId!
        : catId;
      room.vote(socketId, targetId);
    }

    expect(room.getState().players.filter((player) => !player.alive)).toHaveLength(3);
  });

  it("kills a divined fox at dawn while foxes survive attacks", () => {
    const room = new GameRoom(() => Date.now(), DEFAULT_ROOM_SETTINGS, undefined, () => 0);
    room.create("s1", { name: "player1" });
    room.updateRoomSettings("s1", { ...DEFAULT_ROOM_SETTINGS, playerLimit: 13 });
    for (let index = 0; index < 11; index += 1) {
      room.addBot("s1");
    }
    const started = room.start("s1");
    const seerSocket = socketForRole(started, "seer");
    const werewolfSocket = socketForRole(started, "werewolf");
    const foxId = playerIdForSocket(started, socketForRole(started, "fox"));
    const firstVictim = room.getState().players.find((player) => player.name === FIRST_VICTIM_NAME)!;

    room.divine(seerSocket, foxId);
    room.attack(werewolfSocket, firstVictim.id);
    room.advanceTimer();
    room.advanceTimer();

    expect(room.getState().players.find((player) => player.id === foxId)?.alive).toBe(false);
  });
});
