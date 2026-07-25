<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type {
  ChatMessage,
  DivineResult,
  GameEndPayload,
  PrivateState,
  PublicGameState,
  RoomSettings,
  Role,
  ServerToClientEvents,
  ClientToServerEvents
} from "@wakamete-plus/shared";
import { DEFAULT_PLAYER_COLOR, PLAYER_COLORS } from "@wakamete-plus/shared";

const roleLabels: Record<Role, string> = {
  villager: "村人",
  seer: "占い師",
  werewolf: "人狼",
  madman: "狂人"
};

const phaseLabels: Record<PublicGameState["phase"], string> = {
  waiting: "待機中",
  nightDiscussion: "夜の議論",
  nightAttack: "夜の襲撃",
  dayDiscussion: "昼の議論",
  dayVote: "昼の投票",
  ended: "終了"
};

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ autoConnect: false });
const name = ref(localStorage.getItem("wakamete:name") ?? "");
const handleName = ref(localStorage.getItem("wakamete:handleName") ?? "");
const color = ref(localStorage.getItem("wakamete:color") ?? DEFAULT_PLAYER_COLOR);
const password = ref("");
const sessionToken = ref(localStorage.getItem("wakamete:sessionToken") ?? "");
const chatText = ref("");
const selectedVote = ref("");
const selectedDivine = ref("");
const selectedAttack = ref("");
const error = ref("");
const messages = ref<ChatMessage[]>([
  {
    id: "1",
    channel: "public",
    day: 1,
    phase: "dayDiscussion",
    senderId: "test",
    senderName: "初日犠牲者",
    sentAt: 123,
    text: "aaa"
  },
  {
    id: "2",
    channel: "public",
    day: 1,
    phase: "dayDiscussion",
    senderId: "test",
    senderName: "ゲームマスター",
    sentAt: 123,
    text: "初日犠牲者さんこんこん"
  }
]);
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
  votes: [],
  winner: null
});
const privateState = ref<PrivateState>({
  playerId: null,
  role: null,
  divineResults: [],
  sessionToken: null
});
const roomSettings = ref<RoomSettings>({
  ...state.value.room,
  durationSeconds: { ...state.value.room.durationSeconds }
});

const ticker = window.setInterval(() => {
  now.value = Date.now();
}, 500);

