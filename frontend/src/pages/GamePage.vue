<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type {
  ChatChannel,
  ArchivedGameLog,
  DivineResult,
  GameEndPayload,
  GameLogEntry,
  PrivateState,
  PublicGameState,
  RoomSettings,
  Role,
  ServerToClientEvents,
  ClientToServerEvents
} from "@wakamete-plus/shared";
import { DEFAULT_PLAYER_COLOR } from "@wakamete-plus/shared";
import type { DevelopmentPreviewState } from "../components/DevelopmentPanel.vue";
import ActionPanel from "../components/ActionPanel.vue"
import JoinPanel from "../components/JoinPanel.vue";
import TalkPanel from "../components/TalkPanel.vue";
import type { JoinState } from "../components/JoinPanel.vue";
import RoomSettingPanel from "../components/RoomSettingPanel.vue";
import { roleLabels, roleDescriptions } from "../resource";
const isDevelopment = import.meta.env.DEV;
const DevelopmentPanel = isDevelopment
  ? defineAsyncComponent(() => import("../components/DevelopmentPanel.vue"))
  : null;

const route = useRoute();
const roomId = computed(() => String(route.params.roomId));
const sessionTokenKey = computed(() => `wakamete:rooms:${roomId.value}:sessionToken`);
const roomExists = ref<boolean | null>(null);
const archivedGame = ref<ArchivedGameLog | null>(null);
const archiveLookupPending = ref(false);


const phaseLabels: Record<PublicGameState["phase"], string> = {
  waiting: "待機中",
  nightDiscussion: "夜の議論",
  nightAttack: "夜の襲撃",
  dayDiscussion: "昼の議論",
  dayVote: "昼の投票",
  ended: "終了"
};

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ autoConnect: false });
const joinState = ref<JoinState>({
  name: localStorage.getItem("wakamete:name") ?? "",
  handleName: localStorage.getItem("wakamete:handleName") ?? "",
  color: localStorage.getItem("wakamete:color") ?? DEFAULT_PLAYER_COLOR,
  password: "",
  sessionToken: localStorage.getItem(`wakamete:rooms:${String(route.params.roomId)}:sessionToken`) ?? ""
});
const chatText = ref("");
const chatChannel = ref<ChatChannel>("public");
const selectedVote = ref("");
const selectedDivine = ref("");
const selectedAttack = ref("");
const selectedGuard = ref("");
const error = ref("");
const logEntries = ref<GameLogEntry[]>([]);
const displayLogEntries = computed(() => logEntries.value.toReversed())
const gameEnd = ref<GameEndPayload | null>(null);
const now = ref(Date.now());
const state = ref<PublicGameState>({
  room: {
    roomName: "【モバマス】ほげほげふがふが村",
    pr: "初心者でも誰でも歓迎！更新時間23:00",
    durationSeconds: {
      dayDiscussion: 180,
      dayVote: 60,
      nightDiscussion: 90,
      nightAttack: 60
    },
    playerLimit: 6
  },
  phase: "waiting",
  day: 0,
  players: [
    { id: "1", name: "初日犠牲者", color: "#9a9690", alive: true, connected: true, npc: true, bot: false, gameMaster: false },
    { id: "2", name: "前川みく", color: "#d94f45", alive: true, connected: true, npc: true, bot: false, gameMaster: false },
    { id: "3", name: "荒木比奈", color: "#2f80c7", alive: true, connected: true, npc: true, bot: false, gameMaster: false },
    { id: "4", name: "安部菜々", color: "#5fa34a", alive: true, connected: true, npc: true, bot: false, gameMaster: false },
    { id: "5", name: "渋谷凛", color: "#5c6bc0", alive: true, connected: true, npc: true, bot: false, gameMaster: false },
    { id: "6", name: "森久保乃々", color: "#8e5bbf", alive: true, connected: true, npc: true, bot: false, gameMaster: false },
  ],
  timer: null,
  canStart: false,
  winner: null
});
const privateState = ref<PrivateState>({
  playerId: null,
  role: null,
  divineResults: [],
  mediumResults: [],
  sharedPlayerIds: [],
  log: [],
  sessionToken: null
});
const roomSettings = ref<RoomSettings>({
  ...state.value.room,
  durationSeconds: { ...state.value.room.durationSeconds }
});
const developmentPreview = ref<DevelopmentPreviewState>({
  enabled: false,
  joined: true,
  role: "villager",
  phase: "waiting",
  alive: true,
  gameMaster: false,
  canStart: false,
  hasDivineResult: false
});

