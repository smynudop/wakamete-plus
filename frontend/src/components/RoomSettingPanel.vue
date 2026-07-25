<script setup lang="ts">
import type { RoomSettings } from '@wakamete-plus/shared';
const emits = defineEmits<{
    (e: "submit"): void
}>()
const roomSettings = defineModel<RoomSettings>({required: true})
</script>

<template>
    <form @submit.prevent="emits('submit')" class="settings-panel" >
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
</template> 