<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import Modal from '../Modal.vue'
import Input from '../ui/Input.vue'

const props = defineProps<{
  open: boolean
  repository: string
  tag: string
  error: string | null
  loading: boolean
}>()

const emit = defineEmits<{ close: []; submit: [tagName: string] }>()

const tagName = ref('latest')
const formRef = ref<HTMLFormElement>()

watch(() => props.open, (val) => {
  if (val) {
    tagName.value = 'latest'
    nextTick(() => formRef.value?.querySelector<HTMLInputElement>('input')?.focus())
  }
})
</script>

<template>
  <Modal
    :open="open"
    class="max-w-xl"
    @close="$emit('close')">
    <h3 class="text-xl font-bold mb-2">Tag ModelKit</h3>
    <p class="text-gray-01 text-sm mb-6">Create a new tag for this ModelKit</p>
    <form ref="formRef" class="flex flex-col gap-4" @submit.prevent="emit('submit', tagName)">
      <div class="p-3 bg-elevation-01 border border-gray-03">
        <span class="text-xs text-gray-02 block mb-1">Tagging:</span>
        <code class="text-sm font-mono text-off-white break-all">{{ repository }}:{{ tag }}</code>
      </div>
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-sm text-gray-01">New Tag Name <span class="text-error">*</span></label>
        <Input
          v-model="tagName"
          type="text"
          placeholder="latest"
          required />
        <p class="text-xs text-gray-02">Version tag for this ModelKit (e.g., latest, v1.0.0)</p>
      </div>
      <div class="p-3 bg-elevation-01 border border-gray-03">
        <span class="text-xs text-gray-02 block mb-1">New tag will be:</span>
        <code class="text-sm font-mono text-gold break-all">{{ repository }}:{{ tagName || 'tag' }}</code>
      </div>
      <div v-if="error" class="p-3 bg-error/10 border border-error text-error text-sm">{{ error }}</div>
      <div class="flex gap-3 mt-2">
        <button
          type="button"
          class="flex-1 button-secondary"
          @click="$emit('close')">
          Cancel
        </button>
        <button
          type="submit"
          class="flex-1 button-submit"
          :disabled="loading || !tagName">
          {{ loading ? 'Tagging...' : 'Create Tag' }}
        </button>
      </div>
    </form>
  </Modal>
</template>
