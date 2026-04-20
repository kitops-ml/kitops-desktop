<script setup lang="ts">
import IconDoc from '~icons/ri/file-line'

import ReadmeContent from './ReadmeContent.vue'

defineProps<{
  repository: string
  tag: string
  manifestVersion?: string
  size: string,
  docs: Array<{ path: string }>
}>()
</script>

<template>
  <div class="animate-in fade-in duration-200">
    <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 mb-6">
      <div class="min-w-0">
        <h3 class="text-xs font-bold text-gray-02 uppercase tracking-widest mb-4">Repository Info</h3>
        <div class="flex flex-col gap-3 ml-6 divide-y divide-gray-03">
          <div class="flex justify-between items-start gap-3 pb-2">
            <span class="text-sm text-gray-02 shrink-0">Repository</span>
            <span class="text-sm text-off-white font-medium text-right font-mono break-all min-w-0">{{ repository }}</span>
          </div>
          <div class="flex justify-between items-start gap-3 pb-2">
            <span class="text-sm text-gray-02 shrink-0">Tag</span>
            <span class="text-sm text-off-white font-medium text-right font-mono break-all min-w-0">{{ tag }}</span>
          </div>
          <div class="flex justify-between items-start gap-3 pb-2">
            <span class="text-sm text-gray-02 shrink-0">Manifest Version</span>
            <span class="text-sm text-off-white font-medium text-right font-mono break-all min-w-0">{{ manifestVersion }}</span>
          </div>
          <div
            class="flex justify-between items-start gap-3 pb-2">
            <span class="text-sm text-gray-02 shrink-0">Size</span>
            <span class="text-sm text-off-white font-medium text-right font-mono break-all min-w-0">{{ size }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="docs.length > 0" class="bg-surface border border-gray-03 overflow-hidden">
      <div class="flex items-center gap-2 py-3 px-5 bg-elevation-03 border-b border-gray-03">
        <IconDoc class="size-5.5 text-layer-docs" />
        <span class="text-sm font-semibold text-gray-01">README</span>
      </div>
      <div class="p-5">
        <ReadmeContent :repository="repository" :tag="tag" :docs="docs" />
      </div>
    </div>
  </div>
</template>
