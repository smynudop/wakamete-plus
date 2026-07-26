<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <main class="page-shell top-page">
    <section class="hero">
      <p class="eyebrow">オンライン短期人狼</p>
      <h1>Wakamete plus</h1>
      <p>公開村に集まり、議論と推理でそれぞれの陣営を勝利へ導こう。</p>
      <RouterLink to="/lobby" class="primary-link">公開村を探す</RouterLink>
    </section>
  </main>
</template>

