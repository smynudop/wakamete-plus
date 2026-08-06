<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <main class="page-shell top-page wakamete-back">
    <h1>汝は人狼なりや？ わかめてplus鯖</h1>
    <p>わかめてplus鯖は、続わかめて鯖の精神的後継を目指して開発中のオンライン人狼サーバーです。</p>    
    <h2>特長</h2>
    <ul>
      <li>続わかめて鯖リスペクトのUI</li>
      <li>socket.io活用のリアルタイムチャット</li>
      <li>4人からゲーム可能</li>
      <li>狂信者/背徳者を標準装備</li>
    </ul>
    <section class="hero">
      <RouterLink to="/lobby" class="primary-link">村を探す</RouterLink>
    </section>
  </main>
</template>

<style scoped>
</style>

