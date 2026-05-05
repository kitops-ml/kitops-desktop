<script setup lang="ts">
import IconSpinner from '~icons/custom-icons/spinner'
import IconCode from '~icons/ri/code-line'
import IconExport from '~icons/ri/folder-download-line'
import IconFolder from '~icons/ri/folder-line'

import { useLayerExport } from '../../composables/useLayerExport'
import { isPathFolder } from '../../utils'
import CopyButton from '../CopyButton.vue'

defineProps<{
  items: Array<{ path: string; description?: string; license?: string }>
  reference?: string
}>()

const { exportingFilter, exportLayer } = useLayerExport()
</script>

<template>
  <div class="animate-in fade-in duration-200">
    <div class="flex flex-col gap-3">
      <div v-for="code in items" :key="code.path" class="group flex items-start gap-4 p-4 bg-surface border border-gray-03 transition-all duration-200 hover:border-gold hover:shadow-sm">
        <div class="size-10 flex items-center justify-center shrink-0 bg-layer-code/15 text-layer-code">
          <Component :is="isPathFolder(code.path) ? IconFolder : IconCode" class="size-6" />
        </div>
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <div class="flex items-start justify-between gap-2">
            <span class="text-sm text-off-white font-medium break-all font-mono">{{ code.path }}</span>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <CopyButton :content="code.path" compact />
              <CopyButton v-if="reference" :content="`kit unpack ${reference} --filter=code:${code.path}`" compact label="kit unpack" />
              <button
                v-if="reference"
                class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all duration-200"
                :class="exportingFilter === `code:${code.path}` ? 'text-gold cursor-wait' : 'text-gray-02 hover:text-gold'"
                :disabled="exportingFilter !== null"
                @click.stop="exportLayer(reference, `code:${code.path}`)">
                <IconSpinner v-if="exportingFilter === `code:${code.path}`" class="size-3.5 shrink-0 animate-spin" />
                <IconExport v-else class="size-3.5 shrink-0" />
                <span>Export</span>
              </button>
            </div>
          </div>
          <span v-if="code.description" class="text-xs text-gray-02 leading-snug">{{ code.description }}</span>
          <span v-if="code.license" class="py-0.5 px-2 bg-elevation-04 text-xs text-gray-01 w-fit">{{ code.license }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
