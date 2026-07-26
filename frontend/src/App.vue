<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div class="container">
  <aside class="site-header">
    <RouterLink to="/" class="site-title">わかめて+</RouterLink>
    <nav>
      <RouterLink to="/">トップ</RouterLink>
      <RouterLink to="/lobby">ロビー</RouterLink>
    </nav>
  </aside>
  <RouterView />
  </div>
</template>

<style scoped>
.container{
  display: grid;
  grid-template-columns: 200px 1fr;
  min-height: 100vh;
}

.site-header {
  padding: 0.85rem 1.25rem;
  background: #fae4ac;
  border-right: #ccc 2px solid;
}

.site-header nav a{
  display: block;
  background-color: #6f510a;
  color: white;
  margin: .5em 0;
  padding: .25em .5em;
  text-align: right;
  text-decoration: none;

}

.site-title {
  color: inherit;
  font-weight: 700;
  text-decoration: none;
}
</style>