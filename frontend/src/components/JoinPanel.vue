<script setup lang="ts">
import { PLAYER_COLORS } from "@wakamete-plus/shared";

export interface JoinState {
  name: string;
  handleName: string;
  color: string;
  password: string;
  sessionToken: string;
}

const joinState = defineModel<JoinState>({ required: true });
defineProps<{ profileEdit?: boolean }>();
const emit = defineEmits<{
  submit: [];
}>();
</script>

<template>
  <form class="join-panel" @submit.prevent="emit('submit')">
    <label>
      プレイヤー名
      <input v-model="joinState.name" maxlength="24" />
    </label>
    <label v-if="!profileEdit">
      ハンドル名
      <input v-model="joinState.handleName" maxlength="24" />
    </label>
    <fieldset>
      <legend>色</legend>
      <div class="color-options">
        <label
          v-for="presetColor in PLAYER_COLORS"
          :key="presetColor"
          class="color-option"
          :title="presetColor"
        >
          <input
            v-model="joinState.color"
            type="radio"
            name="player-color"
            :value="presetColor"
          />
          <span class="color-swatch" :style="{ backgroundColor: presetColor }" />
        </label>
      </div>
    </fieldset>
    <label v-if="!profileEdit">
      復帰用パスワード
      <input v-model="joinState.password" type="password" maxlength="64" />
    </label>
    <button type="submit">{{ profileEdit ? "変更" : "参加" }}</button>
  </form>
</template>

<style scoped>
.join-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 0.8rem;
  margin: 0 auto 1rem;
}

.join-panel > label,
fieldset {
  display: grid;
  gap: 0.4rem;
  color: #5f6870;
}

fieldset {
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

legend {
  margin-bottom: 0.4rem;
  padding: 0;
}

.color-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-height: 2rem;
  align-items: center;
}

.color-option {
  position: relative;
  cursor: pointer;
}

.color-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.color-swatch {
  display: block;
  width: 1.6rem;
  height: 1.6rem;
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px #a9a197;
}

.color-option input:checked + .color-swatch {
  box-shadow: 0 0 0 2px #1d232a;
}

.color-option input:focus-visible + .color-swatch {
  outline: 2px solid #2f80c7;
  outline-offset: 3px;
}

@media (max-width: 760px) {
  .join-panel {
    grid-template-columns: 1fr;
  }
}
</style>
