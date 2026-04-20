<script setup lang="ts">
import IconTag from '~icons/ri/price-tag-3-line'

import Flyout from '../ui/Flyout.vue'

const props = defineProps<{
  open: boolean,
  repository: string,
  currentTag: string,
  tags: Record<string, number>[]
}>()

const emit = defineEmits<{
  (e: 'close'): void,
  (e: 'select', tag: string): void
}>()

function onTagSelect(modelkitTag: string) {
  emit('select', modelkitTag)
  emit('close')
}
</script>

<template>
  <Flyout :open="props.open" @close="emit('close')">
    <template #header>
      <div class="flex items-center gap-2 text-off-white font-semibold">
        <IconTag class="size-4 text-gold" /> Tags
        <span class="py-0.5 px-1.5 bg-elevation-03 text-gray-01 text-xs font-semibold">{{ props.tags.length }}</span>
      </div>
    </template>
    <ul class="flex-1 overflow-y-auto py-2">
      <li v-for="modelkitTag in props.tags" :key="modelkitTag.name">
        <button
          class="w-full text-left px-5 py-2.5 text-sm font-mono transition-all duration-150 flex justify-between items-center gap-2"
          :class="modelkitTag.name === props.currentTag
            ? 'text-gold bg-elevation-01 border-r-2 border-gold'
            : 'text-gray-01 hover:text-off-white hover:bg-surface'"
          @click="onTagSelect(modelkitTag.name)">
          <span class="flex-1 min-w-0 truncate">
            {{ modelkitTag.name }}
          </span>
          <span class="text-xs">{{ modelkitTag.size }}</span>
        </button>
      </li>
    </ul>
  </Flyout>
</template>