const ticker = window.setInterval(() => {
  now.value = Date.now();
}, 500);

socket.on("gameState", (nextState) => {
  if (developmentPreview.value.enabled) {
    return;
  }
  state.value = nextState;
  roomSettings.value = {
    ...nextState.room,
    durationSeconds: { ...nextState.room.durationSeconds }
  };
});
socket.on("roomList", (rooms) => {
  const exists = rooms.some((room) => room.id === roomId.value);
  roomExists.value = exists;
  if (!exists && !archivedGame.value && !archiveLookupPending.value) {
    void loadArchivedGame();
  }
});
socket.on("privateState", (nextState) => {
  if (developmentPreview.value.enabled) {
    return;
  }
  privateState.value = nextState;
  logEntries.value = nextState.log;
  if (nextState.sessionToken) {
    error.value = "";
    joinState.value.sessionToken = nextState.sessionToken;
    localStorage.setItem(sessionTokenKey.value, nextState.sessionToken);
  }
});
socket.on("logEntry", (entry) => {
  if (developmentPreview.value.enabled) {
    return;
  }
  if (!logEntries.value.some((candidate) => candidate.id === entry.id)) {
    logEntries.value.push(entry);
  }
});
socket.on("phaseChanged", () => {
  if (developmentPreview.value.enabled) {
    return;
  }
  selectedVote.value = "";
  selectedAttack.value = "";
  chatChannel.value = state.value.phase === "nightDiscussion" || state.value.phase === "nightAttack"
    ? "monologue"
    : "public";
});
socket.on("actionError", (payload) => {
  error.value = payload.message;
});
socket.on("gameEnded", (payload) => {
  if (developmentPreview.value.enabled) {
    return;
  }
  gameEnd.value = payload;
});
socket.on("connect", () => {
  if (joinState.value.sessionToken) {
    socket.emit("joinRoom", {
      roomId: roomId.value,
      player: {
        ...joinState.value,
        sessionToken: joinState.value.sessionToken
      }
    });
  }
});
socket.connect();

onBeforeUnmount(() => {
  window.clearInterval(ticker);
  socket.disconnect();
});

const me = computed(() => state.value.players.find((player) => player.id === privateState.value.playerId) ?? null);
const isGameMaster = computed(() => me.value?.gameMaster === true);
const livingTargets = computed(() => state.value.players.filter((player) => player.alive && player.id !== privateState.value.playerId));
const voteTargets = computed(() => livingTargets.value.filter((player) => !player.npc));
const divineTargets = computed(() => livingTargets.value);
const guardTargets = computed(() => livingTargets.value);
const sharedPlayers = computed(() =>
  state.value.players.filter((player) => privateState.value.sharedPlayerIds.includes(player.id))
);
const attackTargets = computed(() => {
  if (state.value.day === 1) {
    return state.value.players.filter((player) => player.name === "初日犠牲者" && player.alive);
  }
  return state.value.players.filter((player) => player.alive && player.id !== privateState.value.playerId);
});
const remainingSeconds = computed(() => {
  if (!state.value.timer) {
    return null;
  }
  return Math.max(0, Math.ceil((state.value.timer.endsAt - now.value) / 1000));
});
const canChat = computed(() => {
  if (archivedGame.value || !joined.value) {
    return false;
  }
  if (state.value.phase === "waiting" || state.value.phase === "ended") {
    return true;
  }
  if (!me.value?.alive) {
    return false;
  }
  return state.value.phase === "dayDiscussion"
    || state.value.phase === "nightDiscussion"
    || state.value.phase === "nightAttack";
});
const chatChannelOptions = computed<{ value: ChatChannel; label: string }[]>(() => {
  if (state.value.phase === "nightDiscussion") {
    return privateState.value.role === "werewolf"
      ? [
          { value: "werewolf", label: "人狼の議論" },
          { value: "monologue", label: "独り言" }
        ]
      : privateState.value.role === "shared"
        ? [
            { value: "shared", label: "共有者の議論" },
            { value: "monologue", label: "独り言" }
          ]
      : [{ value: "monologue", label: "独り言" }];
  }
  if (state.value.phase === "nightAttack") {
    return [{ value: "monologue", label: "独り言" }];
  }
  return [{ value: "public", label: state.value.phase === "waiting" || state.value.phase === "ended" ? "チャット" : "議論" }];
});
const joined = computed(() => privateState.value.playerId !== null);

