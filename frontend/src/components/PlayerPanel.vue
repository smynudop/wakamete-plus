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
        <div class="icon" :style="{ backgroundColor: player.color }">
        <img :src="player.alive ? `/alive1.gif` : `/grave.gif`" />
        </div>
        <div>
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

.players li img{
  display: block;
  padding: 2px;
  width: 32px;
  height: 32px;
}

.players li.dead {
  filter: grayscale(100%);
}



.game-master::after{
content: "GM";
color: white;
background-color: rgb(224, 65, 37);
border-radius: 2px;
position: absolute;
right: 0;
top: 0;
padding: 2px;
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
</style>
