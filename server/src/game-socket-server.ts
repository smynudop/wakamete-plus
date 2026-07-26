import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { ClientToServerEvents, GameLogEntry, ServerToClientEvents } from "@wakamete-plus/shared";
import type { GameEventBundle, GameRoom } from "./game.js";
import { GameLogStore } from "./game-log-store.js";
import { RoomManager } from "./rooms.js";

export function attachGameSocketServer(httpServer: HttpServer, gameLogs: GameLogStore): void {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: true
    }
  });
  const rooms = new RoomManager();
  const timers = new Map<string, NodeJS.Timeout>();

  io.on("connection", (socket) => {
    socket.emit("roomList", rooms.list());

    socket.on("createRoom", (payload) => {
      handle(socket.id, () => {
        const result = rooms.create(socket.id, payload);
        void socket.join(result.roomId);
        const sessionToken = result.bundle.privateStates.get(socket.id)?.sessionToken;
        if (!sessionToken) {
          throw new Error("作成者のセッションを作成できませんでした。");
        }
        socket.emit("roomCreated", { roomId: result.roomId, sessionToken });
        socket.emit("roomJoined", { roomId: result.roomId });
        broadcastWithBots(result.roomId, result.room, result.bundle);
      });
    });
    socket.on("joinRoom", (payload) => {
      handle(socket.id, () => {
        const result = rooms.join(socket.id, payload);
        void socket.join(result.roomId);
        socket.emit("roomJoined", { roomId: result.roomId });
        broadcastWithBots(result.roomId, result.room, result.bundle);
      });
    });
    socket.on("leaveRoom", () => {
      handle(socket.id, () => {
        const result = rooms.leave(socket.id);
        if (!result) {
          return;
        }
        void socket.leave(result.roomId);
        socket.emit("roomLeft");
        broadcastWithBots(result.roomId, result.room, result.bundle);
      });
    });
    socket.on("joinGame", () => {
      socket.emit("actionError", { message: "ロビーからルームを選択してください。" });
    });
    socket.on("addBot", () => withSocketRoom(socket.id, (room) => room.addBot(socket.id)));
    socket.on("startGame", () => withSocketRoom(socket.id, (room) => room.start(socket.id)));
    socket.on("updateRoomSettings", (settings) =>
      withSocketRoom(socket.id, (room) => room.updateRoomSettings(socket.id, settings))
    );
    socket.on("sendChat", (payload) =>
      withSocketRoom(socket.id, (room) => room.sendChat(socket.id, payload.text, payload.channel))
    );
    socket.on("vote", (payload) =>
      withSocketRoom(socket.id, (room) => room.vote(socket.id, payload.targetId))
    );
    socket.on("divine", (payload) =>
      withSocketRoom(socket.id, (room) => room.divine(socket.id, payload.targetId))
    );
    socket.on("guard", (payload) =>
      withSocketRoom(socket.id, (room) => room.guard(socket.id, payload.targetId))
    );
    socket.on("attack", (payload) =>
      withSocketRoom(socket.id, (room) => room.attack(socket.id, payload.targetId))
    );
    socket.on("disconnect", () => {
      const result = rooms.disconnect(socket.id);
      if (result) {
        broadcastWithBots(result.roomId, result.room, result.bundle);
      }
    });
  });

  function handle(socketId: string, action: () => void): void {
    try {
      action();
    } catch (error) {
      io.to(socketId).emit("actionError", {
        message: error instanceof Error ? error.message : "操作に失敗しました。"
      });
    }
  }

  function withSocketRoom(socketId: string, action: (room: GameRoom) => GameEventBundle): void {
    handle(socketId, () => {
      const { roomId, room } = rooms.roomForSocket(socketId);
      broadcastWithBots(roomId, room, action(room));
    });
  }

  function broadcastWithBots(roomId: string, room: GameRoom, bundle: GameEventBundle): void {
    broadcast(roomId, room, bundle);
    const botBundle = room.runBotActions();
    if (
      botBundle.chats.length > 0
      || botBundle.events.length > 0
      || botBundle.phaseChanged
      || botBundle.ended
    ) {
      broadcast(roomId, room, botBundle);
    }
  }

  function broadcast(roomId: string, room: GameRoom, bundle: GameEventBundle): void {
    io.to(roomId).emit("gameState", bundle.state);
    if (bundle.phaseChanged) {
      io.to(roomId).emit("phaseChanged", bundle.state);
    }
    for (const message of bundle.chats) {
      const entry: GameLogEntry = { ...message, kind: "chat" as const };
      if (message.channel === "monologue") {
        const senderSocketId = socketIdForPlayer(bundle, message.senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit("logEntry", entry);
        }
      } else if (message.channel === "werewolf") {
        emitToRole(bundle, "werewolf", (socketId) => io.to(socketId).emit("logEntry", entry));
      } else if (message.channel === "shared") {
        emitToRole(bundle, "shared", (socketId) => io.to(socketId).emit("logEntry", entry));
      } else {
        io.to(roomId).emit("logEntry", entry);
      }
    }
    for (const event of bundle.events) {
      if (event.audience === "public") {
        io.to(roomId).emit("logEntry", event.entry);
      } else if (event.audience === "werewolves") {
        emitToRole(bundle, "werewolf", (socketId) => io.to(socketId).emit("logEntry", event.entry));
      } else if (event.audience === "shared") {
        emitToRole(bundle, "shared", (socketId) => io.to(socketId).emit("logEntry", event.entry));
      } else if (event.playerId) {
        const recipientSocketId = socketIdForPlayer(bundle, event.playerId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("logEntry", event.entry);
        }
      }
    }
    for (const socketId of bundle.privateStates.keys()) {
      io.to(socketId).emit("privateState", room.getPrivateState(socketId));
    }
    if (bundle.ended) {
      io.to(roomId).emit("gameEnded", bundle.ended);
    }
    scheduleTimer(roomId, room);
    io.emit("roomList", rooms.list());
  }

  function emitToRole(
    bundle: GameEventBundle,
    role: "werewolf" | "shared",
    emit: (socketId: string) => void
  ): void {
    for (const [socketId, privateState] of bundle.privateStates) {
      if (privateState.role === role) {
        emit(socketId);
      }
    }
  }

  function socketIdForPlayer(bundle: GameEventBundle, playerId: string): string | undefined {
    return [...bundle.privateStates.entries()]
      .find(([, privateState]) => privateState.playerId === playerId)?.[0];
  }

  function scheduleTimer(roomId: string, room: GameRoom): void {
    const currentTimer = timers.get(roomId);
    if (currentTimer) {
      clearTimeout(currentTimer);
      timers.delete(roomId);
    }
    const delay = room.getTimerDelay();
    const closeDelay = room.getPostGameCloseDelay();
    if (delay === null && closeDelay === null) {
      return;
    }
    timers.set(roomId, setTimeout(() => {
      timers.delete(roomId);
      if (delay !== null) {
        broadcastWithBots(roomId, room, room.advanceTimer());
        return;
      }
      void closeRoom(roomId, room);
    }, delay ?? closeDelay!));
  }

  async function closeRoom(roomId: string, room: GameRoom): Promise<void> {
    try {
      await gameLogs.save(room.createArchive(roomId));
      rooms.close(roomId);
      io.in(roomId).socketsLeave(roomId);
      io.emit("roomList", rooms.list());
    } catch (error) {
      console.error(`Failed to close room ${roomId}:`, error);
      timers.set(roomId, setTimeout(() => {
        timers.delete(roomId);
        void closeRoom(roomId, room);
      }, 5_000));
    }
  }
}
