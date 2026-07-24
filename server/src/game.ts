import {
  DEFAULT_PLAYER_COLOR,
  FIRST_VICTIM_NAME,
  PLAYER_COLORS,
  type ChatChannel,
  type ChatMessage,
  type DivineResult,
  type GameEndPayload,
  type GamePhase,
  type JoinGamePayload,
  type PhaseTimer,
  type PrivateState,
  type PublicGameState,
  type PublicPlayer,
  type Role,
  type RoomSettings,
  type Team,
  type VoteSummary
} from "@wakamete-plus/shared";

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  roomName: "【モバマス】ほげほげふがふが村",
  pr: "初心者でも誰でも歓迎！更新時間23:00",
  durationSeconds: {
    dayDiscussion: 180,
    dayVote: 60,
    nightDiscussion: 90,
    nightAttack: 60
  },
  playerLimit: 6
};

export const PHASE_DURATIONS_SECONDS = DEFAULT_ROOM_SETTINGS.durationSeconds;

const MIN_DURATION_SECONDS = 30;
const MAX_DURATION_SECONDS = 300;
const MIN_PLAYER_LIMIT = 4;
const MAX_PLAYER_LIMIT = 20;

function normalizeRoomSettings(settings: RoomSettings): RoomSettings {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  return {
    roomName: settings.roomName.trim() || DEFAULT_ROOM_SETTINGS.roomName,
    pr: settings.pr.trim() || DEFAULT_ROOM_SETTINGS.pr,
    durationSeconds: {
      dayDiscussion: clamp(settings.durationSeconds.dayDiscussion, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS),
      dayVote: clamp(settings.durationSeconds.dayVote, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS),
      nightDiscussion: clamp(settings.durationSeconds.nightDiscussion, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS),
      nightAttack: clamp(settings.durationSeconds.nightAttack, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS)
    },
    playerLimit: clamp(Math.floor(settings.playerLimit), MIN_PLAYER_LIMIT, MAX_PLAYER_LIMIT)
  };
}

const FIRST_VICTIM_COLOR = "#9a9690";

interface PlayerJoinOptions {
  name: string;
  handleName?: string;
  color?: string;
  password?: string;
}

const DEFAULT_JOIN_OPTIONS: PlayerJoinOptions = {
  name: ""
};

interface Player {
  id: string;
  name: string;
  handleName: string;
  color: string;
  password: string;
  alive: boolean;
  npc: boolean;
  connected: boolean;
  role: Role | null;
  divineResults: DivineResult[];
}

interface PhaseActionResult {
  phaseChanged: boolean;
  gameEnded: GameEndPayload | null;
}

export interface GameEventBundle {
  state: PublicGameState;
  privateStates: Map<string, PrivateState>;
  chats: ChatMessage[];
  ended: GameEndPayload | null;
  phaseChanged: boolean;
}

const ROLE_LABELS: Record<Role, string> = {
  villager: "村人",
  seer: "占い師",
  werewolf: "人狼",
  madman: "狂人"
};

const PHASE_LABELS: Record<GamePhase, string> = {
  waiting: "待機中",
  nightDiscussion: "夜の議論",
  nightAttack: "夜の襲撃",
  dayDiscussion: "昼の議論",
  dayVote: "昼の投票",
  ended: "終了"
};

export class GameRoom {
  private players = new Map<string, Player>();
  private socketToPlayer = new Map<string, string>();
  private phase: GamePhase = "waiting";
  private day = 0;
  private timer: PhaseTimer | null = null;
  private votes = new Map<string, string>();
  private attackTargetId: string | null = null;
  private chatSeq = 0;
  private playerSeq = 0;
  private log: string[] = [];
  private winner: Team | null = null;
  private readonly settings: RoomSettings;

  constructor(private readonly now: () => number = () => Date.now(), settings: RoomSettings = DEFAULT_ROOM_SETTINGS) {
    this.settings = normalizeRoomSettings(settings);
  }

