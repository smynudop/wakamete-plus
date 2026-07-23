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
  Role,
  ServerToClientEvents,
  ClientToServerEvents
} from "@wakamete-plus/shared";

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

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
const name = ref(localStorage.getItem("wakamete:name") ?? "");
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
  phase: "waiting",
  day: 0,
  players: [
    { id: "1", name: "初日犠牲者", alive: true, connected: true, npc: true },
    { id: "2", name: "前川みく", alive: true, connected: true, npc: true },
    { id: "3", name: "荒木比奈", alive: true, connected: true, npc: true },
    { id: "4", name: "安部菜々", alive: true, connected: true, npc: true },
    { id: "5", name: "渋谷凛", alive: true, connected: true, npc: true },
    { id: "6", name: "森久保乃々", alive: true, connected: true, npc: true },
    { id: "7", name: "棟方愛海", alive: true, connected: true, npc: true },
    { id: "8", name: "上条春菜", alive: true, connected: true, npc: true },
    { id: "9", name: "塩見周子", alive: true, connected: true, npc: true },
    { id: "10", name: "鷺沢文香", alive: true, connected: true, npc: true },
    { id: "11", name: "kari", alive: true, connected: true, npc: true },
    { id: "12", name: "小日向美穂", alive: true, connected: true, npc: true },
    { id: "13", name: "高森藍子", alive: true, connected: true, npc: true },
    { id: "14", name: "千川ちひろ", alive: true, connected: true, npc: true },
    { id: "15", name: "龍崎薫", alive: true, connected: true, npc: true },
    { id: "16", name: "佐藤心", alive: true, connected: true, npc: true },
    { id: "17", name: "正邪", alive: true, connected: true, npc: true },
    { id: "18", name: "斉藤洋子bot", alive: true, connected: true, npc: true },
  ],
  timer: null,
  canStart: false,
  votes: [],
  winner: null
});
const privateState = ref<PrivateState>({
  playerId: null,
  role: null,
  divineResults: []
});

const ticker = window.setInterval(() => {
  now.value = Date.now();
}, 500);

socket.on("gameState", (nextState) => {
  state.value = nextState;
});
socket.on("privateState", (nextState) => {
  privateState.value = nextState;
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

onBeforeUnmount(() => {
  window.clearInterval(ticker);
  socket.disconnect();
});

const me = computed(() => state.value.players.find((player) => player.id === privateState.value.playerId) ?? null);
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
  socket.emit("joinGame", { name: name.value });
}

function startGame() {
  error.value = "";
  socket.emit("startGame");
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
          <div class="icon">
            <img :src="`${player.name}.png`" />
          </div>
          <div>{{ player.name }}
            <small>
              {{ player.alive ? "生存" : "死亡" }}
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
        <section v-if="joined" class="start-panel">
          <button :disabled="!joined || !state.canStart" @click="startGame">開始</button>
        </section>
        <section v-if="!joined" class="join-panel">
          <label>
            プレイヤー名
            <input v-model="name" maxlength="24" @keydown.enter="joinGame" />
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
          <h1>【モバマス】ほげほげふがふが村</h1>
          <p>初心者でも誰でも歓迎！更新時間23:00</p>
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
          {{ player.name }}: {{ roleLabels[player.role] }} / {{ player.alive ? "生存" : "死亡" }}
        </p>
      </div>
    </section>
  </main>
  <div class="dev-panel">
    <input type="checkbox" v-model="debugState.join"><label>参加状態</label>
  </div>
</template>
