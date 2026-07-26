<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <header class="site-header">
    <RouterLink to="/" class="site-title">Wakamete plus</RouterLink>
    <nav>
      <RouterLink to="/">トップ</RouterLink>
      <RouterLink to="/lobby">ロビー</RouterLink>
    </nav>
  </header>
  <RouterView />
</template>
