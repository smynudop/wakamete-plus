<script lang="ts" setup>
import type {
  PrivateState,
  PublicGameState,
  DivineResult,
} from "@wakamete-plus/shared";
import { roleLabels, roleDescriptions } from "../resource";
import { computed } from "vue";

const props = defineProps<{
    privateState: PrivateState,
    state: PublicGameState
}>()    

const sharedPlayers = computed(() =>
  props.state.players.filter((player) => props.privateState.sharedPlayerIds.includes(player.id))
);
const knownWerewolves = computed(() =>
  props.state.players.filter((player) => props.privateState.knownWerewolfPlayerIds.includes(player.id))
);

const isAlive = computed(() => 
    props.state.players.find(p => p.id === props.privateState.playerId)?.alive
)
function formatDivine(result: DivineResult) {
  return `${result.day}日目: ${result.targetName} は ${result.result === "werewolf" ? "人狼" : "人間"}`;
}
</script>

<template>
    <div class="role-box" v-if="privateState.role">
        <template v-if="isAlive">
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
            <p v-if="privateState.knownWerewolfPlayerIds.length > 0">
                人狼: {{ knownWerewolves.map((player) => player.name).join("、") }}
            </p>
        </template>
        <template v-else>
            アナタは死亡しました・・・
        </template>
    </div>
</template> 

<style scoped>
.role-box {
  margin: .25em 0;
  user-select: none;
}
.role-box strong {
  font-size: 24px;
}
</style>