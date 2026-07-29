<script setup lang="ts">
import { ref } from "vue";
import DevelopmentPanel from "../components/DevelopmentPanel.vue";
import type { DevelopmentPreviewState } from "../components/DevelopmentPanel.vue";
import GameScreen from "../components/GameScreen.vue";

const previewState = ref<DevelopmentPreviewState>({
  joined: true,
  role: "villager",
  phase: "waiting",
  alive: true,
  gameMaster: false,
  canStart: false,
  hasDivineResult: false
});
</script>

<template>
  <GameScreen :preview-state="previewState" />
  <DevelopmentPanel v-model="previewState" />
</template>
