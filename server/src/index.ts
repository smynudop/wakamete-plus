import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@wakamete-plus/shared";
import { GameRoom, type GameEventBundle } from "./game.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: true
  }
});

const room = new GameRoom();
let timer: NodeJS.Timeout | null = null;

const frontendDist = path.resolve(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));
app.get("*", (_request, response) => {
  response.sendFile(path.join(frontendDist, "index.html"));
});

io.on("connection", (socket) => {
  emitToSocket(socket.id);

  socket.on("joinGame", (payload) => handle(socket.id, () => room.join(socket.id, payload)));
  socket.on("addBot", () => handle(socket.id, () => room.addBot(socket.id)));
  socket.on("startGame", () => handle(socket.id, () => room.start(socket.id)));
  socket.on("updateRoomSettings", (settings) => handle(socket.id, () => room.updateRoomSettings(socket.id, settings)));
  socket.on("sendChat", (payload) => handle(socket.id, () => room.sendChat(socket.id, payload.text)));
  socket.on("vote", (payload) => handle(socket.id, () => room.vote(socket.id, payload.targetId)));
  socket.on("divine", (payload) => handle(socket.id, () => room.divine(socket.id, payload.targetId)));
  socket.on("attack", (payload) => handle(socket.id, () => room.attack(socket.id, payload.targetId)));
  socket.on("disconnect", () => {
    broadcast(room.disconnect(socket.id));
  });
});

function handle(socketId: string, action: () => GameEventBundle): void {
  try {
    broadcastWithBots(action());
  } catch (error) {
    io.to(socketId).emit("actionError", { message: error instanceof Error ? error.message : "操作に失敗しました。" });
  }
}

function broadcastWithBots(bundle: GameEventBundle): void {
  broadcast(bundle);
  const botBundle = room.runBotActions();
  if (botBundle.chats.length > 0 || botBundle.phaseChanged || botBundle.ended) {
    broadcast(botBundle);
  }
}

function broadcast(bundle: GameEventBundle): void {
  io.emit("gameState", bundle.state);
  if (bundle.phaseChanged) {
    io.emit("phaseChanged", bundle.state);
  }
  for (const message of bundle.chats) {
    if (message.channel === "werewolf") {
      for (const [socketId, privateState] of bundle.privateStates) {
        if (privateState.role === "werewolf") {
          io.to(socketId).emit("chatMessage", message);
        }
      }
    } else {
      io.emit("chatMessage", message);
    }
  }
  for (const socketId of io.sockets.sockets.keys()) {
    io.to(socketId).emit("privateState", room.getPrivateState(socketId));
  }
  if (bundle.ended) {
    io.emit("gameEnded", bundle.ended);
  }
  scheduleTimer();
}

function emitToSocket(socketId: string): void {
  io.to(socketId).emit("gameState", room.getState());
  io.to(socketId).emit("privateState", room.getPrivateState(socketId));
}

function scheduleTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const delay = room.getTimerDelay();
  if (delay === null) {
    return;
  }
  timer = setTimeout(() => {
    broadcastWithBots(room.advanceTimer());
  }, delay);
}

const port = Number(process.env.PORT ?? 3000);
httpServer.listen(port, () => {
  console.log(`Wakamete Plus server listening on http://localhost:${port}`);
});
