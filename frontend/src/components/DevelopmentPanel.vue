<script setup lang="ts">
import type { GamePhase, Role } from "@wakamete-plus/shared";
import type {
  PublicGameState,
  GameLogEntry
} from "@wakamete-plus/shared";
export interface DevelopmentPreviewState {
  joined: boolean;
  role: Role | null;
  phase: GamePhase;
  alive: boolean;
  gameMaster: boolean;
  canStart: boolean;
  hasDivineResult: boolean;
  gameState: PublicGameState;
  log: GameLogEntry[]
}

defineProps<{
  modelValue: DevelopmentPreviewState;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: DevelopmentPreviewState];
}>();

function update<Key extends keyof DevelopmentPreviewState>(
  current: DevelopmentPreviewState,
  key: Key,
  value: DevelopmentPreviewState[Key]
) {
  emit("update:modelValue", { ...current, [key]: value });
}
</script>

<template>
  <aside class="development-panel">
    <h2>UI プレビュー</h2>
    <div class="development-controls">
      <label>
        フェーズ
        <select
          :value="modelValue.phase"
          @change="update(modelValue, 'phase', ($event.target as HTMLSelectElement).value as GamePhase)"
        >
          <option value="waiting">待機中</option>
          <option value="nightDiscussion">夜の議論</option>
          <option value="nightAttack">夜の襲撃</option>
          <option value="dayDiscussion">昼の議論</option>
          <option value="dayVote">昼の投票</option>
          <option value="ended">終了</option>
        </select>
      </label>

      <label>
        役職
        <select
          :value="modelValue.role ?? ''"
          @change="update(modelValue, 'role', (($event.target as HTMLSelectElement).value || null) as Role | null)"
        >
          <option value="">役職なし</option>
          <option value="villager">村人</option>
          <option value="seer">占い師</option>
          <option value="werewolf">人狼</option>
          <option value="madman">狂人</option>
          <option value="medium">霊能者</option>
          <option value="hunter">狩人</option>
          <option value="shared">共有者</option>
          <option value="fox">妖狐</option>
          <option value="cat">猫又</option>
          <option value="fanatic">狂信者</option>
          <option value="immoralist">背徳者</option>
        </select>
      </label>

      <label><input type="checkbox" :checked="modelValue.joined" @change="update(modelValue, 'joined', ($event.target as HTMLInputElement).checked)" />参加済み</label>
      <label><input type="checkbox" :checked="modelValue.alive" @change="update(modelValue, 'alive', ($event.target as HTMLInputElement).checked)" />生存</label>
      <label><input type="checkbox" :checked="modelValue.gameMaster" @change="update(modelValue, 'gameMaster', ($event.target as HTMLInputElement).checked)" />ゲームマスター</label>
      <label><input type="checkbox" :checked="modelValue.canStart" @change="update(modelValue, 'canStart', ($event.target as HTMLInputElement).checked)" />開始可能</label>
      <label><input type="checkbox" :checked="modelValue.hasDivineResult" @change="update(modelValue, 'hasDivineResult', ($event.target as HTMLInputElement).checked)" />占い結果あり</label>
    </div>
    <p>この画面は開発時のみ利用でき、ゲームサーバーには接続しません。</p>
  </aside>
</template>

<style scoped>
.development-panel {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 10;
  width: min(300px, calc(100vw - 24px));
  border: 1px solid #b9b0a2;
  border-radius: 8px;
  padding: 12px;
  background: rgba(255, 253, 250, 0.96);
  box-shadow: 0 4px 20px rgba(29, 35, 42, 0.2);
  color: black;
}

h2 {
  margin-bottom: 8px;
}

p {
  margin-top: 8px;
  color: #5f6870;
  font-size: 12px;
}

.development-controls {
  /* display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 10px; */
}

.development-controls label {
  /* display: grid;
  gap: 2px;
  font-size: 13px; */
  display: block;
}

select{
  width: 60%;
}
</style>
