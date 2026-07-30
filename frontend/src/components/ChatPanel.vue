<script lang="ts" setup>
import { GameLogEntry, GameEventEntry } from '@wakamete-plus/shared';

defineProps<{
    logs: GameLogEntry[]
}>()

const eventImageSource = (log: GameEventEntry) => {
    if(log.eventType == "join") return "/msg.gif"
    if(log.eventType == "death") return "/dead2.gif"
    if(log.eventType == "progress") return "/ampm.gif"
    if(log.eventType == "role") return "/ura.gif"
    return "";
}
const formatDate = (dt: number) => {
    const d = new Date(dt)
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`
}
</script>

<template>
    <div class="chat">
    <div class="messages">
        <p
        v-for="entry in logs"
        :key="entry.id"
        :class="entry.kind === 'chat' ? ['message', entry.channel] : ['event-entry', entry.eventType]"
        >
        <template v-if="entry.kind === 'chat'">
            <span ><span :style="{ color: entry.senderColor }">◆</span><strong>{{ entry.senderName }}</strong>さん</span>
            <span class="chat-text" :class="`chat-size-${entry.size}`">「{{entry.text}}」</span>
        </template>
        <template v-else>
            <img :src="eventImageSource(entry)">
            <span class="event-message">{{ entry.text }}</span>({{ formatDate(entry.sentAt) }})
        </template>
        </p>
    </div>
    </div>
</template> 

<style scoped>
.messages p.event-entry {
  display:block;
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