  join(socketId: string, payload: string | JoinGamePayload): GameEventBundle {
    const options = typeof payload === "string" ? { ...DEFAULT_JOIN_OPTIONS, name: payload } : payload;
    const name = options.name.trim();
    const handleName = (options.handleName?.trim() || name).slice(0, 24);
    const color = PLAYER_COLORS.includes(options.color as (typeof PLAYER_COLORS)[number]) ? options.color! : DEFAULT_PLAYER_COLOR;
    const password = options.password?.trim() ?? "";
    if (!name) {
      throw new Error("名前を入力してください。");
    }
    if (this.phase !== "waiting") {
      throw new Error("ゲーム開始後は参加できません。");
    }
    if (this.humanPlayers().length >= this.humanLimit()) {
      throw new Error(`参加枠は${this.humanLimit()}人までです。`);
    }
    if (this.humanPlayers().some((player) => player.name === name)) {
      throw new Error("同じ名前のプレイヤーがいます。");
    }

    const player: Player = {
      id: `p${++this.playerSeq}`,
      name,
      handleName,
      color,
      password,
      alive: true,
      npc: false,
      connected: true,
      role: null,
      divineResults: []
    };
    this.players.set(player.id, player);
    this.socketToPlayer.set(socketId, player.id);
    this.log.push(`${name} が参加しました。`);
    return this.bundle(false, null);
  }

  disconnect(socketId: string): GameEventBundle {
    const player = this.getSocketPlayer(socketId);
    if (player) {
      player.connected = false;
    }
    this.socketToPlayer.delete(socketId);
    return this.bundle(false, null);
  }

  start(socketId: string): GameEventBundle {
    this.requireSocketPlayer(socketId);
    if (this.phase !== "waiting") {
      throw new Error("ゲームはすでに開始しています。");
    }
    if (this.humanPlayers().length !== this.humanLimit()) {
      throw new Error(`${this.humanLimit()}人そろうと開始できます。`);
    }

    this.addFirstVictim();
    this.assignRoles();
    this.day = 1;
    this.log.push("ゲームを開始しました。");
    this.setPhase("nightDiscussion");
    return this.bundle(true, null);
  }

  sendChat(socketId: string, text: string): GameEventBundle {
    const player = this.requireAliveSocketPlayer(socketId);
    const normalizedText = text.trim();
    if (!normalizedText) {
      throw new Error("メッセージを入力してください。");
    }

    let channel: ChatChannel;
    if (this.phase === "dayDiscussion") {
      channel = "public";
    } else if (this.phase === "nightDiscussion" && player.role === "werewolf") {
      channel = "werewolf";
    } else {
      throw new Error("このフェーズではチャットできません。");
    }

    const message: ChatMessage = {
      id: `m${++this.chatSeq}`,
      channel,
      senderId: player.id,
      senderName: player.name,
      text: normalizedText,
      sentAt: this.now(),
      day: this.day,
      phase: this.phase
    };
    return { ...this.bundle(false, null), chats: [message] };
  }

  vote(socketId: string, targetId: string): GameEventBundle {
    const voter = this.requireAliveSocketPlayer(socketId);
    if (this.phase !== "dayVote") {
      throw new Error("投票フェーズではありません。");
    }
    const target = this.requireAlivePlayer(targetId);
    if (voter.id === target.id) {
      throw new Error("自分には投票できません。");
    }
    this.votes.set(voter.id, target.id);
    this.log.push(`${voter.name} が ${target.name} に投票しました。`);
    const result = this.allLivingHumansActed(this.votes) ? this.resolveCurrentPhase() : { phaseChanged: false, gameEnded: null };
    return this.bundle(result.phaseChanged, result.gameEnded);
  }

  divine(socketId: string, targetId: string): GameEventBundle {
    const seer = this.requireAliveSocketPlayer(socketId);
    if (this.phase !== "nightDiscussion") {
      throw new Error("占いは夜の議論中に行えます。");
    }
    if (seer.role !== "seer") {
      throw new Error("占い師だけが占えます。");
    }
    const target = this.requireAlivePlayer(targetId);
    if (seer.id === target.id) {
      throw new Error("自分は占えません。");
    }
    const result: DivineResult = {
      targetId: target.id,
      targetName: target.name,
      result: target.role === "werewolf" ? "werewolf" : "human",
      day: this.day
    };
    seer.divineResults.push(result);
    this.log.push(`${seer.name} が ${target.name} を占いました。`);
    return this.bundle(false, null);
  }

  attack(socketId: string, targetId: string): GameEventBundle {
    const werewolf = this.requireAliveSocketPlayer(socketId);
    if (this.phase !== "nightAttack") {
      throw new Error("襲撃フェーズではありません。");
    }
    if (werewolf.role !== "werewolf") {
      throw new Error("人狼だけが襲撃できます。");
    }
    const target = this.requireAlivePlayer(targetId);
    if (this.day === 1 && target.name !== FIRST_VICTIM_NAME) {
      throw new Error("1日目は初日犠牲者だけを襲撃できます。");
    }
    if (this.day > 1 && target.role === "werewolf") {
      throw new Error("人狼は襲撃対象にできません。");
    }
    this.attackTargetId = target.id;
    this.log.push(`${werewolf.name} が襲撃先を ${target.name} に選びました。`);
    const result = this.resolveCurrentPhase();
    return this.bundle(result.phaseChanged, result.gameEnded);
  }

