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
  hasDivineResult: false,
  gameState: {
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
    { id: "2", name: "前川みく", color: "#d94f45", alive: true, connected: true, npc: false, bot: false, gameMaster: true },
    { id: "3", name: "荒木比奈", color: "#2f80c7", alive: true, connected: false, npc: false, bot: false, gameMaster: false },
    { id: "4", name: "安部菜々", color: "#5fa34a", alive: true, connected: true, npc: false, bot: false, gameMaster: false },
    { id: "5", name: "渋谷凛", color: "#5c6bc0", alive: true, connected: true, npc: false, bot: false, gameMaster: false },
    { id: "6", name: "森久保乃々", color: "#8e5bbf", alive: true, connected: true, npc: false, bot: false, gameMaster: false },
  ],
  timer: null,
  canStart: false,
  winner: null,

  },
  log: [
    {kind: "chat", "senderId": "p-1", day: 0, id: "id", text: "ほい、開始ー", phase: "waiting",channel: "public", sentAt: 0, senderName: "ゲームマスター", senderColor: "#FF0000", size: "normal"},
    {kind: "chat", "senderId": "p-1", day: 0, id: "id", text: "強い発言", phase: "waiting",channel: "public", sentAt: 0, senderName: "ゲームマスター", senderColor: "#FF0000", size: "strong"},
    {kind: "chat", "senderId": "p-1", day: 0, id: "id", text: "弱い発言", phase: "waiting",channel: "public", sentAt: 0, senderName: "ゲームマスター", senderColor: "#FF0000", size: "weak"},
        {kind: "chat", "senderId": "p-1", day: 0, id: "id", text: "改行を\n含む\n発言", phase: "waiting",channel: "public", sentAt: 0, senderName: "ゲームマスター", senderColor: "#FF0000", size: "normal"},

   {kind: "event", day: 0, id: "id", text: "安部菜々さんが無惨な姿で発見されました...", phase: "waiting", sentAt: Date.now(),  eventType: "death"},
    {kind: "event", day: 0, id: "id", text: "安部菜々さんは村民協議の結果処刑されました...", phase: "waiting", sentAt: Date.now(),  eventType: "death"},
    {kind: "event", day: 0, id: "id", text: "「荒木比奈」さんが村へやってきました。", phase: "waiting", sentAt: Date.now(),  eventType: "join"},
    {kind: "event", day: 0, id: "id", text: "1日目の朝になりました。", phase: "waiting", sentAt: Date.now(),  eventType: "progress"},
    {kind: "event", day: 0, id: "id", text: "渋谷凛さんは双葉杏さんを占います。", phase: "waiting", sentAt: Date.now(),  eventType: "role"},
    {kind: "event", day: 0, id: "id", text: "渋谷凛さんは双葉杏さんに投票しました", phase: "waiting", sentAt: Date.now(),  eventType: "vote"},
  ]
});
</script>

<template>
  <GameScreen :preview-state="previewState" />
  <DevelopmentPanel v-model="previewState" />
</template>
