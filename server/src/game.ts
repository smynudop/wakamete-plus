import {
  DEFAULT_PLAYER_COLOR,
  FIRST_VICTIM_NAME,
  PLAYER_COLORS,
  ROLE_PROPERTIES,
  type ChatChannel,
  type ChatMessage,
  type DivineResult,
  type MediumResult,
  type GameEndPayload,
  type ArchivedGameLog,
  type GameLogEntry,
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
import { randomUUID } from "node:crypto";
import { ROLE_SET_PLAYER_COUNTS, rolesForPlayerCount } from "./role-sets.js";

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
const MIN_PLAYER_LIMIT = ROLE_SET_PLAYER_COUNTS[0] ?? 4;
const MAX_PLAYER_LIMIT = ROLE_SET_PLAYER_COUNTS.at(-1) ?? 20;
const POST_GAME_CHAT_DURATION_MS = 5 * 60 * 1000;

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
  sessionToken?: string;
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
  bot: boolean;
  gameMaster: boolean;
  connected: boolean;
  sessionToken: string | null;
  role: Role | null;
  divineResults: DivineResult[];
  mediumResults: MediumResult[];
}

interface PhaseActionResult {
  phaseChanged: boolean;
  gameEnded: GameEndPayload | null;
}

export interface GameEventBundle {
  state: PublicGameState;
  privateStates: Map<string, PrivateState>;
  chats: ChatMessage[];
  events: GameLogDispatch[];
  ended: GameEndPayload | null;
  phaseChanged: boolean;
}

export interface GameLogDispatch {
  entry: GameLogEntry;
  audience: "public" | "werewolves" | "shared" | "private";
  playerId?: string;
}

