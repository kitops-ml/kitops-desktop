<script setup lang="ts">
import { stringify } from 'yaml'

import IconSpinner from '~icons/custom-icons/spinner'
import IconExport from '~icons/ri/folder-download-line'
import IconModel from '~icons/ri/robot-2-line'
import IconModelPart from '~icons/ri/square-line'

import { useLayerExport } from '../../composables/useLayerExport'
import { useShiki } from '../../composables/useShiki'
import CopyButton from '../CopyButton.vue'

defineProps<{
  model: {
    path?: string
    name?: string
    framework?: string
    license?: string
    parameters?: Record<string, unknown>
    parts?: Array<{ path: string; name?: string }>
  }
  reference?: string
}>()

const { exportingFilter, exportLayer } = useLayerExport()
const { highlightCode } = useShiki()

function toYaml(parameters: Record<string, unknown>): string {
  return stringify(parameters, { sortMapEntries: true })
}
</script>

<template>
  <div class="animate-in fade-in duration-200">
    <div class="flex flex-col gap-3">
      <div class="group flex items-start gap-4 p-4 bg-surface border-2 border-gray-03 transition-all duration-200 hover:border-gold hover:shadow-sm">
        <div class="w-10 h-10 flex items-center justify-center shrink-0 bg-layer-model/15 text-layer-model">
          <IconModel class="size-5.5" />
        </div>
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <div class="flex items-start justify-between gap-2">
            <span class="text-sm text-off-white font-medium break-all font-mono">{{ model.path }}</span>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <CopyButton v-if="model.path" :content="model.path" label="Copy path" compact />
              <CopyButton v-if="reference && model.path" :content="`kit unpack ${reference} --filter=model:${model.path}`" compact label="kit unpack" />
              <button
                v-if="reference && model.path"
                class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all duration-200"
                :class="exportingFilter === `model:${model.path}` ? 'text-gold cursor-wait' : 'text-gray-02 hover:text-gold'"
                :disabled="exportingFilter !== null"
                @click.stop="exportLayer(reference, `model:${model.path}`)">
                <IconSpinner v-if="exportingFilter === `model:${model.path}`" class="size-3.5 shrink-0 animate-spin" />
                <IconExport v-else class="size-3.5 shrink-0" />
                <span>Export</span>
              </button>
            </div>
          </div>
          <span v-if="model.name" class="text-sm text-gray-01 font-semibold">{{ model.name }}</span>
          <span v-if="model.description" class="text-xs text-gray-02 leading-snug">{{ model.description }}</span>
          <div class="flex flex-wrap gap-2 mt-1">
            <span v-if="model.framework" class="py-0.5 px-2 bg-elevation-04 text-xs text-gray-01">{{ model.framework }}</span>
            <span v-if="model.license" class="py-0.5 px-2 bg-elevation-04 text-xs text-gray-01">{{ model.license }}</span>
          </div>

          <div v-if="model.parameters && Object.keys(model.parameters).length > 0" class="mt-2 border border-gray-03 overflow-hidden">
            <div class="flex items-center justify-between px-3 py-1.5 border-b border-gray-03 bg-elevation-03">
              <span class="text-xs font-medium text-gray-02 uppercase tracking-widest">Parameters</span>
              <CopyButton :content="toYaml(model.parameters)" />
            </div>
            <div
              v-if="highlightCode(toYaml(model.parameters), 'yaml')"
              class="shiki-container p-3 bg-elevation-01 text-sm"
              v-html="highlightCode(toYaml(model.parameters), 'yaml')" />
            <pre v-else class="m-0 p-3 bg-elevation-01"><code class="font-mono text-xs leading-relaxed text-off-white whitespace-pre">{{ toYaml(model.parameters) }}</code></pre>
          </div>
        </div>
      </div>
      <div v-for="part in model.parts" :key="part.path" class="group ml-6 flex items-start gap-4 p-4 bg-surface border border-gray-03 opacity-90 transition-all duration-200 hover:border-gold hover:shadow-sm">
        <div class="w-10 h-10 flex items-center justify-center shrink-0 bg-layer-model/10 text-layer-model">
          <IconModelPart class="size-5.5" />
        </div>
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <div class="flex items-start justify-between gap-2">
            <span class="text-sm text-off-white font-medium break-all font-mono">{{ part.path }}</span>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <CopyButton :content="part.path" compact />
              <CopyButton v-if="reference" :content="`kit unpack ${reference} --filter=model:${part.path}`" compact label="kit unpack" />
              <button
                v-if="reference"
                class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all duration-200"
                :class="exportingFilter === `model:${part.path}` ? 'text-gold cursor-wait' : 'text-gray-02 hover:text-gold'"
                :disabled="exportingFilter !== null"
                @click.stop="exportLayer(reference, `model:${part.path}`)">
                <IconSpinner v-if="exportingFilter === `model:${part.path}`" class="size-3.5 shrink-0 animate-spin" />
                <IconExport v-else class="size-3.5 shrink-0" />
                <span>Export</span>
              </button>
            </div>
          </div>
          <span v-if="part.name" class="text-sm text-gray-01 font-semibold">{{ part.name }}</span>
          <span class="text-xs text-gray-02 uppercase tracking-widest">Model Part</span>
        </div>
      </div>
    </div>
  </div>
</template>
