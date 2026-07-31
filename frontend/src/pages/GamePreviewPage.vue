<script setup lang="ts">
import { ref } from "vue";
import DevelopmentPanel from "../components/DevelopmentPanel.vue";
import type { DevelopmentPreviewState } from "../components/DevelopmentPanel.vue";
import GameScreen from "../components/GameScreen.vue";
import { GameEventDetail, GameEventEntry } from "@wakamete-plus/shared";
const createEvent = (detail: GameEventDetail): GameEventEntry => {
  return {
    kind: "event",
    day: 0,
    id: "id",
    detail,
    phase: "waiting",
    sentAt: Date.now()
  }
}
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
    { kind: "chat", "senderId": "p-1", day: 0, id: "id", text: "ほい、開始ー", phase: "waiting", channel: "public", sentAt: 0, senderName: "ゲームマスター", senderColor: "#FF0000", size: "normal" },
    { kind: "chat", "senderId": "p-1", day: 0, id: "id", text: "強い発言", phase: "waiting", channel: "public", sentAt: 0, senderName: "ゲームマスター", senderColor: "#FF0000", size: "strong" },
    { kind: "chat", "senderId": "p-1", day: 0, id: "id", text: "弱い発言", phase: "waiting", channel: "public", sentAt: 0, senderName: "ゲームマスター", senderColor: "#FF0000", size: "weak" },
    { kind: "chat", "senderId": "p-1", day: 0, id: "id", text: "改行を\n含む\n発言", phase: "waiting", channel: "public", sentAt: 0, senderName: "ゲームマスター", senderColor: "#FF0000", size: "normal" },
    createEvent({ type: "death", target: { id: "1", name: "安部菜々" }, reason: "attack" }),
    createEvent({ type: "death", target: { id: "1", name: "安部菜々" }, reason: "execution" }),
    createEvent({ type: "join", sender: { id: "1", name: "荒木比奈" } }),
    createEvent({ type: "progress", day: 2, phase: "dayDiscussion" }),
    createEvent({ type: "vote", sender: { id: "1", name: "椎名法子" }, target: { id: "2", name: "安部菜々" } }),
    createEvent({ type: "re-vote", times: 1}),
    createEvent({ type: "vote-result", day: 2, result: [
      {player: {id: "2", name: "前川みく"}, target: {id: "3", name: "荒木比奈"}, voted: 4},
      {player: {id: "3", name: "荒木比奈"}, target: {id: "2", name: "前川みく"}, voted: 1},
      {player: {id: "4", name: "安部菜々"}, target: {id: "2", name: "前川みく"}, voted: 0},
      {player: {id: "5", name: "渋谷凛"}, target: {id: "2", name: "前川みく"}, voted: 0},
      {player: {id: "6", name: "森久保乃々"}, target: {id: "2", name: "前川みく"}, voted: 0},
    ]}),
    createEvent({ type: "seer", sender: { id: "1", name: "椎名法子" }, target: { id: "2", name: "安部菜々" }, result: "wolf" }),
    createEvent({ type: "hunter", sender: { id: "1", name: "椎名法子" }, target: { id: "2", name: "安部菜々" } }),
    createEvent({ type: "attack", sender: { id: "1", name: "椎名法子" }, target: { id: "2", name: "安部菜々" } }),
    createEvent({ type: "end", win: "villagers" }),
    createEvent({ type: "end", win: "werewolves" }),
    createEvent({ type: "end", win: "fox" }),
    createEvent({ type: "end", win: "draw" }),

  ]
});
</script>

<template>
  <GameScreen :preview-state="previewState" />
  <DevelopmentPanel v-model="previewState" />
</template>