async function loadArchivedGame() {
  archiveLookupPending.value = true;
  try {
    const response = await fetch(`/api/logs/${encodeURIComponent(roomId.value)}`);
    if (!response.ok) {
      return;
    }
    const archived = await response.json() as ArchivedGameLog;
    archivedGame.value = archived;
    state.value = {
      room: archived.room,
      phase: "ended",
      day: archived.entries.reduce((maximum, entry) => Math.max(maximum, entry.day), 0),
      players: archived.players.map((player) => ({
        ...player,
        connected: false,
        bot: false,
        gameMaster: false
      })),
      timer: null,
      canStart: false,
      winner: archived.winner
    };
    logEntries.value = archived.entries;
    gameEnd.value = {
      winner: archived.winner,
      players: archived.players,
      log: archived.entries.map((entry) => entry.text)
    };
  } catch {
    error.value = "保存済みゲームログの読み込みに失敗しました。";
  } finally {
    archiveLookupPending.value = false;
  }
}

function joinGame() {
  error.value = "";
  localStorage.setItem("wakamete:name", joinState.value.name);
  localStorage.setItem("wakamete:handleName", joinState.value.handleName);
  localStorage.setItem("wakamete:color", joinState.value.color);
  socket.emit("joinRoom", {
    roomId: roomId.value,
    player: {
      ...joinState.value,
      sessionToken: joinState.value.sessionToken || undefined
    }
  });
}

function startGame() {
  error.value = "";
  socket.emit("startGame");
}

function addBot() {
  error.value = "";
  socket.emit("addBot");
}

function updateRoomSettings() {
  error.value = "";
  socket.emit("updateRoomSettings", {
    ...roomSettings.value,
    durationSeconds: { ...roomSettings.value.durationSeconds }
  });
}

function sendChat() {
  error.value = "";
  const channel = chatChannelOptions.value.some((option) => option.value === chatChannel.value)
    ? chatChannel.value
    : chatChannelOptions.value[0]?.value ?? "public";
  chatChannel.value = channel;
  socket.emit("sendChat", { text: chatText.value, channel });
  chatText.value = "";
}

function vote() {
  if (!selectedVote.value) {
    return;
  }
  error.value = "";
  socket.emit("vote", { targetId: selectedVote.value });
}

function divine() {
  if (!selectedDivine.value) {
    return;
  }
  error.value = "";
  socket.emit("divine", { targetId: selectedDivine.value });
}

function attack() {
  if (!selectedAttack.value) {
    return;
  }
  error.value = "";
  socket.emit("attack", { targetId: selectedAttack.value });
}

function guard() {
  if (!selectedGuard.value) {
    return;
  }
  error.value = "";
  socket.emit("guard", { targetId: selectedGuard.value });
}

function formatDivine(result: DivineResult) {
  return `${result.day}日目: ${result.targetName} は ${result.result === "werewolf" ? "人狼" : "人間"}`;
}

