<script setup lang="ts">
import IconSpinner from '~icons/custom-icons/spinner'
import IconExternalLink from '~icons/ri/external-link-line'
import IconDoc from '~icons/ri/file-line'
import IconExport from '~icons/ri/folder-download-line'
import IconFolder from '~icons/ri/folder-line'

import { useLayerExport } from '../../composables/useLayerExport'
import { isPathFolder } from '../../utils'
import CopyButton from '../CopyButton.vue'

defineProps<{
  items: Array<{ path: string; description?: string }>
  reference?: string
}>()

const { exportingFilter, exportLayer } = useLayerExport()

function isUrl(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://')
}

function openExternal(url: string) {
  window.kitops.shell.openExternal(url)
}
</script>

<template>
  <div class="animate-in fade-in duration-200">
    <div class="flex flex-col gap-3">
      <div v-for="doc in items" :key="doc.path" class="group flex items-start gap-4 p-4 bg-surface border border-gray-03 transition-all duration-200 hover:border-gold hover:shadow-sm">
        <div class="size-10 flex items-center justify-center shrink-0 bg-layer-docs/15 text-layer-docs">
          <Component :is="isPathFolder(doc.path) ? IconFolder : IconDoc" class="size-6" />
        </div>
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <div class="flex items-start justify-between gap-2">
            <span class="text-sm text-off-white font-medium break-all font-mono">{{ doc.path }}</span>
            <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                v-if="isUrl(doc.path)"
                class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-gray-02 transition-all duration-200 hover:text-gold"
                @click.stop="openExternal(doc.path)">
                <IconExternalLink class="size-3.5 shrink-0" />
                <span>Open URL</span>
              </button>
              <CopyButton :content="doc.path" label="Copy path" compact />
              <CopyButton v-if="reference" :content="`kit unpack ${reference} --filter=docs:${doc.path}`" compact label="kit unpack" />
              <button
                v-if="reference"
                class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all duration-200"
                :class="exportingFilter === `docs:${doc.path}` ? 'text-gold cursor-wait' : 'text-gray-02 hover:text-gold'"
                :disabled="exportingFilter !== null"
                @click.stop="exportLayer(reference, `docs:${doc.path}`)">
                <IconSpinner v-if="exportingFilter === `docs:${doc.path}`" class="size-3.5 shrink-0 animate-spin" />
                <IconExport v-else class="size-3.5 shrink-0" />
                <span>Export</span>
              </button>
            </div>
          </div>
          <span v-if="doc.description" class="text-xs text-gray-02 leading-snug">{{ doc.description }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