socket.on("gameState", (nextState) => {
  state.value = nextState;
  roomSettings.value = {
    ...nextState.room,
    durationSeconds: { ...nextState.room.durationSeconds }
  };
});
socket.on("privateState", (nextState) => {
  privateState.value = nextState;
  if (nextState.sessionToken) {
    error.value = "";
    sessionToken.value = nextState.sessionToken;
    localStorage.setItem("wakamete:sessionToken", nextState.sessionToken);
  }
});
socket.on("chatMessage", (message) => {
  messages.value.push(message);
});
socket.on("phaseChanged", () => {
  selectedVote.value = "";
  selectedAttack.value = "";
});
socket.on("actionError", (payload) => {
  error.value = payload.message;
});
socket.on("gameEnded", (payload) => {
  gameEnd.value = payload;
});
socket.on("connect", () => {
  if (sessionToken.value) {
    socket.emit("joinGame", {
      name: name.value,
      handleName: handleName.value,
      color: color.value,
      password: password.value,
      sessionToken: sessionToken.value
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
  if (!me.value?.alive) {
    return false;
  }
  if (state.value.phase === "dayDiscussion") {
    return true;
  }
  return state.value.phase === "nightDiscussion" && privateState.value.role === "werewolf";
});
const joined = computed(() => privateState.value.playerId !== null || debugState.value.join);

function joinGame() {
  error.value = "";
  localStorage.setItem("wakamete:name", name.value);
  localStorage.setItem("wakamete:handleName", handleName.value);
  localStorage.setItem("wakamete:color", color.value);
  socket.emit("joinGame", {
    name: name.value,
    handleName: handleName.value,
    color: color.value,
    password: password.value,
    sessionToken: sessionToken.value || undefined
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
  socket.emit("sendChat", { text: chatText.value });
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

function formatDivine(result: DivineResult) {
  return `${result.day}日目: ${result.targetName} は ${result.result === "werewolf" ? "人狼" : "人間"}`;
}

const debugState = ref({
  join: false
})
</script>

<template>
  <main class="app-shell">


    <p v-if="error" class="error">{{ error }}</p>



    <div class="bar">◆村人たち</div>
    
    <aside class="side-panel">
      <ul class="players">
        <li v-for="player in state.players" :key="player.id" :class="{ dead: !player.alive }">
          <div class="icon" :style="{ backgroundColor: player.color }">
            <img :src="`${player.name}.png`" />
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
        <span>あなたの役職</span>
        <strong>{{ roleLabels[privateState.role] }}</strong>
      </div>
    </template>
    <div class="bar">◆行動</div>
    <aside class="command-panel">

      <div class="actions">
        <section v-if="isGameMaster" class="start-panel">
          <button :disabled="!state.canStart" @click="startGame">開始</button>
        </section>
        <form v-if="isGameMaster && state.phase === 'waiting'" class="settings-panel" @submit.prevent="updateRoomSettings">
          <label>
            村名
            <input v-model="roomSettings.roomName" maxlength="80" />
          </label>
          <label>
            PR
            <input v-model="roomSettings.pr" maxlength="160" />
          </label>
          <label>
            定員（NPC込み）
            <input v-model.number="roomSettings.playerLimit" type="number" min="4" max="20" />
          </label>
          <label>
            昼の議論（秒）
            <input v-model.number="roomSettings.durationSeconds.dayDiscussion" type="number" min="30" max="300" />
          </label>
          <label>
            昼の投票（秒）
            <input v-model.number="roomSettings.durationSeconds.dayVote" type="number" min="30" max="300" />
          </label>
          <label>
            夜の議論（秒）
            <input v-model.number="roomSettings.durationSeconds.nightDiscussion" type="number" min="30" max="300" />
          </label>
          <label>
            夜の襲撃（秒）
            <input v-model.number="roomSettings.durationSeconds.nightAttack" type="number" min="30" max="300" />
          </label>
          <button>設定を保存</button>
        </form>
        <section v-if="!joined" class="join-panel">
          <label>
            プレイヤー名
            <input v-model="name" maxlength="24" @keydown.enter="joinGame" />
          </label>
          <label>
            ハンドル名
            <input v-model="handleName" maxlength="24" @keydown.enter="joinGame" />
          </label>
          <label>
            色
            <div class="color-options">
              <button
                v-for="presetColor in PLAYER_COLORS"
                :key="presetColor"
                type="button"
                class="color-swatch"
                :class="{ selected: color === presetColor }"
                :style="{ backgroundColor: presetColor }"
                :title="presetColor"
                @click="color = presetColor"
              />
            </div>
          </label>
          <label>
            復帰用パスワード
            <input v-model="password" type="password" maxlength="64" @keydown.enter="joinGame" />
          </label>
          <button @click="joinGame">参加</button>
        </section>
        <form v-if="joined"  class="chat-form" @submit.prevent="sendChat">
          <input type="text" v-model="chatText" :disabled="!canChat" maxlength="160" />
          <button :disabled="!canChat">発言</button>
        </form>
        <div v-if="state.phase === 'dayVote' && me?.alive" class="action-line">
          <select v-model="selectedVote">
            <option value="">投票先</option>
            <option v-for="player in voteTargets" :key="player.id" :value="player.id">{{ player.name }}</option>
          </select>
          <button @click="vote">投票</button>
        </div>

        <div v-if="state.phase === 'nightDiscussion' && privateState.role === 'seer' && me?.alive" class="action-line">
          <select v-model="selectedDivine">
            <option value="">占い先</option>
            <option v-for="player in divineTargets" :key="player.id" :value="player.id">{{ player.name }}</option>
          </select>
          <button @click="divine">占う</button>
        </div>

        <div v-if="state.phase === 'nightAttack' && privateState.role === 'werewolf' && me?.alive" class="action-line">
          <select v-model="selectedAttack">
            <option value="">襲撃先</option>
            <option v-for="player in attackTargets" :key="player.id" :value="player.id">{{ player.name }}</option>
          </select>
          <button @click="attack">襲撃</button>
        </div>
      </div>

      <div v-if="privateState.divineResults.length" class="results">
        <h2>占い結果</h2>
        <p v-for="result in privateState.divineResults" :key="`${result.day}-${result.targetId}`">
          {{ formatDivine(result) }}
        </p>
      </div>
    </aside>

    <div class="bar">◆出来事</div>

    <section class="main-panel">
    
      <section class="top-bar">
        <div>
          <h1>{{ state.room.roomName }}</h1>
          <p>{{ state.room.pr }}</p>
        </div>
        <div class="phase">
          <span>{{ phaseLabels[state.phase] }}</span>
          <strong v-if="remainingSeconds !== null">{{ remainingSeconds }}s</strong>
        </div>
        <div class="status-row">
          <span>{{ state.day === 0 ? "開始前" : `${state.day}日目` }}</span>
        </div>
      </section>
      <div class="chat">
        <div class="messages">
          <p v-for="message in messages" :key="message.id" class="message" :class="message.channel">
            <span>◆<strong>{{ message.senderName }}</strong>さん</span>
            <span>「{{ message.text }}」</span>
          </p>
        </div>
      </div>
    </section>

    <section v-if="gameEnd" class="end-panel">
      <h2>{{ gameEnd.winner === "villagers" ? "村人陣営" : "人狼陣営" }}の勝利</h2>
      <div class="end-grid">
        <p v-for="player in gameEnd.players" :key="player.id">
          {{ player.name }} ({{ player.handleName }}): {{ roleLabels[player.role] }} / {{ player.alive ? "生存" : "死亡" }}
        </p>
      </div>
    </section>
  </main>
  <div class="dev-panel">
    <input type="checkbox" v-model="debugState.join"><label>参加状態</label>
    <button
      v-if="isGameMaster"
      :disabled="state.phase !== 'waiting' || state.players.length >= state.room.playerLimit"
      @click="addBot"
    >
      Botを追加
    </button>
  </div>
</template>
