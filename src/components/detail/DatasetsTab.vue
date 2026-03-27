<script setup lang="ts">
import { stringify } from 'yaml'

import IconDataset from '~icons/ri/database-2-line'
import IconFolder from '~icons/ri/folder-line'

import { useShiki } from '../../composables/useShiki'
import { isPathFolder } from '../../utils'
import CopyButton from '../CopyButton.vue'

defineProps<{
  items: Array<{
    path: string
    name?: string
    description?: string
    license?: string
    parameters?: Record<string, unknown>
  }>
}>()

const { highlightCode } = useShiki()

function toYaml(parameters: Record<string, unknown>): string {
  return stringify(parameters, { sortMapEntries: true })
}
</script>

<template>
  <div class="animate-in fade-in duration-200">
    <div class="flex flex-col gap-3">
      <div v-for="dataset in items" :key="dataset.path" class="flex items-start gap-4 p-4 bg-surface border border-gray-03 transition-all duration-200 hover:border-gold hover:shadow-sm">
        <div class="size-10 flex items-center justify-center shrink-0 bg-layer-datasets/15 text-layer-datasets">
          <Component :is="isPathFolder(dataset.path) ? IconFolder : IconDataset" class="size-6" />
        </div>
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <span class="text-sm text-off-white font-medium break-all font-mono">{{ dataset.path }}</span>
          <span v-if="dataset.name" class="text-sm text-gray-01 font-semibold">{{ dataset.name }}</span>
          <span v-if="dataset.description" class="text-xs text-gray-02 leading-snug">{{ dataset.description }}</span>
          <span v-if="dataset.license" class="py-0.5 px-2 bg-elevation-04 text-xs text-gray-01 w-fit">{{ dataset.license }}</span>

          <div v-if="dataset.parameters && Object.keys(dataset.parameters).length > 0" class="mt-2 border border-gray-03 overflow-hidden">
            <div class="flex items-center justify-between px-3 py-1.5 border-b border-gray-03 bg-elevation-03">
              <span class="text-xs font-medium text-gray-02 uppercase tracking-widest">Parameters</span>
              <CopyButton :content="toYaml(dataset.parameters)" />
            </div>
            <div
              v-if="highlightCode(toYaml(dataset.parameters), 'yaml')"
              class="shiki-container p-3 bg-elevation-01 text-sm"
              v-html="highlightCode(toYaml(dataset.parameters), 'yaml')" />
            <pre v-else class="m-0 p-3 bg-elevation-01"><code class="font-mono text-xs leading-relaxed text-off-white whitespace-pre">{{ toYaml(dataset.parameters) }}</code></pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
