<script lang="ts" setup>
import { PublicGameState } from '@wakamete-plus/shared';
import {ref } from "vue"
const props = defineProps<{
    state: PublicGameState
}>()
const emits = defineEmits<{
    start: [],
    addBot: [],
    kick: [id: string]
}>()
const kickTarget = ref("")
</script>

<template>
    <details>
        <summary>村の管理</summary>

        <section class="start-panel">
            <button :disabled="!state.canStart" @click="emits('start')">開始</button>
            <button
            :disabled="state.players.length >= state.room.playerLimit"
            @click="emits('addBot')"
            >
            Botを追加
            </button>
            <select v-model="kickTarget">
                <option v-for="player in state.players.filter(p => !p.npc && !p.gameMaster)" :key="player.id">
                {{ player.name }}
                </option>
            </select>
            <button type="button" @click="emits('kick', kickTarget)">追い出す</button>

        </section>
    </details>
</template> 

<style scoped>
details{
  border: 1px solid #beb9b9;
  border-radius: 4px;
  padding: .25em .5em;
  background-color: rgba(217, 249, 255, 0.5);
}
summary{
  cursor: pointer;
  user-select: none;
}
select{
    width: 200px;
}
.start-panel{
    display: flex;
    gap: .25em;
}
</style>