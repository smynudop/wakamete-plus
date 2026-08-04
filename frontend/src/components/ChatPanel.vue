<script lang="ts" setup>
import { GameLogEntry, GameEventEntry } from '@wakamete-plus/shared';
import { teamLabels, phaseLabels } from '../resource';

defineProps<{
    logs: GameLogEntry[]
}>()

const formatDate = (dt: number) => {
    const d = new Date(dt)
    return `${d.getFullYear().toString().slice(2)}/${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`
}
</script>

<template>
    <div class="chat">
    <div class="messages">
        <p
        v-for="entry in logs"
        :key="entry.id"
        :class="entry.kind === 'chat' ? ['message', entry.channel] : ['event-entry', entry.detail.type]"
        >
        <template v-if="entry.kind === 'chat'">
            <span ><span :style="{ color: entry.senderColor }">◆</span><strong>{{ entry.senderName }}</strong>さん</span>
            <span class="chat-text" :class="`chat-size-${entry.size}`">「{{entry.text}}」</span>
        </template>
        <template v-else>
            <template v-if="entry.detail.type == 'join'">
                <img src="/msg.gif"><strong>{{ entry.detail.sender.name }}</strong>さんが村にやってきました。({{ formatDate(entry.sentAt) }})
            </template>
            <template v-else-if="entry.detail.type == 'start'">
                <img src="/msg.gif">村が開始しました。
            </template>
            <template v-else-if="entry.detail.type == 'end'">
                <template v-if="entry.detail.win == 'draw'">引き分けです！</template>
                <template v-else>{{teamLabels[entry.detail.win]}}の勝利です！</template>
            </template>
            <template v-else-if="entry.detail.type == 'progress'">
                <img src="/ampm.gif">{{entry.detail.day}}日目の{{ phaseLabels[entry.detail.phase] }}になりました。({{ formatDate(entry.sentAt) }})
            </template>
            <template v-else-if="entry.detail.type == 'vote'">
                <strong>{{entry.detail.sender.name}}</strong>さんが<strong>{{ entry.detail.target.name }}</strong>に投票しました。
            </template>
            <template v-else-if="entry.detail.type == 're-vote'">
                再投票になりました。
            </template>
            <template v-else-if="entry.detail.type == 'vote-result'">
                <span>{{ entry.detail.day }}日目 投票結果。</span>
                <table>
                    <tr v-for="r in entry.detail.result">
                        <td><strong>{{ r.player.name }}</strong>さん</td>
                        <td>{{ r.voted }} 票</td>
                        <td>投票先 → <strong>{{ r.target.name }}</strong>さん</td>
                    </tr>
                </table>
            </template>
            <template v-else-if="entry.detail.type == 'seer'">
                <img src="/ura.gif"><strong>{{entry.detail.sender.name}}</strong>さんが<strong>{{ entry.detail.target.name }}</strong>を占い、結果は{{entry.detail.result}}でした。
            </template>
            <template v-else-if="entry.detail.type == 'hunter'">
                <img src="/msg.gif"><strong>{{entry.detail.sender.name}}</strong>さんが<strong>{{ entry.detail.target.name }}</strong>を護衛します。
            </template>
            <template v-else-if="entry.detail.type == 'attack'">
                <img src="/wlf.gif"><strong>{{entry.detail.sender.name}}</strong>さんが<strong>{{ entry.detail.target.name }}</strong>さんを襲撃します。
            </template>
            <template v-else-if="entry.detail.type == 'death'">
                <img src="/dead2.gif"><strong>{{ entry.detail.target.name }}</strong>さんが死亡しました。({{ entry.detail.reason === 'sudden-death' ? '突然死' : entry.detail.reason }})
            </template>
            <template v-else>
                {{ entry }}
            </template>
        </template>
        </p>
    </div>
    </div>
</template> 

<style scoped>

.messages p {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 4px;
  margin-bottom: 4px;
  line-height: 1.45;
}

.messages p.vote  {
    user-select: none;
  color: rgb(25, 31, 63);
  background-color: #dee1e7;
  line-height: 1.5;
}

.messages p.werewolf .chat-text {
  color: #eca1aa;
}

.messages p.shared .chat-text {
  color: #95ceab;
}

.messages p.dead .chat-text {
    background-color: gray;
  color: #b5a6c9;
}

.messages p.monologue .chat-text {
  color: #a8b9d8;
}

.messages p.event-entry {
  display:block;
}
.messages p img{
    margin-right: .25em;
}

.event-entry.end{
    font-size: 160%;
}
.chat {
  gap: 12px;
}
.chat-text{
    white-space: pre-wrap;
}
.chat-size-strong {
  font-size: 1.25em;
  font-weight: 700;
}

.chat-size-weak {
  color: #6666ee;
  font-size: 0.9em;
}

.event-entry.progress .event-message{
    font-size: 130%;
}
.event-message{
    padding-left: .25em;
}


</style>
