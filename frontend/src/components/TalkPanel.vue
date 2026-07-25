<script lang="ts" setup>
type ChatChannelOption = {
    value: string
    label: string
}
defineProps<{
    canChat: boolean
    chatChannelOptions: ChatChannelOption[]
}>()
const emits = defineEmits<{
    (e: "send"): void
}>()

function sendChat()
{
    emits("send")
}
const chatChannel = defineModel("chatChannel", {required: true})
const chatText = defineModel("chatText", {required: true})
</script>


<template>
    <form class="chat-form" @submit.prevent="sendChat">
        <select v-if="chatChannelOptions.length > 1" v-model="chatChannel">
        <option v-for="option in chatChannelOptions" :key="option.value" :value="option.value">
            {{ option.label }}
        </option>
        </select>
        <input type="text" v-model="chatText" :disabled="!canChat" maxlength="160" />
        <button :disabled="!canChat">発言</button>
    </form>
</template>   