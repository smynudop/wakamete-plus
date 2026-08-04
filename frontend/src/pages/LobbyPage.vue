<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import { io, type Socket } from "socket.io-client";
import {
  DEFAULT_PLAYER_COLOR,
  type ClientToServerEvents,
  type LobbyRoom,
  type RoomSettings,
  type ServerToClientEvents
} from "@wakamete-plus/shared";

const router = useRouter();
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
const rooms = ref<LobbyRoom[]>([]);
const error = ref("");
const availablePlayerCounts = ref<number[]>([]);
const creatorName = ref(localStorage.getItem("wakamete:name") ?? "");
const settings = ref<RoomSettings>({
  roomName: "新しい村",
  pr: "参加者募集中です。",
  durationSeconds: {
    dayDiscussion: 180,
    dayVote: 60,
    nightDiscussion: 90,
    nightAttack: 60
  },
  playerLimit: 6
});

const phaseLabels = {
  waiting: "待機中",
  nightDiscussion: "夜の議論",
  nightAttack: "夜の襲撃",
  dayDiscussion: "昼の議論",
  dayVote: "昼の投票",
  ended: "終了"
} as const;

void fetch("/api/role-sets")
  .then((response) => {
    if (!response.ok) {
      throw new Error("配役表を取得できませんでした。");
    }
    return response.json() as Promise<Record<string, unknown>>;
  })
  .then((roleSets) => {
    availablePlayerCounts.value = Object.keys(roleSets).map(Number).sort((left, right) => left - right);
    if (!availablePlayerCounts.value.includes(settings.value.playerLimit)) {
      settings.value.playerLimit = availablePlayerCounts.value[0] ?? settings.value.playerLimit;
    }
  })
  .catch((cause: unknown) => {
    error.value = cause instanceof Error ? cause.message : "配役表を取得できませんでした。";
  });

socket.on("roomList", (nextRooms) => {
  rooms.value = nextRooms;
});
socket.on("roomCreated", ({ roomId, sessionToken }) => {
  localStorage.setItem(`wakamete:rooms:${roomId}:sessionToken`, sessionToken);
  void router.push({ name: "room", params: { roomId } });
});
socket.on("actionError", (payload) => {
  error.value = payload.message;
});

onBeforeUnmount(() => {
  socket.disconnect();
});

function createRoom() {
  const name = creatorName.value.trim();
  if (!name) {
    error.value = "作成者の名前を入力してください。";
    return;
  }
  error.value = "";
  localStorage.setItem("wakamete:name", name);
  socket.emit("createRoom", {
    settings: {
      ...settings.value,
      durationSeconds: { ...settings.value.durationSeconds }
    },
    player: {
      name,
      color: localStorage.getItem("wakamete:color") ?? DEFAULT_PLAYER_COLOR
    }
  });
}
</script>

<template>
  <main class="page-shell lobby-page wakamete-back">
    <header class="page-heading">
      <h1>ロビー</h1>
      <p>募集中の村を選ぶか、新しい村を作成してください。</p>
    </header>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="lobby-grid">
      <div class="room-list">
        <article v-for="room in rooms" :key="room.id" class="room-card">
          <div>
            <span class="room-status" :class="room.status">
              {{ room.status === "waiting" ? "募集中" : room.status === "playing" ? "ゲーム中" : "終了" }}
            </span>
            <h2>{{ room.roomName }}</h2>
            <p>{{ room.pr }}</p>
          </div>
          <dl>
            <div><dt>参加者</dt><dd>{{ room.playerCount }} / {{ room.playerLimit }}</dd></div>
            <div><dt>進行</dt><dd>{{ room.day === 0 ? "開始前" : `${room.day}日目` }}・{{ phaseLabels[room.phase] }}</dd></div>
          </dl>
          <RouterLink :to="{ name: 'room', params: { roomId: room.id } }" class="primary-link">
            村へ入る
          </RouterLink>
        </article>
        <p v-if="rooms.length === 0" class="empty-state">公開村はまだありません。</p>
      </div>

      <form class="create-room-panel" @submit.prevent="createRoom">
        <h2>新しい村を作る</h2>
        <label>作成者名<input v-model="creatorName" maxlength="24" required /></label>
        <label>村名<input v-model="settings.roomName" maxlength="80" required /></label>
        <label>PR文<textarea v-model="settings.pr" rows="3" maxlength="240" required /></label>
        <label>
          定員（初日犠牲者を含む）
          <select v-model.number="settings.playerLimit">
            <option v-for="count in availablePlayerCounts" :key="count" :value="count">{{ count }}人</option>
          </select>
        </label>
        <fieldset class="duration-fields">
          <legend>各フェーズの時間</legend>
          <label>昼の議論（秒）<input v-model.number="settings.durationSeconds.dayDiscussion" type="number" min="30" max="300" /></label>
          <label>昼の投票（秒）<input v-model.number="settings.durationSeconds.dayVote" type="number" min="30" max="300" /></label>
          <label>夜の議論（秒）<input v-model.number="settings.durationSeconds.nightDiscussion" type="number" min="30" max="300" /></label>
          <label>夜の襲撃（秒）<input v-model.number="settings.durationSeconds.nightAttack" type="number" min="30" max="300" /></label>
        </fieldset>
        <button type="submit">村を作成</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.lobby-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr);
  gap: 2rem;
  align-items: start;
}

.room-list {
  display: grid;
  gap: 1rem;
}

.room-card,
.create-room-panel {
  border: 1px solid #c8c0b4;
  border-radius: 0.5rem;
  padding: 1.25rem;
  background: #fffdf9;
}

.room-card h2 {
  margin: 0.4rem 0;
}

.room-card dl,
.room-card dl div {
  display: flex;
  gap: 1rem;
}

.room-card dl {
  flex-wrap: wrap;
}

.room-card dt {
  font-weight: 700;
}

.room-card dd {
  margin: 0;
}

.room-status {
  font-size: 0.8rem;
  font-weight: 700;
}

.room-status.waiting {
  color: #267244;
}

.room-status.playing {
  color: #9a5b1f;
}

.room-status.ended {
  color: #706b65;
}

.create-room-panel {
  display: grid;
  gap: 1rem;
  position: sticky;
  top: 1rem;
}

.create-room-panel label {
  display: grid;
  gap: 0.35rem;
}

.duration-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin: 0;
  border: 1px solid #d8d0c5;
  padding: 0.75rem;
}

.create-room-panel input,
.create-room-panel textarea {
  box-sizing: border-box;
  width: 100%;
}

.missing-room {
  text-align: center;
}

@media (max-width: 767px)
{
  .lobby-grid{
    display: block;
    grid-template-columns: 200px 1fr;
    height: 100%;
  }
}
</style>