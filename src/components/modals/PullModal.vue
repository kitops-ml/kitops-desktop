<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import Modal from '../Modal.vue'
import Input from '../ui/Input.vue'

const props = defineProps<{
  open: boolean
  error: string | null
  loading: boolean
}>()

const emit = defineEmits<{ close: []; submit: [reference: string] }>()

const reference = ref('')
const formRef = ref<HTMLFormElement>()

watch(
  () => props.open,
  (val) => {
    if (val) {
      reference.value = ''
      nextTick(() => formRef.value?.querySelector<HTMLInputElement>('input')?.focus())
    }
  },
)
</script>

<template>
  <Modal :open="open" @close="$emit('close')">
    <h3 class="text-xl font-bold mb-2">Pull ModelKit</h3>
    <p class="text-gray-01 text-sm mb-6">Pull a ModelKit from a remote registry to your local storage.</p>
    <form ref="formRef" class="flex flex-col gap-4" @submit.prevent="emit('submit', reference)">
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-sm text-gray-01">Reference <span class="text-error">*</span></label>
        <Input
          v-model="reference"
          type="text"
          placeholder="jozu.ml/user/model:tag"
          required
          :disabled="loading" />
        <p class="text-xs text-gray-02">The full reference of the ModelKit to pull (e.g., registry/repository:tag)</p>
      </div>
      <div v-if="error" class="p-3 bg-error/10 border border-error text-error text-sm">{{ error }}</div>
      <div v-if="loading" class="flex flex-col gap-2">
        <div class="h-1 bg-elevation-03 overflow-hidden relative">
          <div class="pull-progress-bar absolute inset-y-0 w-1/3 bg-gold"></div>
        </div>
      </div>
      <div class="flex gap-3 mt-2">
        <button
          type="button"
          class="flex-1 button-secondary"
          :disabled="loading"
          @click="$emit('close')">
          Cancel
        </button>
        <button
          type="submit"
          class="flex-1 button-submit"
          :disabled="loading || !reference.trim()">
          {{ loading ? 'Pulling...' : 'Pull' }}
        </button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.pull-progress-bar {
  animation: pull-slide 1.4s ease-in-out infinite;
}

@keyframes pull-slide {
  0% {
    left: -33%;
  }

  100% {
    left: 100%;
  }
}
</style>
