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

export type Role = "villager" | "seer" | "werewolf" | "madman";
export type Team = "villagers" | "werewolves";
export type GamePhase =
  | "waiting"
  | "nightDiscussion"
  | "nightAttack"
  | "dayDiscussion"
  | "dayVote"
  | "ended";

export type ChatChannel = "public" | "werewolf" | "monologue";
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
  votes: VoteSummary[];
  winner: Team | null;
}

export interface DivineResult {
  targetId: string;
  targetName: string;
  result: "human" | "werewolf";
  day: number;
}

export interface PrivateState {
  playerId: string | null;
  role: Role | null;
  divineResults: DivineResult[];
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

export interface ClientToServerEvents {
  joinGame: (payload: JoinGamePayload) => void;
  addBot: () => void;
  startGame: () => void;
  updateRoomSettings: (settings: RoomSettings) => void;
  sendChat: (payload: { text: string; channel: ChatChannel }) => void;
  vote: (payload: { targetId: string }) => void;
  divine: (payload: { targetId: string }) => void;
  attack: (payload: { targetId: string }) => void;
}

export interface ServerToClientEvents {
  gameState: (state: PublicGameState) => void;
  privateState: (state: PrivateState) => void;
  chatMessage: (message: ChatMessage) => void;
  phaseChanged: (state: PublicGameState) => void;
  actionError: (payload: { message: string }) => void;
  gameEnded: (payload: GameEndPayload) => void;
}
