<script lang="ts" setup>
import type { ChatSize } from "@wakamete-plus/shared";

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
const chatChannel = defineModel<string>("chatChannel", {required: true})
const chatText = defineModel<string>("chatText", {required: true})
const chatSize = defineModel<ChatSize>("chatSize", {required: true})

function toggleSize(size: Exclude<ChatSize, "normal">) {
    chatSize.value = chatSize.value === size ? "normal" : size
}
</script>


<template>
    <form class="chat-form" @submit.prevent="sendChat">
        <select v-if="chatChannelOptions.length > 1" v-model="chatChannel">
        <option v-for="option in chatChannelOptions" :key="option.value" :value="option.value">
            {{ option.label }}
        </option>
        </select>
        <textarea
            v-model="chatText"
            :disabled="!canChat"
            maxlength="160"
            rows="3"
            @keydown.ctrl.enter.prevent="sendChat"
        ></textarea>
        <div class="size-buttons">
            <button
                type="button"
                :disabled="!canChat"
                :aria-pressed="chatSize === 'strong'"
                :class="{ active: chatSize === 'strong' }"
                @click="toggleSize('strong')"
            >強</button>
            <button
                type="button"
                :disabled="!canChat"
                :aria-pressed="chatSize === 'weak'"
                :class="{ active: chatSize === 'weak' }"
                @click="toggleSize('weak')"
            >弱</button>
        </div>
        <button :disabled="!canChat">発言</button>
    </form>
</template>

<style scoped>
.size-buttons {
    display: flex;
    gap: 0.25rem;
}

.size-buttons button {
    background: #6d7779;
}

.size-buttons button.active {
    background: #8b2430;
    box-shadow: inset 0 0 0 0.15rem #fff;
}
</style>
