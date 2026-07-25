<script lang="ts" setup>
type Target = {id: string, name: string}
defineProps<{
    targets: Target[]
    descriptionLabel: string
    executeLabel: string
}>()
const emits = defineEmits<{
    (e: "execute", id: string): void
}>()

function execute(){
    if(model.value === undefined){
        return 
        //todo: どうしよう...?
    }
    emits("execute", model.value)
}

const model = defineModel<string>("")

</script>

<template>
    <div class="action-line">
        <select v-model="model">
            <option value="">{{ descriptionLabel }}</option>
            <option v-for="player in targets" :key="player.id" :value="player.id">{{ player.name }}</option>
        </select>
        <button @click="execute">{{ executeLabel }}</button>
    </div>
</template>

<style scoped>
.action-line {
  display: flex;
  gap: 10px;
}
select{
    width: 400px;
}
</style>