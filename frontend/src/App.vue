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
const messages = ref<ChatMessage[]>([]);
const gameEnd = ref<GameEndPayload | null>(null);
const now = ref(Date.now());
const state = ref<PublicGameState>({
  phase: "waiting",
  day: 0,
  players: [],
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
const joined = computed(() => privateState.value.playerId !== null);

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
</script>

<template>
  <main class="app-shell">
    <section class="top-bar">
      <div>
        <h1>Wakamete Plus</h1>
        <p>固定6人村</p>
      </div>
      <div class="phase">
        <span>{{ phaseLabels[state.phase] }}</span>
        <strong v-if="remainingSeconds !== null">{{ remainingSeconds }}s</strong>
      </div>
    </section>

    <p v-if="error" class="error">{{ error }}</p>

    <section v-if="!joined" class="join-panel">
      <label>
        プレイヤー名
        <input v-model="name" maxlength="24" @keydown.enter="joinGame" />
      </label>
      <button @click="joinGame">参加</button>
    </section>

    <section class="layout">
      <aside class="side-panel">
        <div class="status-row">
          <span>{{ state.day === 0 ? "開始前" : `${state.day}日目` }}</span>
          <button :disabled="!joined || !state.canStart" @click="startGame">開始</button>
        </div>

        <div v-if="privateState.role" class="role-box">
          <span>あなたの役職</span>
          <strong>{{ roleLabels[privateState.role] }}</strong>
        </div>

        <h2>参加者</h2>
        <ul class="players">
          <li v-for="player in state.players" :key="player.id" :class="{ dead: !player.alive }">
            <span>{{ player.name }}</span>
            <small>
              {{ player.alive ? "生存" : "死亡" }}
              {{ player.role ? ` / ${roleLabels[player.role]}` : "" }}
              {{ player.connected || player.npc ? "" : " / 離席" }}
            </small>
          </li>
        </ul>
      </aside>

      <section class="main-panel">
        <div class="actions">
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

        <div class="chat">
          <div class="messages">
            <p v-for="message in messages" :key="message.id" :class="message.channel">
              <strong>{{ message.senderName }}</strong>
              <span>{{ message.text }}</span>
            </p>
          </div>
          <form class="chat-form" @submit.prevent="sendChat">
            <input v-model="chatText" :disabled="!canChat" maxlength="160" />
            <button :disabled="!canChat">送信</button>
          </form>
        </div>
      </section>
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
</template>
