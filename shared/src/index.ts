export const FIRST_VICTIM_NAME = "初日犠牲者";
export const HUMAN_PLAYER_LIMIT = 5;
export const TOTAL_PLAYER_COUNT = 6;
export const PLAYER_COLORS = [
  "#d94f45",
  "#d9892b",
  "#d4b33c",
  "#5fa34a",
  "#2d9b87",
  "#2f80c7",
  "#5c6bc0",
  "#8e5bbf",
  "#c05a9f",
  "#6f6259"
] as const;
export const DEFAULT_PLAYER_COLOR = PLAYER_COLORS[0];

export type Role =
  | "villager"
  | "seer"
  | "werewolf"
  | "madman"
  | "medium"
  | "hunter"
  | "shared"
  | "fox";
export type Team = "villagers" | "werewolves" | "fox";
export type Species = "human" | "werewolf" | "fox";

export interface RoleProperties {
  species: Species;
  side: Team;
}

export const DEFAULT_ROLE_PROPERTIES: Readonly<RoleProperties> = {
  species: "human",
  side: "villagers"
};

function roleProperties(overrides: Partial<RoleProperties> = {}): Readonly<RoleProperties> {
  return { ...DEFAULT_ROLE_PROPERTIES, ...overrides };
}

export const ROLE_PROPERTIES: Readonly<Record<Role, Readonly<RoleProperties>>> = {
  villager: roleProperties(),
  seer: roleProperties(),
  werewolf: roleProperties({ species: "werewolf", side: "werewolves" }),
  madman: roleProperties({ side: "werewolves" }),
  medium: roleProperties(),
  hunter: roleProperties(),
  shared: roleProperties(),
  fox: roleProperties({ species: "fox", side: "fox" })
};

export type GamePhase =
  | "waiting"
  | "nightDiscussion"
  | "nightAttack"
  | "dayDiscussion"
  | "dayVote"
  | "ended";

export type ChatChannel = "public" | "werewolf" | "shared" | "monologue";
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export interface RoomSettings {
  roomName: string;
  pr: string;
  durationSeconds: Record<Exclude<GamePhase, "waiting" | "ended">, number>;
  playerLimit: number;
}

export interface JoinGamePayload {
  name: string;
  handleName?: string;
  color?: string;
  password?: string;
  sessionToken?: string;
}

export interface CreateRoomPayload {
  settings: RoomSettings;
  player: JoinGamePayload;
}

export interface JoinRoomPayload {
  roomId: string;
  player: JoinGamePayload;
}

export type LobbyRoomStatus = "waiting" | "playing" | "ended";

export interface LobbyRoom {
  id: string;
  roomName: string;
  pr: string;
  playerCount: number;
  playerLimit: number;
  phase: GamePhase;
  day: number;
  status: LobbyRoomStatus;
}

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  alive: boolean;
  npc: boolean;
  bot: boolean;
  gameMaster: boolean;
  connected: boolean;
  role?: Role;
}

export interface PhaseTimer {
  startedAt: number;
  endsAt: number;
}

export interface VoteSummary {
  voterId: string;
  targetId: string;
}

export interface PublicGameState {
  room: RoomSettings;
  phase: GamePhase;
  day: number;
  players: PublicPlayer[];
  timer: PhaseTimer | null;
  canStart: boolean;
  winner: Team | null;
}

export interface GameLogEntry {
  id: string;
  kind: "event" | "chat";
  text: string;
  day: number;
  phase: GamePhase;
  sentAt: number;
  channel?: ChatChannel;
  senderId?: string;
  senderName?: string;
}

export interface DivineResult {
  targetId: string;
  targetName: string;
  result: "human" | "werewolf";
  day: number;
}

export interface MediumResult {
  targetId: string;
  targetName: string;
  result: "human" | "werewolf";
  day: number;
}

export interface PrivateState {
  playerId: string | null;
  role: Role | null;
  divineResults: DivineResult[];
  mediumResults: MediumResult[];
  sharedPlayerIds: string[];
  log: GameLogEntry[];
  sessionToken: string | null;
}

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: number;
  day: number;
  phase: GamePhase;
}

export interface GameEndPayload {
  winner: Team;
  players: (Required<Pick<PublicPlayer, "id" | "name" | "color" | "alive" | "npc" | "role">> & {
    handleName: string;
  })[];
  log: string[];
}

export interface ArchivedGameLog {
  schemaVersion: 1;
  roomId: string;
  room: RoomSettings;
  startedAt: number;
  endedAt: number;
  closedAt: number;
  winner: Team;
  players: GameEndPayload["players"];
  entries: GameLogEntry[];
}

export interface ClientToServerEvents {
  createRoom: (payload: CreateRoomPayload) => void;
  joinRoom: (payload: JoinRoomPayload) => void;
  leaveRoom: () => void;
  joinGame: (payload: JoinGamePayload) => void;
  addBot: () => void;
  startGame: () => void;
  updateRoomSettings: (settings: RoomSettings) => void;
  sendChat: (payload: { text: string; channel: ChatChannel }) => void;
  vote: (payload: { targetId: string }) => void;
  divine: (payload: { targetId: string }) => void;
  guard: (payload: { targetId: string }) => void;
  attack: (payload: { targetId: string }) => void;
}

export interface ServerToClientEvents {
  roomList: (rooms: LobbyRoom[]) => void;
  roomCreated: (payload: { roomId: string; sessionToken: string }) => void;
  roomJoined: (payload: { roomId: string }) => void;
  roomLeft: () => void;
  gameState: (state: PublicGameState) => void;
  privateState: (state: PrivateState) => void;
  logEntry: (entry: GameLogEntry) => void;
  phaseChanged: (state: PublicGameState) => void;
  actionError: (payload: { message: string }) => void;
  gameEnded: (payload: GameEndPayload) => void;
}
