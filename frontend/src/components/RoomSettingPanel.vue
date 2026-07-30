<script setup lang="ts">
import {ref} from "vue"
import type { RoomSettings } from '@wakamete-plus/shared';
const emits = defineEmits<{
    (e: "submit"): void
}>()
const roomSettings = defineModel<RoomSettings>({required: true})
const show = ref(false)
const toggle = () => show.value = !show.value
const submit = () => {
    show.value = false
    emits("submit")
}
</script>

<template>
    <div>
    <button type="button" @click="toggle">村の設定を変更</button>
    <form @submit.prevent="submit" class="settings-panel" v-if="show" >
        <label style="flex: 100%;">
        村名
        <input v-model="roomSettings.roomName" type="text" maxlength="80" />
        </label>
        <label  style="flex: 100%;">
        PR
        <input v-model="roomSettings.pr" type="text"  maxlength="160" />
        </label>
        <label  style="flex: 45%;">
        定員
        <input v-model.number="roomSettings.playerLimit" type="number" min="4" max="20" />
        </label>
        <label style="flex: 45%; flex-grow: 1;"></label>
        <label  style="flex: 20%;">
        昼（秒）
        <input v-model.number="roomSettings.durationSeconds.dayDiscussion" type="number" min="30" max="300" />
        </label>
        <label  style="flex: 20%;">
        投票（秒）
        <input v-model.number="roomSettings.durationSeconds.dayVote" type="number" min="30" max="300" />
        </label>
        <label  style="flex: 20%;">
        夜（秒）
        <input v-model.number="roomSettings.durationSeconds.nightDiscussion" type="number" min="30" max="300" />
        </label>
        <label  style="flex: 20%;">
        襲撃（秒）
        <input v-model.number="roomSettings.durationSeconds.nightAttack" type="number" min="30" max="300" />
        </label>
        <label style="flex: 10%; flex-grow: 1;"></label>

        <button>設定を保存</button>
                <button type="button" @click="show = false">キャンセル</button>
    </form>
    </div>
</template> 

<style scoped>
div{
  margin: .5em 0;
}

.settings-panel {
  display: flex;
  flex-wrap: wrap;
  gap: .25em;
  border: 1px solid #666;
  padding: .5em;
  border-radius: .25em;
  margin-top: .5em;
}



.settings-panel label {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 4px;
  color: #5f6870;
  align-items: center;
  text-align: right;
}

</style>