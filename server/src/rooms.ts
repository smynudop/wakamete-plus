import { randomUUID } from "node:crypto";
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  LobbyRoom,
  PublicGameState
} from "@wakamete-plus/shared";
import { GameRoom, type GameEventBundle } from "./game.js";

export interface ManagedRoomResult {
  roomId: string;
  room: GameRoom;
  bundle: GameEventBundle;
}

interface ManagedRoom {
  room: GameRoom;
  createdAt: number;
}

export class RoomManager {
  private readonly rooms = new Map<string, ManagedRoom>();
  private readonly socketRooms = new Map<string, string>();

  constructor(
    private readonly createRoomId: () => string = () => randomUUID(),
    private readonly createGameRoom: () => GameRoom = () => new GameRoom(),
    private readonly now: () => number = () => Date.now()
  ) {}

  create(socketId: string, payload: CreateRoomPayload): ManagedRoomResult {
    this.requireNoRoom(socketId);
    const roomId = this.uniqueRoomId();
    const room = this.createGameRoom();
    const bundle = room.create(socketId, payload.player);
    room.updateRoomSettings(socketId, payload.settings);
    this.rooms.set(roomId, { room, createdAt: this.now() });
    this.socketRooms.set(socketId, roomId);
    return { roomId, room, bundle: this.bundleWithCurrentState(room, bundle) };
  }

  join(socketId: string, payload: JoinRoomPayload): ManagedRoomResult {
    this.requireNoRoom(socketId);
    const room = this.requireRoom(payload.roomId);
    const bundle = room.join(socketId, payload.player);
    this.socketRooms.set(socketId, payload.roomId);
    return { roomId: payload.roomId, room, bundle };
  }

  watch(socketId: string, roomId: string): ManagedRoomResult {
    this.requireNoRoom(socketId);
    const room = this.requireRoom(roomId);
    this.socketRooms.set(socketId, roomId);
    return {
      roomId,
      room,
      bundle: {
        state: room.getState(),
        privateStates: new Map([[socketId, room.getPrivateState(socketId)]]),
        chats: [], events: [], ended: null, phaseChanged: false
      }
    };
  }

  joinWatched(socketId: string, player: JoinRoomPayload["player"]): ManagedRoomResult {
    const roomId = this.socketRooms.get(socketId);
    if (!roomId) throw new Error("先にルームを観戦してください。");
    const room = this.requireRoom(roomId);
    const bundle = room.join(socketId, player);
    return { roomId, room, bundle };
  }

  leave(socketId: string): ManagedRoomResult | null {
    const roomId = this.socketRooms.get(socketId);
    if (!roomId) {
      return null;
    }
    const room = this.requireRoom(roomId);
    this.socketRooms.delete(socketId);
    return { roomId, room, bundle: room.disconnect(socketId) };
  }

  disconnect(socketId: string): ManagedRoomResult | null {
    return this.leave(socketId);
  }

  roomForSocket(socketId: string): { roomId: string; room: GameRoom } {
    const roomId = this.socketRooms.get(socketId);
    if (!roomId) {
      throw new Error("先にルームへ参加してください。");
    }
    return { roomId, room: this.requireRoom(roomId) };
  }

  getRoom(roomId: string): GameRoom {
    return this.requireRoom(roomId);
  }

  list(): LobbyRoom[] {
    return [...this.rooms.entries()].map(([id, managed]) =>
      this.toLobbyRoom(id, managed.room.getState())
    );
  }

  close(roomId: string): boolean {
    if (!this.rooms.delete(roomId)) {
      return false;
    }
    for (const [socketId, mappedRoomId] of this.socketRooms) {
      if (mappedRoomId === roomId) {
        this.socketRooms.delete(socketId);
      }
    }
    return true;
  }

  expiredWaitingRoomIds(maxAgeMs: number): string[] {
    const cutoff = this.now() - maxAgeMs;
    return [...this.rooms.entries()]
      .filter(([, managed]) =>
        managed.createdAt <= cutoff && managed.room.getState().phase === "waiting"
      )
      .map(([roomId]) => roomId);
  }

  private toLobbyRoom(id: string, state: PublicGameState): LobbyRoom {
    return {
      id,
      roomName: state.room.roomName,
      pr: state.room.pr,
      playerCount: state.players.length,
      playerLimit: state.room.playerLimit,
      phase: state.phase,
      day: state.day,
      status: state.phase === "waiting" ? "waiting" : state.phase === "ended" ? "ended" : "playing"
    };
  }

  private requireRoom(roomId: string): GameRoom {
    const managed = this.rooms.get(roomId);
    if (!managed) {
      throw new Error("指定したルームが見つかりません。");
    }
    return managed.room;
  }

  private requireNoRoom(socketId: string): void {
    if (this.socketRooms.has(socketId)) {
      throw new Error("別のルームから退出してから操作してください。");
    }
  }

  private uniqueRoomId(): string {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const roomId = this.createRoomId();
      if (roomId && !this.rooms.has(roomId)) {
        return roomId;
      }
    }
    throw new Error("ルームIDを作成できませんでした。");
  }

  private bundleWithCurrentState(room: GameRoom, bundle: GameEventBundle): GameEventBundle {
    return {
      ...bundle,
      state: room.getState(),
      privateStates: new Map(
        [...bundle.privateStates.keys()].map((socketId) => [socketId, room.getPrivateState(socketId)])
      )
    };
  }
}
