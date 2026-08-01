<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import type { ArchivedGameSummary } from "@wakamete-plus/shared";

const games = ref<ArchivedGameSummary[]>([]);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    const response = await fetch("/api/logs");
    if (!response.ok) {
      throw new Error();
    }
    games.value = await response.json() as ArchivedGameSummary[];
  } catch {
    error.value = "過去ログの読み込みに失敗しました。";
  } finally {
    loading.value = false;
  }
});

function winnerLabel(winner: ArchivedGameSummary["winner"]): string {
  if (winner === "draw") {
    return "引き分け";
  }
  if (winner === "villagers") {
    return "村人陣営";
  }
  if (winner === "werewolves") {
    return "人狼陣営";
  }
  return "妖狐陣営";
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}
</script>

<template>
  <main class="logs-page wakamete-back">
    <h1>過去ログ</h1>
    <p v-if="loading">読み込んでいます。</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="games.length === 0">保存済みのゲームはありません。</p>
    <ul v-else class="game-list">
      <li v-for="game in games" :key="game.roomId">
        <RouterLink :to="{ name: 'game-log', params: { roomId: game.roomId } }">
          <strong>{{ game.room.roomName }}</strong>
          <span>{{ formatDate(game.endedAt) }}</span>
          <span>{{ game.winner === "draw" ? winnerLabel(game.winner) : `${winnerLabel(game.winner)}の勝利` }}</span>
          <span>{{ game.players.length }}人</span>
        </RouterLink>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.logs-page {
  padding: 1.5rem;
}

.logs-page h1 {
  margin-bottom: 1rem;
}

.game-list {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.game-list a {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) repeat(3, auto);
  gap: 1rem;
  align-items: center;
  border: 1px solid #d4cab9;
  border-radius: 0.4rem;
  padding: 0.8rem 1rem;
  background: #fffdfa;
  color: inherit;
  text-decoration: none;
}

.game-list a:hover {
  background: #fae4ac;
}

@media (max-width: 700px) {
  .game-list a {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
}
</style>
