import { describe, expect, it } from "vitest";
import { FIRST_VICTIM_NAME, type Role } from "@wakamete-plus/shared";
import { DEFAULT_ROOM_SETTINGS, GameRoom } from "../src/game.js";

function createStartedRoom() {
  let now = 1_000;
  const room = new GameRoom(() => now);
  const sockets = ["s1", "s2", "s3", "s4", "s5"];
  sockets.forEach((socketId, index) => room.join(socketId, `player${index + 1}`));
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
  it("adds development bots as playable participants", () => {
    const room = new GameRoom();
    room.join("s1", "player1");
    for (let index = 0; index < 4; index += 1) {
      room.addBot();
    }

    const bots = room.getState().players.filter((player) => player.bot);
    expect(bots).toHaveLength(4);
    expect(room.getState().canStart).toBe(true);
    expect(() => room.addBot()).toThrow("参加枠は5人までです。");
  });

  it("makes bots act during each applicable phase", () => {
    const room = new GameRoom();
    room.join("s1", "player1");
    for (let index = 0; index < 4; index += 1) {
      room.addBot();
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
    expect(room.getState().votes).toHaveLength(4);
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
    const player = bundle.state.players[0];

    expect(player?.name).toBe("player1");
    expect(player?.color).toBe("#2f80c7");
    expect(player && "handleName" in player).toBe(false);
    expect(player && "password" in player).toBe(false);
  });

  it("assigns the fixed roles and keeps the first victim from being a werewolf", () => {
    const { room, startBundle } = createStartedRoom();
    const roles = room.getDebugPlayersForTests().map((player) => player.role);
    const firstVictim = room.getDebugPlayersForTests().find((player) => player.name === FIRST_VICTIM_NAME);

    expect(roles.filter((role) => role === "werewolf")).toHaveLength(1);
    expect(roles.filter((role) => role === "madman")).toHaveLength(1);
    expect(roles.filter((role) => role === "seer")).toHaveLength(1);
    expect(roles.filter((role) => role === "villager")).toHaveLength(3);
    expect(firstVictim?.role).not.toBe("werewolf");
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

  it("resolves tied votes by executing one of the tied targets", () => {
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

    const executedIds = room.getState().players.filter((player) => !player.alive).map((player) => player.id);
    expect([targetA.id, targetB.id]).toContain(executedIds[0]);
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
  });
});