watch(
  developmentPreview,
  (preview, previous) => {
    if (!isDevelopment) {
      return;
    }
    if (!preview.enabled) {
      if (previous?.enabled) {
        socket.connect();
      }
      return;
    }
    if (!previous?.enabled) {
      socket.disconnect();
    }

    const previewPlayerId = state.value.players.find((player) => !player.npc)?.id
      ?? state.value.players[0]?.id
      ?? "development-player";
    state.value = {
      ...state.value,
      phase: preview.phase,
      day: preview.phase === "waiting" ? 0 : 2,
      canStart: preview.canStart,
      timer: null,
      players: state.value.players.map((player) => player.id === previewPlayerId
        ? { ...player, alive: preview.alive, gameMaster: preview.gameMaster }
        : player)
    };
    privateState.value = {
      playerId: preview.joined ? previewPlayerId : null,
      role: preview.joined ? preview.role : null,
      sessionToken: null,
      mediumResults: [],
      sharedPlayerIds: [],
      log: [],
      divineResults: preview.hasDivineResult
        ? [{ targetId: "3", targetName: "荒木比奈", result: "human", day: 1 }]
        : []
    };
  },
  { deep: true }
);
</script>

<template>
  <main v-if="archiveLookupPending" class="page-shell missing-room">
    <h1>ゲームログを読み込んでいます</h1>
  </main>
  <main v-else-if="roomExists === false && !archivedGame" class="page-shell missing-room">
    <h1>村が見つかりません</h1>
    <p>指定された村は存在しないか、利用できなくなりました。</p>
    <RouterLink to="/lobby" class="primary-link">ロビーへ戻る</RouterLink>
  </main>
  <main v-else class="app-shell" :class="[state.phase]">


    <p v-if="archivedGame">このゲームは終了し、ログが保存されています。</p>
    <p v-if="error" class="error">{{ error }}</p>



    <div class="bar">◆村人たち</div>
    
    <aside class="side-panel">
      <ul class="players">
        <li v-for="player in state.players" :key="player.id" :class="{ dead: !player.alive }">
          <div class="icon" :style="{ backgroundColor: player.color }">
            <img :src="player.alive ? `/alive1.gif` : `/grave.gif`" />
          </div>
          <div>{{ player.name }}
            <small>
              {{ player.alive ? "生存" : "死亡" }}
              {{ player.gameMaster ? " / GM" : "" }}
              {{ player.role ? ` / ${roleLabels[player.role]}` : "" }}
              {{ player.connected || player.npc ? "" : " / 離席" }}
            </small>
          </div>
        </li>
      </ul>
    </aside>
    <template v-if="privateState.role" >
      <div class="bar">◆あなたの情報</div>
      <div class="role-box">
        <div>あなたの役職は【{{ roleLabels[privateState.role] }}】です。</div>
        <div>【能力】{{ roleDescriptions[privateState.role] }}</div>
        <div v-if="privateState.divineResults.length" class="results">
          <p v-for="result in privateState.divineResults" :key="`${result.day}-${result.targetId}`">
            【能力発動】{{ formatDivine(result) }}
          </p>
        </div>
        <div v-if="privateState.mediumResults.length" class="results">
          <p v-for="result in privateState.mediumResults" :key="`${result.day}-${result.targetId}`">
            【霊能結果】{{ result.day }}日目: {{ result.targetName }} は
            {{ result.result === "werewolf" ? "人狼" : "人間" }}
          </p>
        </div>
        <p v-if="privateState.role === 'shared'">
          【共有者】{{ sharedPlayers.map((player) => player.name).join("、") }}
        </p>
      </div>

    </template>
    <div class="bar">◆行動</div>
    <aside class="command-panel">

      <div class="actions">
        <section v-if="isGameMaster" class="start-panel">
          <button :disabled="!state.canStart" @click="startGame">開始</button>
          <button
            v-if="state.phase === 'waiting'"
            :disabled="state.players.length >= state.room.playerLimit"
            @click="addBot"
          >
            Botを追加
          </button> 
        </section>
        <room-setting-panel  
          v-if="isGameMaster && state.phase === 'waiting'" 
          v-model="roomSettings" 
          @submit="updateRoomSettings"/>
        <JoinPanel v-if="!joined && state.phase=='waiting'" v-model="joinState" @submit="joinGame" />
        <talk-panel 
          v-if="joined" 
          :can-chat="canChat" 
          :chat-channel-options="chatChannelOptions" 
          v-model:chat-text="chatText" 
          v-model:chat-channel="chatChannel"
          @send="sendChat"/>
        <action-panel 
          v-if="(state.phase === 'dayDiscussion' || state.phase === 'dayVote') && me?.alive"
          v-model="selectedVote" 
          :targets="voteTargets" 
          description-label="投票先" 
          execute-label="投票" 
          @execute="vote"/>

        <action-panel 
          v-if="(state.phase === 'nightDiscussion' || state.phase === 'nightAttack') && privateState.role === 'seer' && me?.alive" 
          v-model="selectedDivine" 
          :targets="divineTargets" 
          description-label="占い先" 
          execute-label="占う" 
          @execute="divine"/>

        <action-panel 
          v-if="(state.phase === 'nightDiscussion' || state.phase === 'nightAttack') && privateState.role === 'werewolf' && me?.alive"
          v-model="selectedAttack" 
          :targets="attackTargets" 
          description-label="襲撃先" 
          execute-label="襲撃" 
          @execute="attack"/>
        <action-panel
          v-if="(state.phase === 'nightDiscussion' || state.phase === 'nightAttack') && privateState.role === 'hunter' && me?.alive"
          v-model="selectedGuard"
          :targets="guardTargets"
          description-label="護衛先"
          execute-label="護衛"
          @execute="guard"/>
      </div>


    </aside>

    <div class="bar">◆出来事</div>

    <section class="main-panel">
      <section class="top-bar">
        <div>
          <h1>{{ state.room.roomName }}</h1>
          <p>{{ state.room.pr }}</p>
          <p></p>
        </div>
        <div class="status-row">
          <span>{{ state.day === 0 ? "開始前" : `${state.day}日目` }}</span>
          <span>{{ phaseLabels[state.phase] }}</span>
          <strong v-if="remainingSeconds !== null">{{ remainingSeconds }}s</strong>
        </div>
      </section>
      <div class="chat">
        <div class="messages">
          <p
            v-for="entry in displayLogEntries"
            :key="entry.id"
            :class="entry.kind === 'chat' ? ['message', entry.channel] : ['event-entry', entry.eventType]"
          >
            <template v-if="entry.kind === 'chat'">
              <span><span>◆</span><strong>{{ entry.senderName }}</strong>さん</span>
              <span>「{{ entry.text }}」</span>
            </template>
            <template v-else>{{ entry.text }}</template>
          </p>
        </div>
      </div>
    </section>

    <section v-if="gameEnd" class="end-panel">
      <h2>{{ gameEnd.winner === "villagers" ? "村人陣営" : gameEnd.winner === "werewolves" ? "人狼陣営" : "妖狐陣営" }}の勝利</h2>
      <div class="end-grid">
        <p v-for="player in gameEnd.players" :key="player.id">
          {{ player.name }} ({{ player.handleName }}): {{ roleLabels[player.role] }} / {{ player.alive ? "生存" : "死亡" }}
        </p>
      </div>
      <h2 v-if="!archivedGame">全ログ</h2>
      <div v-if="!archivedGame" class="event-log">
        <p v-for="(entry, index) in gameEnd.log" :key="index">{{ entry }}</p>
      </div>
    </section>
  </main>
  <DevelopmentPanel
    v-if="isDevelopment && DevelopmentPanel"
    v-model="developmentPreview"
  />
</template>
