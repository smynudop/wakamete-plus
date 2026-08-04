<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import {ref} from "vue"
const hideHeader = ref(false)
</script>

<template>
  <div class="container">
  <aside class="site-header">
    <RouterLink to="/" class="site-title">わかめて+</RouterLink>
    <nav :class="{'hide-nav': hideHeader}">
      <RouterLink to="/">トップ</RouterLink>
      <RouterLink to="/lobby">ログイン/村民登録</RouterLink>
      <RouterLink to="/role-sets">配役表</RouterLink>
      <RouterLink to="/logs">過去ログ</RouterLink>
    </nav>
    <button type="button" class="toggle-button" @click="hideHeader = !hideHeader">{{hideHeader ? "▼" : "▲"}}</button>
  </aside>
  <main class="site-main">
    <RouterView />
  </main>
  </div>
</template>

<style scoped>
.container{
  display: grid;
  height: 100%;
}

.site-header {
  padding: .5em;
  background: #fae4ac;
  border-right: #ccc 2px solid;
  position: relative;
}

.toggle-button{
  position: absolute;
  right:5px;
  top: 5px;
  font-size: 12px;
  background-color: #6f510a;
}

.site-header nav{
  display: grid;
  gap: .5em;
  margin-top: .5em;
}

.site-header nav a{
  display: block;
  background-color: #6f510a;
  color: white;
  padding: .25em .5em;
  text-align: right;
  text-decoration: none;

}

.site-title {
  display: block;
  color: inherit;
  font-weight: 700;
  text-decoration: none;
  font-size: 110%;
}

@media (min-width: 768px){
  main{
  height: 100%;
  overflow-y: auto;
  }
  .container{
      grid-template-columns: 200px 1fr;
  }
  .toggle-button{
    display:none;
  }
}
@media (max-width: 767px)
{
  .container{
    display: block;
    grid-template-columns: 200px 1fr;
    height: 100%;
  }

  .site-header{
        border-bottom: 2px solid #ccc;

  }
  .site-header nav{
        grid-template-columns: repeat(auto-fill, 150px);
  }
  .site-header nav.hide-nav{
    display:none;
  }
}
</style>
