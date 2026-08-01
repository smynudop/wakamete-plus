<script setup lang="ts">
import { computed, ref } from "vue";
import type { Role } from "@wakamete-plus/shared";
import { roleLabels } from "../resource";

type RoleSet = Record<Role, number> & {desc: string};

const roleOrder: Role[] = [
  "villager",
  "seer",
  "medium",
  "hunter",
  "shared",
  "cat",
  "werewolf",
  "madman",
  "fanatic",
  "fox",
  "immoralist"
];
const roleSets = ref<Record<string, RoleSet>>({});
const error = ref("");
const rows = computed(() =>
  Object.entries(roleSets.value).sort(([left], [right]) => Number(left) - Number(right))
);

void fetch("/api/role-sets")
  .then((response) => {
    if (!response.ok) {
      throw new Error("配役表を取得できませんでした。");
    }
    return response.json() as Promise<Record<string, RoleSet>>;
  })
  .then((result) => {
    roleSets.value = result;
  })
  .catch((cause: unknown) => {
    error.value = cause instanceof Error ? cause.message : "配役表を取得できませんでした。";
  });
</script>

<template>
  <main class="page-shell role-sets-page wakamete-back">
    <header class="page-heading">
      <h1>配役表</h1>
      <p>人数には初日犠牲者を含みます。村人欄のうち1名が初日犠牲者です。</p>
    </header>

    <p v-if="error" class="error">{{ error }}</p>
    <div v-else class="role-table-wrap">
      <table class="role-table">
        <thead>
          <tr>
            <th scope="col">人数</th>
            <th>メモ</th>
            <th v-for="role in roleOrder" :key="role" scope="col">{{ roleLabels[role] }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[playerCount, roleSet] in rows" :key="playerCount">
            <th scope="row">{{ playerCount }}人</th>
            <th>{{roleSet.desc}}</th>
            <td v-for="role in roleOrder" :key="role">{{ roleSet[role] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>

<style scoped>
.role-table-wrap {
  overflow-x: auto;
}

.role-table {
  width: 100%;
  border-collapse: collapse;
  background: #fffdf9;
}

.role-table th,
.role-table td {
  border: 1px solid #c8c0b4;
  padding: 0.3rem;
  text-align: center;
  white-space: nowrap;
}

.role-table thead th,
.role-table tbody th {
  background: #f1ece5;
}
</style>
