<script lang="ts" setup>
import type {
  PublicPlayer
} from "@wakamete-plus/shared";
import { roleLabels } from "../resource";

const props = defineProps<{
    players: PublicPlayer[]
}>()
</script>

<template>
    <ul class="players">
    <li v-for="player in players" 
        :key="player.id" 
        :class="{ dead: !player.alive, disconnected: !player.connected, 'game-master': player.gameMaster }" 
        class="player">
        <div class="icon" :style="{ backgroundColor: player.alive ? player.color : 'transparent' }">
          <img :src="player.alive ? `/alive1.gif` : `/grave.gif`" />
        </div>
        <div class="info">
          <div class="mark" :style="{ color: player.color }">◆</div>
            <div>{{ player.name }}</div>
            <div v-if="player.handleName">HN: {{ player.handleName }}</div>
            <div v-if="player.role">[<span :class="player.role">{{ roleLabels[player.role] }}</span>]</div>
            <div>{{ player.alive ? "（生存中）" : "（死　亡）" }}</div>
        </div>
    </li>
    </ul>
</template>

<style scoped>

.players small {
  color: #5f6870;
}

.players {

  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 90%;
  line-height: 1.2;
}

.players li {
 position: relative;
  display: flex;
  flex-basis: 160px;
  flex-shrink: none;
  /* border-top: 2px solid #ede6db; */
  padding: 3px 0;
  gap: .25em;
}
.players li.disconnected{
    /* border-top-color: rgb(233, 113, 113); */
}

.players li .icon{
  border: 1px solid #333;
  display: flex;
  align-items: center;
}

.players li.dead .icon{
  border-color: transparent;
}

.players li img{
  display: block;
  padding: 2px;
  width: 32px;
  height: 32px;
}

.players li.dead {
  /* filter: grayscale(100%); */

}

.werewolf{
  color: red;
}
.seer, .shared{
  color: #00cc33;
}
.hunter, .medium{
  color: #00ccff;
}

.madman{
  color: #ff0099;
}
.fox{
  color: #ffcc33;
}
@media (min-width: 768px){
  div.mark{
    display: none;
  }
}
@media (max-width: 767px){
  .players{
    /* gap: 0; */
    gap: 2px 6px;;
  }
  .players li{
    border-right: 1px solid #aaa;
    border-bottom: 1px solid #aaa;
  }

  .players li.dead{
    background-color: #ccc;
  }
  .players li div.icon{
    display: none;
  }
  div.info{
    display: flex;
  }
}
</style>
