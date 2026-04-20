<script setup lang="ts">
import { computed, watch } from 'vue'

import { validateRepositoryName } from './validateRepositoryName'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue: string
  error?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:error': [error: string]
}>()

const currentError = computed(() => validateRepositoryName(props.modelValue))

watch(currentError, (val) => emit('update:error', val), { immediate: true })

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <input
      v-bind="$attrs"
      :value="modelValue"
      type="text"
      :class="[
        'py-3 px-4 bg-elevation-03 border text-off-white text-[0.95rem] font-mono transition-all duration-200 focus:outline-none focus:bg-elevation-02',
        currentError ? 'border-error focus:border-error' : 'border-gray-03 focus:border-gold',
      ]"
      @input="onInput" />
    <p v-if="currentError" class="text-xs text-error">{{ currentError }}</p>
  </div>
</template>
