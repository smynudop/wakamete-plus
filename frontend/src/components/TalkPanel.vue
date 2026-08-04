<script lang="ts" setup>
import { watch } from "vue";
import type { ChatSize } from "@wakamete-plus/shared";

type ChatChannelOption = {
    value: string
    label: string
}
const props = defineProps<{
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

watch(() => [props.chatChannelOptions.map((option) => option.value).join("|"), props.canChat], () => {
    chatChannel.value = props.chatChannelOptions[0]?.value ?? "public"
}, { immediate: true })

function toggleSize(size: Exclude<ChatSize, "normal">) {
    chatSize.value = chatSize.value === size ? "normal" : size
}
</script>


<template>
    <form class="chat-form" @submit.prevent="sendChat">
        <div v-if="chatChannelOptions.length > 1" >
        発言の種類：
        <select v-model="chatChannel">
        <option v-for="option in chatChannelOptions" :key="option.value" :value="option.value">
            {{ option.label }}
        </option>
        </select>
        </div>
        <div>
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
            <button :disabled="!canChat" class="talk">発言</button>
        </div>
    </form>
</template>

<style scoped>

select{ 
    width: 200px;
}

.chat-form > div{
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: .5em;
  margin: .25em 0;
}

.size-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.size-buttons button {
    background: #969d9e;
    display: block;
    padding: .3em;
    width: 2.5em;
    border: 2px solid transparent;
}

.size-buttons button.active {
    background: transparent;
    font-weight: bold;
    color: black;
    border-color: red;
    /*box-shadow: inset 0 0 0 0.15rem #fff;*/
}

.talk{
    min-width: 6em;
    height: 100%;
}

.chat-form:has(select) {
  grid-template-columns: minmax(120px, auto) 1fr auto auto;
}

.chat-form textarea {
  min-height: 4.5rem;
  resize: vertical;
}
</style>
