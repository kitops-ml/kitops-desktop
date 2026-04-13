<script setup lang="ts">
import IconDoc from '~icons/ri/file-line'
import IconFolder from '~icons/ri/folder-line'

import { isPathFolder } from '../../utils'

defineProps<{
  items: Array<{ path: string; description?: string }>
}>()
</script>

<template>
  <div class="animate-in fade-in duration-200">
    <div class="flex flex-col gap-3">
      <div v-for="doc in items" :key="doc.path" class="flex items-start gap-4 p-4 bg-surface border border-gray-03 transition-all duration-200 hover:border-gold hover:shadow-sm">
        <div class="size-10 flex items-center justify-center shrink-0 bg-layer-docs/15 text-layer-docs">
          <Component :is="isPathFolder(doc.path) ? IconFolder : IconDoc" class="size-6" />
        </div>
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <span class="text-sm text-off-white font-medium break-all font-mono">{{ doc.path }}</span>
          <span v-if="doc.description" class="text-xs text-gray-02 leading-snug">{{ doc.description }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