  advanceTimer(): GameEventBundle {
    const result = this.resolveCurrentPhase();
    return this.bundle(result.phaseChanged, result.gameEnded);
  }

  getState(): PublicGameState {
    return {
      room: this.settings,
      phase: this.phase,
      day: this.day,
      players: [...this.players.values()].map((player) => this.toPublicPlayer(player)),
      timer: this.timer,
      canStart: this.phase === "waiting" && this.humanPlayers().length === this.humanLimit(),
      votes: this.voteSummary(),
      winner: this.winner
    };
  }

  getPrivateState(socketId: string): PrivateState {
    const player = this.getSocketPlayer(socketId);
    return {
      playerId: player?.id ?? null,
      role: player?.role ?? null,
      divineResults: player?.divineResults ?? []
    };
  }

  getTimerDelay(): number | null {
    if (!this.timer || this.phase === "waiting" || this.phase === "ended") {
      return null;
    }
    return Math.max(0, this.timer.endsAt - this.now());
  }

  getDebugPlayersForTests(): { id: string; name: string; alive: boolean; npc: boolean; role: Role | null }[] {
    return [...this.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      alive: player.alive,
      npc: player.npc,
      role: player.role
    }));
  }

  private resolveCurrentPhase(): PhaseActionResult {
    if (this.phase === "dayDiscussion") {
      this.setPhase("dayVote");
      return { phaseChanged: true, gameEnded: null };
    }

    if (this.phase === "dayVote") {
      this.resolveVote();
      const winner = this.checkWinner();
      if (winner) {
        return this.endGame(winner);
      }
      this.setPhase("nightDiscussion");
      return { phaseChanged: true, gameEnded: null };
    }

    if (this.phase === "nightDiscussion") {
      this.setPhase("nightAttack");
      return { phaseChanged: true, gameEnded: null };
    }

    if (this.phase === "nightAttack") {
      this.resolveAttack();
      const winner = this.checkWinner();
      if (winner) {
        return this.endGame(winner);
      }
      this.day += 1;
      this.setPhase("dayDiscussion");
      return { phaseChanged: true, gameEnded: null };
    }

    return { phaseChanged: false, gameEnded: null };
  }

  private resolveVote(): void {
    const counts = new Map<string, number>();
    for (const targetId of this.votes.values()) {
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
    }
    this.log.push(`投票結果: ${this.voteSummary().map((vote) => `${this.playerName(vote.voterId)} -> ${this.playerName(vote.targetId)}`).join(", ") || "全員棄権"}`);
    this.votes.clear();
    if (counts.size === 0) {
      this.log.push("処刑は行われませんでした。");
      return;
    }

    const maxVotes = Math.max(...counts.values());
    const candidates = [...counts.entries()].filter(([, count]) => count === maxVotes).map(([id]) => id);
    const executed = this.requirePlayer(this.pick(candidates));
    executed.alive = false;
    this.log.push(`${executed.name} が処刑されました。`);
  }

  private resolveAttack(): void {
    let target = this.attackTargetId ? this.players.get(this.attackTargetId) : undefined;
    if (this.day === 1) {
      target = [...this.players.values()].find((player) => player.name === FIRST_VICTIM_NAME && player.alive);
    }
    if (!target || !target.alive) {
      const candidates = this.livingPlayers().filter((player) => player.role !== "werewolf");
      target = this.pick(candidates);
    }
    this.attackTargetId = null;
    if (!target) {
      return;
    }
    target.alive = false;
    this.log.push(`${target.name} が襲撃されました。`);
  }

  private checkWinner(): Team | null {
    const living = this.livingPlayers();
    const werewolves = living.filter((player) => player.role === "werewolf").length;
    const humans = living.length - werewolves;
    if (werewolves === 0) {
      return "villagers";
    }
    if (werewolves >= humans) {
      return "werewolves";
    }
    return null;
  }

  private endGame(winner: Team): PhaseActionResult {
    this.winner = winner;
    this.phase = "ended";
    this.timer = null;
    this.log.push(`${winner === "villagers" ? "村人" : "人狼"}陣営の勝利です。`);
    return {
      phaseChanged: true,
      gameEnded: {
        winner,
        players: [...this.players.values()].map((player) => ({
          id: player.id,
          name: player.name,
          handleName: player.handleName,
          color: player.color,
          alive: player.alive,
          npc: player.npc,
          role: this.requireRole(player)
        })),
        log: [...this.log]
      }
    };
  }

  private setPhase(phase: Exclude<GamePhase, "waiting" | "ended">): void {
    this.phase = phase;
    this.votes.clear();
    this.attackTargetId = null;
    const startedAt = this.now();
    this.timer = {
      startedAt,
      endsAt: startedAt + this.settings.durationSeconds[phase] * 1000
    };
    this.log.push(`${this.day}日目: ${PHASE_LABELS[phase]} が始まりました。`);
  }

  private addFirstVictim(): void {
    const firstVictim: Player = {
      id: "npc-first-victim",
      name: FIRST_VICTIM_NAME,
      handleName: FIRST_VICTIM_NAME,
      color: FIRST_VICTIM_COLOR,
      password: "",
      alive: true,
      npc: true,
      connected: false,
      role: null,
      divineResults: []
    };
    this.players.set(firstVictim.id, firstVictim);
  }

  private assignRoles(): void {
    const firstVictim = [...this.players.values()].find((player) => player.name === FIRST_VICTIM_NAME);
    if (!firstVictim) {
      throw new Error("初日犠牲者が見つかりません。");
    }

    const humans = this.shuffle(this.humanPlayers());
    const werewolf = humans[0];
    if (!werewolf) {
      throw new Error("人狼を割り当てられません。");
    }
    werewolf.role = "werewolf";

    const remainingRoles: Role[] = ["madman", "seer", "villager", "villager", "villager"];
    const remainingPlayers = this.shuffle([...humans.slice(1), firstVictim]);
    remainingPlayers.forEach((player, index) => {
      player.role = remainingRoles[index] ?? "villager";
    });
  }

  private bundle(phaseChanged: boolean, ended: GameEndPayload | null): GameEventBundle {
    return {
      state: this.getState(),
      privateStates: new Map([...this.socketToPlayer.keys()].map((socketId) => [socketId, this.getPrivateState(socketId)])),
      chats: [],
      ended,
      phaseChanged
    };
  }

  private humanPlayers(): Player[] {
    return [...this.players.values()].filter((player) => !player.npc);
  }

  private humanLimit(): number {
    return this.settings.playerLimit - 1;
  }

  private livingPlayers(): Player[] {
    return [...this.players.values()].filter((player) => player.alive);
  }

  private allLivingHumansActed(actions: Map<string, string>): boolean {
    return this.livingPlayers().filter((player) => !player.npc).every((player) => actions.has(player.id));
  }

  private voteSummary(): VoteSummary[] {
    return [...this.votes.entries()].map(([voterId, targetId]) => ({ voterId, targetId }));
  }

  private getSocketPlayer(socketId: string): Player | undefined {
    const playerId = this.socketToPlayer.get(socketId);
    return playerId ? this.players.get(playerId) : undefined;
  }

  private requireSocketPlayer(socketId: string): Player {
    const player = this.getSocketPlayer(socketId);
    if (!player) {
      throw new Error("先に参加してください。");
    }
    return player;
  }

  private requireAliveSocketPlayer(socketId: string): Player {
    const player = this.requireSocketPlayer(socketId);
    if (!player.alive) {
      throw new Error("死亡したプレイヤーは行動できません。");
    }
    return player;
  }

  private requirePlayer(playerId: string): Player {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error("対象が見つかりません。");
    }
    return player;
  }

  private requireAlivePlayer(playerId: string): Player {
    const player = this.requirePlayer(playerId);
    if (!player.alive) {
      throw new Error("死亡者は対象にできません。");
    }
    return player;
  }

  private requireRole(player: Player): Role {
    if (!player.role) {
      throw new Error(`${player.name} の役職が未設定です。`);
    }
    return player.role;
  }

  private toPublicPlayer(player: Player): PublicPlayer {
    return {
      id: player.id,
      name: player.name,
      color: player.color,
      alive: player.alive,
      npc: player.npc,
      connected: player.connected,
      role: this.phase === "ended" ? this.requireRole(player) : undefined
    };
  }

  private playerName(playerId: string): string {
    return this.players.get(playerId)?.name ?? playerId;
  }

  private shuffle<T>(items: T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5);
  }

  private pick<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error("候補がありません。");
    }
    return items[Math.floor(Math.random() * items.length)] as T;
  }
}

export { ROLE_LABELS, PHASE_LABELS };
