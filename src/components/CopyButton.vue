<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'

import IconCheck from '~icons/ri/check-line'
import IconCopy from '~icons/ri/file-copy-line'

const props = defineProps<{
  content: string
  label?: string
  compact?: boolean
}>()

const source = computed(() => props.content)
const { copy, copied } = useClipboard({ source })
</script>

<template>
  <button
    v-if="!props.compact"
    class="flex items-center gap-2 py-2 px-3 bg-surface text-sm font-semibold transition-all duration-200 hover:bg-transparent hover:text-gold"
    :class="copied ? 'text-gold' : 'text-gray-01'"
    @click="copy()">
    <span class="relative inline-flex items-center gap-2 overflow-hidden">
      <Transition name="copy-swap" mode="out-in">
        <span v-if="copied" key="copied" class="inline-flex items-center gap-2">
          <IconCheck class="size-4" />
          Copied!
        </span>
        <span v-else key="copy" class="inline-flex items-center gap-2">
          <IconCopy class="size-4" />
          {{ label || 'Copy' }}
        </span>
      </Transition>
    </span>
  </button>
  <button
    v-else
    class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all duration-200 hover:text-gold"
    :class="copied ? 'text-gold' : 'text-gray-02'"
    @click.stop="copy()">
    <IconCheck v-if="copied" class="size-3.5 shrink-0" />
    <IconCopy v-else class="size-3.5 shrink-0" />
    <span>{{ copied ? 'Copied!' : (label || 'Copy') }}</span>
  </button>
</template>

<style scoped>
.copy-swap-enter-active,
.copy-swap-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.copy-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.copy-swap-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
