<script setup lang="ts">
import IconCode from '~icons/ri/code-line'
import IconFolder from '~icons/ri/folder-line'

import { isPathFolder } from '../../utils'

defineProps<{
  items: Array<{ path: string; description?: string; license?: string }>
}>()
</script>

<template>
  <div class="animate-in fade-in duration-200">
    <div class="flex flex-col gap-3">
      <div v-for="code in items" :key="code.path" class="flex items-start gap-4 p-4 bg-surface border border-gray-03 transition-all duration-200 hover:border-gold hover:shadow-sm">
        <div class="size-10 flex items-center justify-center shrink-0 bg-layer-code/15 text-layer-code">
          <Component :is="isPathFolder(code.path) ? IconFolder : IconCode" class="size-6" />
        </div>
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <span class="text-sm text-off-white font-medium break-all font-mono">{{ code.path }}</span>
          <span v-if="code.description" class="text-xs text-gray-02 leading-snug">{{ code.description }}</span>
          <span v-if="code.license" class="py-0.5 px-2 bg-elevation-04 text-xs text-gray-01 w-fit">{{ code.license }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