const ROLE_LABELS: Record<Role, string> = {
  villager: "村人",
  seer: "占い師",
  werewolf: "人狼",
  madman: "狂人",
  medium: "霊能者",
  hunter: "狩人",
  shared: "共有者",
  fox: "妖狐"
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
  private guardTargetId: string | null = null;
  private attackedPlayerIds = new Set<string>();
  private guardedPlayerIds = new Set<string>();
  private divinedFoxIds = new Set<string>();
  private chatSeq = 0;
  private logSeq = 0;
  private playerSeq = 0;
  private botSeq = 0;
  private botActions = new Set<string>();
  private log: string[] = [];
  private history: { entry: GameLogEntry; audience: GameLogDispatch["audience"]; playerId?: string }[] = [];
  private pendingEvents: GameLogDispatch[] = [];
  private winner: Team | null = null;
  private startedAt: number | null = null;
  private endedAt: number | null = null;
  private postGameChatEndsAt: number | null = null;
  private settings: RoomSettings;

  constructor(
    private readonly now: () => number = () => Date.now(),
    settings: RoomSettings = DEFAULT_ROOM_SETTINGS,
    private readonly createSessionToken: () => string = randomUUID,
    private readonly random: () => number = Math.random
  ) {
    this.settings = normalizeRoomSettings(settings);
    this.addFirstVictim();
  }

  join(socketId: string, payload: string | JoinGamePayload): GameEventBundle {
    const options = typeof payload === "string" ? { ...DEFAULT_JOIN_OPTIONS, name: payload } : payload;
    const name = options.name.trim();
    const handleName = (options.handleName?.trim() || name).slice(0, 24);
    const color = PLAYER_COLORS.includes(options.color as (typeof PLAYER_COLORS)[number]) ? options.color! : DEFAULT_PLAYER_COLOR;
    const password = options.password?.trim() ?? "";
    const sessionToken = options.sessionToken?.trim() ?? "";
    const currentPlayer = this.getSocketPlayer(socketId);
    const sessionPlayer = sessionToken
      ? this.humanPlayers().find((player) => !player.bot && player.sessionToken === sessionToken)
      : undefined;
    if (sessionPlayer) {
      if (currentPlayer && currentPlayer.id !== sessionPlayer.id) {
        throw new Error("この接続は別のプレイヤーとして参加済みです。");
      }
      return this.reconnect(socketId, sessionPlayer);
    }
    if (!name) {
      throw new Error("名前を入力してください。");
    }
    if (currentPlayer) {
      throw new Error("この接続は参加済みです。");
    }

    const existingPlayer = this.humanPlayers().find((player) => !player.bot && player.name === name);
    if (existingPlayer) {
      if (!existingPlayer.connected && existingPlayer.password && password === existingPlayer.password) {
        return this.reconnect(socketId, existingPlayer, true);
      }
      if (!existingPlayer.connected) {
        throw new Error("復帰用パスワードが一致しません。");
      }
      throw new Error("同じ名前のプレイヤーがいます。");
    }
    if (this.phase !== "waiting") {
      throw new Error("ゲーム開始後は参加できません。");
    }
    if (this.humanPlayers().length >= this.humanLimit()) {
      throw new Error(`参加枠は${this.humanLimit()}人までです。`);
    }

    const player: Player = {
      id: `p${++this.playerSeq}`,
      name,
      handleName,
      color,
      password,
      alive: true,
      npc: false,
      bot: false,
      gameMaster: false,
      connected: true,
      sessionToken: this.createSessionToken(),
      role: null,
      divineResults: [],
      mediumResults: []
    };
    this.players.set(player.id, player);
    this.socketToPlayer.set(socketId, player.id);
    this.record(`${name} が参加しました。`);
    return this.bundle(false, null);
  }

  create(socketId: string, payload: JoinGamePayload): GameEventBundle {
    if (this.humanPlayers().length > 0) {
      throw new Error("このルームには作成者が参加済みです。");
    }
    const joined = this.join(socketId, payload);
    const creator = this.requireSocketPlayer(socketId);
    creator.gameMaster = true;
    return {
      ...joined,
      state: this.getState(),
      privateStates: new Map([[socketId, this.getPrivateState(socketId)]])
    };
  }

  addBot(socketId: string): GameEventBundle {
    this.requireGameMaster(socketId);
    if (this.phase !== "waiting") {
      throw new Error("ゲーム開始後はBotを追加できません。");
    }
    if (this.humanPlayers().length >= this.humanLimit()) {
      throw new Error(`参加枠は${this.humanLimit()}人までです。`);
    }

    const botNumber = ++this.botSeq;
    const botSocketId = `bot-${botNumber}`;
    const player: Player = {
      id: `p${++this.playerSeq}`,
      name: `開発Bot${botNumber}`,
      handleName: "development-bot",
      color: PLAYER_COLORS[(botNumber - 1) % PLAYER_COLORS.length] ?? DEFAULT_PLAYER_COLOR,
      password: "",
      alive: true,
      npc: false,
      bot: true,
      gameMaster: false,
      connected: true,
      sessionToken: null,
      role: null,
      divineResults: [],
      mediumResults: []
    };
    this.players.set(player.id, player);
    this.socketToPlayer.set(botSocketId, player.id);
    this.record(`${player.name} が参加しました。`);
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
    this.requireGameMaster(socketId);
    if (this.phase !== "waiting") {
      throw new Error("ゲームはすでに開始しています。");
    }
    if (this.humanPlayers().length !== this.humanLimit()) {
      throw new Error(`${this.humanLimit()}人そろうと開始できます。`);
    }

    this.assignRoles();
    this.day = 1;
    this.startedAt = this.now();
    this.record("ゲームを開始しました。");
    this.setPhase("nightDiscussion");
    return this.bundle(true, null);
  }

  updateRoomSettings(socketId: string, settings: RoomSettings): GameEventBundle {
    this.requireGameMaster(socketId);
    if (this.phase !== "waiting") {
      throw new Error("ゲーム開始後はルーム設定を変更できません。");
    }
    const normalized = normalizeRoomSettings(settings);
    if (this.humanPlayers().length > normalized.playerLimit - 1) {
      throw new Error("現在の参加人数より少ない定員には変更できません。");
    }
    this.settings = normalized;
    return this.bundle(false, null);
  }

  sendChat(socketId: string, text: string, requestedChannel: ChatChannel = "public"): GameEventBundle {
    const player = this.requireSocketPlayer(socketId);
    const normalizedText = text.trim();
    if (!normalizedText) {
      throw new Error("メッセージを入力してください。");
    }

    let channel: ChatChannel;
    if (this.phase === "waiting") {
      channel = "public";
    } else if (this.phase === "ended") {
      if (this.postGameChatEndsAt === null || this.now() > this.postGameChatEndsAt) {
        throw new Error("終了後チャットの受付時間を過ぎています。");
      }
      channel = "public";
    } else {
      if (!player.alive) {
        throw new Error("死亡したプレイヤーは発言できません。");
      }
      if (this.phase === "dayDiscussion") {
        channel = "public";
      } else if (
        this.phase === "nightDiscussion"
        && requestedChannel === "werewolf"
        && player.role === "werewolf"
      ) {
        channel = "werewolf";
      } else if (
        this.phase === "nightDiscussion"
        && requestedChannel === "shared"
        && player.role === "shared"
      ) {
        channel = "shared";
      } else if (
        (this.phase === "nightDiscussion" || this.phase === "nightAttack")
        && requestedChannel === "monologue"
      ) {
        channel = "monologue";
      } else {
        throw new Error("このフェーズでは指定した発言を送信できません。");
      }
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
    this.storeChat(message);
    return { ...this.bundle(false, null), chats: [message] };
  }

  vote(socketId: string, targetId: string): GameEventBundle {
    const voter = this.requireAliveSocketPlayer(socketId);
    if (this.phase !== "dayDiscussion" && this.phase !== "dayVote") {
      throw new Error("投票は昼の議論・投票中に行えます。");
    }
    const target = this.requireAlivePlayer(targetId);
    if (voter.id === target.id) {
      throw new Error("自分には投票できません。");
    }
    this.votes.set(voter.id, target.id);
    this.record(`${voter.name} が ${target.name} に投票しました。`, "private", voter.id);
    const result = this.phase === "dayVote" && this.allLivingHumansActed(this.votes)
      ? this.resolveCurrentPhase()
      : { phaseChanged: false, gameEnded: null };
    return this.bundle(result.phaseChanged, result.gameEnded);
  }

  divine(socketId: string, targetId: string): GameEventBundle {
    const seer = this.requireAliveSocketPlayer(socketId);
    if (this.phase !== "nightDiscussion" && this.phase !== "nightAttack") {
      throw new Error("占いは夜の議論・襲撃中に行えます。");
    }
    if (seer.role !== "seer") {
      throw new Error("占い師だけが占えます。");
    }
    if (seer.divineResults.some((result) => result.day === this.day)) {
      throw new Error("占いは一晩に1回だけ行えます。");
    }
    const target = this.requireAlivePlayer(targetId);
    if (seer.id === target.id) {
      throw new Error("自分は占えません。");
    }
    this.performDivine(seer, target);
    return this.bundle(false, null);
  }

  private performDivine(seer: Player, target: Player): void {
    const result: DivineResult = {
      targetId: target.id,
      targetName: target.name,
      result: ROLE_PROPERTIES[this.requireRole(target)].species === "werewolf" ? "werewolf" : "human",
      day: this.day
    };
    seer.divineResults.push(result);
    if (ROLE_PROPERTIES[this.requireRole(target)].species === "fox") {
      this.divinedFoxIds.add(target.id);
    }
    this.record(
      `${seer.name} が ${target.name} を占いました（${result.result === "werewolf" ? "人狼" : "人間"}）。`,
      "private",
      seer.id
    );
  }

  guard(socketId: string, targetId: string): GameEventBundle {
    const hunter = this.requireAliveSocketPlayer(socketId);
    if (this.phase !== "nightDiscussion" && this.phase !== "nightAttack") {
      throw new Error("護衛は夜の議論・襲撃中に行えます。");
    }
    if (hunter.role !== "hunter") {
      throw new Error("狩人だけが護衛できます。");
    }
    if (this.guardedPlayerIds.has(hunter.id)) {
      throw new Error("護衛は一晩に1回だけ行えます。");
    }
    const target = this.requireAlivePlayer(targetId);
    if (hunter.id === target.id) {
      throw new Error("自分は護衛できません。");
    }
    this.guardTargetId = target.id;
    this.guardedPlayerIds.add(hunter.id);
    this.record(`${hunter.name} が ${target.name} を護衛しました。`, "private", hunter.id);
    return this.bundle(false, null);
  }

  attack(socketId: string, targetId: string): GameEventBundle {
    const werewolf = this.requireAliveSocketPlayer(socketId);
    if (this.phase !== "nightDiscussion" && this.phase !== "nightAttack") {
      throw new Error("襲撃は夜の議論・襲撃中に行えます。");
    }
    if (werewolf.role !== "werewolf") {
      throw new Error("人狼だけが襲撃できます。");
    }
    if (this.attackedPlayerIds.has(werewolf.id)) {
      throw new Error("襲撃先の選択は一晩に1回だけ行えます。");
    }
    const target = this.requireAlivePlayer(targetId);
    if (this.day === 1 && target.name !== FIRST_VICTIM_NAME) {
      throw new Error("1日目は初日犠牲者だけを襲撃できます。");
    }
    if (this.day > 1 && ROLE_PROPERTIES[this.requireRole(target)].species === "werewolf") {
      throw new Error("人狼は襲撃対象にできません。");
    }
    this.attackTargetId = target.id;
    this.attackedPlayerIds.add(werewolf.id);
    this.record(`${werewolf.name} が襲撃先を ${target.name} に選びました。`, "werewolves");
    const result = this.phase === "nightAttack"
      ? this.resolveCurrentPhase()
      : { phaseChanged: false, gameEnded: null };
    return this.bundle(result.phaseChanged, result.gameEnded);
  }

  advanceTimer(): GameEventBundle {
    const result = this.resolveCurrentPhase();
    return this.bundle(result.phaseChanged, result.gameEnded);
  }

  runBotActions(): GameEventBundle {
    const chats: ChatMessage[] = [];
    const events: GameLogDispatch[] = [];
    let phaseChanged = false;
    let ended: GameEndPayload | null = null;

    for (let guard = 0; guard < 100 && this.phase !== "waiting" && this.phase !== "ended"; guard += 1) {
      const bot = this.livingPlayers().find((player) => player.bot && !this.botActions.has(this.botActionKey(player)));
      if (!bot) {
        break;
      }

      this.botActions.add(this.botActionKey(bot));
      const socketId = this.socketIdForPlayer(bot.id);
      let result: GameEventBundle | null = null;

      if (this.phase === "dayDiscussion") {
        result = this.sendChat(socketId, "おはようございます。");
      } else if (this.phase === "dayVote") {
        const targets = this.livingPlayers().filter((player) => !player.npc && player.id !== bot.id);
        if (targets.length > 0) {
          result = this.vote(socketId, this.pick(targets).id);
        }
      } else if (this.phase === "nightDiscussion" && bot.role === "seer") {
        const targets = this.livingPlayers().filter((player) => player.id !== bot.id);
        if (targets.length > 0) {
          result = this.divine(socketId, this.pick(targets).id);
        }
      } else if (this.phase === "nightAttack" && bot.role === "werewolf") {
        const targets = this.day === 1
          ? this.livingPlayers().filter((player) => player.name === FIRST_VICTIM_NAME)
          : this.livingPlayers().filter(
              (player) => ROLE_PROPERTIES[this.requireRole(player)].species !== "werewolf" && !player.npc
            );
        if (targets.length > 0) {
          result = this.attack(socketId, this.pick(targets).id);
        }
      }

      if (result) {
        chats.push(...result.chats);
        events.push(...result.events);
        phaseChanged ||= result.phaseChanged;
        ended = result.ended ?? ended;
      }
    }

    const bundle = this.bundle(phaseChanged, ended);
    return { ...bundle, chats, events: [...events, ...bundle.events] };
  }

  getState(): PublicGameState {
    return {
      room: this.settings,
      phase: this.phase,
      day: this.day,
      players: [...this.players.values()].map((player) => this.toPublicPlayer(player)),
      timer: this.timer,
      canStart: this.phase === "waiting" && this.humanPlayers().length === this.humanLimit(),
      winner: this.winner
    };
  }

  getPrivateState(socketId: string): PrivateState {
    const player = this.getSocketPlayer(socketId);
    return {
      playerId: player?.id ?? null,
      role: player?.role ?? null,
      divineResults: player?.divineResults ?? [],
      mediumResults: player?.mediumResults ?? [],
      sharedPlayerIds: player?.role === "shared"
        ? [...this.players.values()]
            .filter((candidate) => candidate.role === "shared" && candidate.id !== player.id)
            .map((candidate) => candidate.id)
        : [],
      log: player ? this.visibleHistory(player) : this.publicHistory(),
      sessionToken: player?.sessionToken ?? null
    };
  }

  getTimerDelay(): number | null {
    if (!this.timer || this.phase === "waiting" || this.phase === "ended") {
      return null;
    }
    return Math.max(0, this.timer.endsAt - this.now());
  }

  getPostGameCloseDelay(): number | null {
    if (this.phase !== "ended" || this.postGameChatEndsAt === null) {
      return null;
    }
    return Math.max(0, this.postGameChatEndsAt - this.now());
  }

  createArchive(roomId: string, closedAt = this.now()): ArchivedGameLog {
    if (this.phase !== "ended" || !this.winner || this.startedAt === null || this.endedAt === null) {
      throw new Error("終了していないゲームは保存できません。");
    }
    return {
      schemaVersion: 1,
      roomId,
      room: this.settings,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      closedAt,
      winner: this.winner,
      players: [...this.players.values()].map((player) => ({
        id: player.id,
        name: player.name,
        handleName: player.handleName,
        color: player.color,
        alive: player.alive,
        npc: player.npc,
        role: this.requireRole(player)
      })),
      entries: this.history.map((item) => ({ ...item.entry }))
    };
  }

  getDebugPlayersForTests(): {
    id: string;
    name: string;
    alive: boolean;
    npc: boolean;
    role: Role | null;
    divineResultCount: number;
  }[] {
    return [...this.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      alive: player.alive,
      npc: player.npc,
      role: player.role,
      divineResultCount: player.divineResults.length
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
    const resultText = [...counts.entries()]
      .map(([targetId, count]) => `${this.playerName(targetId)} ${count}票`)
      .join(", ");
    this.record(`投票結果: ${resultText || "全員棄権"}`, "public");
    this.votes.clear();
    if (counts.size === 0) {
      this.record("処刑は行われませんでした。", "public");
      return;
    }

    const maxVotes = Math.max(...counts.values());
    const candidates = [...counts.entries()].filter(([, count]) => count === maxVotes).map(([id]) => id);
    const executed = this.requirePlayer(this.pick(candidates));
    executed.alive = false;
    this.record(`${executed.name} が処刑されました。`, "public");
    for (const medium of this.livingPlayers().filter((player) => player.role === "medium")) {
      medium.mediumResults.push({
        targetId: executed.id,
        targetName: executed.name,
        result: ROLE_PROPERTIES[this.requireRole(executed)].species === "werewolf" ? "werewolf" : "human",
        day: this.day
      });
    }
  }

  private resolveAttack(): void {
    let target = this.attackTargetId ? this.players.get(this.attackTargetId) : undefined;
    if (this.day === 1) {
      target = [...this.players.values()].find((player) => player.name === FIRST_VICTIM_NAME && player.alive);
    }
    if (!target || !target.alive) {
      const candidates = this.livingPlayers().filter(
        (player) => ROLE_PROPERTIES[this.requireRole(player)].species !== "werewolf"
      );
      target = this.pick(candidates);
    }
    this.attackTargetId = null;
    if (
      target
      && ROLE_PROPERTIES[this.requireRole(target)].species !== "fox"
      && target.id !== this.guardTargetId
    ) {
      target.alive = false;
      this.record(`${target.name} が襲撃されました。`, "public");
    }
    for (const foxId of this.divinedFoxIds) {
      const fox = this.players.get(foxId);
      if (fox?.alive) {
        fox.alive = false;
        this.record(`${fox.name} が死亡しました。`, "public");
      }
    }
    this.divinedFoxIds.clear();
    this.guardTargetId = null;
  }

  private checkWinner(): Team | null {
    const living = this.livingPlayers();
    const werewolves = living.filter(
      (player) => ROLE_PROPERTIES[this.requireRole(player)].species === "werewolf"
    ).length;
    const humans = living.filter(
      (player) => ROLE_PROPERTIES[this.requireRole(player)].species === "human"
    ).length;
    const baseWinner = werewolves === 0 ? "villagers" : werewolves >= humans ? "werewolves" : null;
    return baseWinner && living.some(
      (player) => ROLE_PROPERTIES[this.requireRole(player)].side === "fox"
    ) ? "fox" : baseWinner;
  }

  private endGame(winner: Team): PhaseActionResult {
    const endedAt = this.now();
    this.winner = winner;
    this.phase = "ended";
    this.timer = null;
    this.endedAt = endedAt;
    this.postGameChatEndsAt = endedAt + POST_GAME_CHAT_DURATION_MS;
    const winnerLabel = winner === "villagers" ? "村人" : winner === "werewolves" ? "人狼" : "妖狐";
    this.record(`${winnerLabel}陣営の勝利です。`, "public");
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
    if (phase === "dayDiscussion") {
      this.votes.clear();
    }
    if (phase === "nightDiscussion") {
      this.attackTargetId = null;
      this.guardTargetId = null;
      this.attackedPlayerIds.clear();
      this.guardedPlayerIds.clear();
    }
    const startedAt = this.now();
    this.timer = {
      startedAt,
      endsAt: startedAt + this.settings.durationSeconds[phase] * 1000
    };
    this.record(`${this.day}日目: ${PHASE_LABELS[phase]} が始まりました。`);
    if (phase === "nightDiscussion") {
      this.runFirstVictimSeerAction();
    }
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
      bot: false,
      gameMaster: false,
      connected: false,
      sessionToken: null,
      role: null,
      divineResults: [],
      mediumResults: []
    };
    this.players.set(firstVictim.id, firstVictim);
  }

  private assignRoles(): void {
    const firstVictim = [...this.players.values()].find((player) => player.name === FIRST_VICTIM_NAME);
    if (!firstVictim) {
      throw new Error("初日犠牲者が見つかりません。");
    }

    const humans = this.shuffle(this.humanPlayers());
    const roles = rolesForPlayerCount(humans.length + 1);
    const firstVictimRoles = roles.filter((role) => ROLE_PROPERTIES[role].species === "human");
    const firstVictimRole = this.pick(firstVictimRoles);
    const firstVictimRoleIndex = roles.indexOf(firstVictimRole);
    roles.splice(firstVictimRoleIndex, 1);
    const humanRoles = this.shuffle(roles);
    humans.forEach((player, index) => {
      player.role = humanRoles[index]!;
    });
    firstVictim.role = firstVictimRole;
  }

  private runFirstVictimSeerAction(): void {
    const firstVictim = [...this.players.values()]
      .find((player) => player.name === FIRST_VICTIM_NAME && player.alive && player.role === "seer");
    if (!firstVictim) {
      return;
    }
    const targets = this.livingPlayers().filter((player) => player.id !== firstVictim.id);
    if (targets.length > 0) {
      this.performDivine(firstVictim, this.pick(targets));
    }
  }

  private bundle(phaseChanged: boolean, ended: GameEndPayload | null): GameEventBundle {
    const events = this.pendingEvents.splice(0);
    return {
      state: this.getState(),
      privateStates: new Map([...this.socketToPlayer.keys()].map((socketId) => [socketId, this.getPrivateState(socketId)])),
      chats: [],
      events,
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

  private reconnect(socketId: string, player: Player, rotateSessionToken = false): GameEventBundle {
    for (const [mappedSocketId, playerId] of this.socketToPlayer) {
      if (playerId === player.id) {
        this.socketToPlayer.delete(mappedSocketId);
      }
    }
    if (rotateSessionToken) {
      player.sessionToken = this.createSessionToken();
    }
    this.socketToPlayer.set(socketId, player.id);
    player.connected = true;
    this.record(`${player.name} が復帰しました。`);
    return this.bundle(false, null);
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

  private requireGameMaster(socketId: string): Player {
    const player = this.requireSocketPlayer(socketId);
    if (!player.gameMaster) {
      throw new Error("ゲームマスターだけが実行できます。");
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
      bot: player.bot,
      gameMaster: player.gameMaster,
      connected: player.connected,
      role: this.phase === "ended" ? this.requireRole(player) : undefined
    };
  }

  private playerName(playerId: string): string {
    return this.players.get(playerId)?.name ?? playerId;
  }

  private record(
    text: string,
    audience?: GameLogDispatch["audience"],
    playerId?: string
  ): void {
    this.log.push(text);
    const effectiveAudience = audience ?? "public";
    const entry: GameLogEntry = {
      id: `e${++this.logSeq}`,
      kind: "event",
      text,
      day: this.day,
      phase: this.phase,
      sentAt: this.now()
    };
    this.history.push({ entry, audience: effectiveAudience, playerId });
    this.pendingEvents.push({
      entry,
      audience: effectiveAudience,
      playerId
    });
  }

  private storeChat(message: ChatMessage): void {
    const audience: GameLogDispatch["audience"] =
      message.channel === "werewolf"
        ? "werewolves"
        : message.channel === "shared"
          ? "shared"
        : message.channel === "monologue"
          ? "private"
          : "public";
    this.history.push({
      entry: {
        id: message.id,
        kind: "chat",
        text: message.text,
        day: message.day,
        phase: message.phase,
        sentAt: message.sentAt,
        channel: message.channel,
        senderId: message.senderId,
        senderName: message.senderName
      },
      audience,
      playerId: message.channel === "monologue" ? message.senderId : undefined
    });
  }

  private publicHistory(): GameLogEntry[] {
    return this.history.filter((item) => item.audience === "public").map((item) => item.entry);
  }

  private visibleHistory(player: Player): GameLogEntry[] {
    return this.history
      .filter((item) =>
        item.audience === "public"
        || item.playerId === player.id
        || (item.audience === "werewolves" && player.role === "werewolf")
        || (item.audience === "shared" && player.role === "shared")
      )
      .map((item) => item.entry);
  }

  private socketIdForPlayer(playerId: string): string {
    const entry = [...this.socketToPlayer.entries()].find(([, mappedPlayerId]) => mappedPlayerId === playerId);
    if (!entry) {
      throw new Error("Botの接続情報が見つかりません。");
    }
    return entry[0];
  }

  private botActionKey(player: Player): string {
    return `${this.day}:${this.phase}:${player.id}`;
  }

  private shuffle<T>(items: T[]): T[] {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
    }
    return shuffled;
  }

  private pick<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error("候補がありません。");
    }
    return items[Math.floor(this.random() * items.length)] as T;
  }
}

export { ROLE_LABELS, PHASE_LABELS };
