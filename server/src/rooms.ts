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

export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();
  private readonly socketRooms = new Map<string, string>();

  constructor(
    private readonly createRoomId: () => string = () => randomUUID(),
    private readonly createGameRoom: () => GameRoom = () => new GameRoom()
  ) {}

  create(socketId: string, payload: CreateRoomPayload): ManagedRoomResult {
    this.requireNoRoom(socketId);
    const roomId = this.uniqueRoomId();
    const room = this.createGameRoom();
    const bundle = room.create(socketId, payload.player);
    room.updateRoomSettings(socketId, payload.settings);
    this.rooms.set(roomId, room);
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
    return [...this.rooms.entries()].map(([id, room]) => this.toLobbyRoom(id, room.getState()));
  }

  close(roomId: string): void {
    this.requireRoom(roomId);
    this.rooms.delete(roomId);
    for (const [socketId, mappedRoomId] of this.socketRooms) {
      if (mappedRoomId === roomId) {
        this.socketRooms.delete(socketId);
      }
    }
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
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error("指定したルームが見つかりません。");
    }
    return room;
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
