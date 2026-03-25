<script setup lang="ts">
import IconModel from '~icons/ri/robot-2-line'
import IconModelPart from '~icons/ri/square-line'

defineProps<{
  model: {
    path?: string
    name?: string
    framework?: string
    license?: string
    parts?: Array<{ path: string; name?: string }>
  }
}>()
</script>

<template>
  <div class="animate-in fade-in duration-200">
    <div class="flex flex-col gap-3">
      <div class="flex items-start gap-4 p-4 bg-surface border-2 border-gray-03 transition-all duration-200 hover:border-gold hover:shadow-sm">
        <div class="w-10 h-10 flex items-center justify-center shrink-0 bg-layer-model/15 text-layer-model">
          <IconModel class="size-5.5" />
        </div>
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <span class="text-sm text-off-white font-medium break-all font-mono">{{ model.path }}</span>
          <span v-if="model.name" class="text-sm text-gray-01 font-semibold">{{ model.name }}</span>
          <div class="flex flex-wrap gap-2 mt-1">
            <span v-if="model.framework" class="py-0.5 px-2 bg-elevation-04 text-xs text-gray-01">{{ model.framework }}</span>
            <span v-if="model.license" class="py-0.5 px-2 bg-elevation-04 text-xs text-gray-01">{{ model.license }}</span>
          </div>
        </div>
      </div>
      <div v-for="part in model.parts" :key="part.path" class="ml-6 flex items-start gap-4 p-4 bg-surface border border-gray-03 opacity-90 transition-all duration-200 hover:border-gold hover:shadow-sm">
        <div class="w-10 h-10 flex items-center justify-center shrink-0 bg-layer-model/10 text-layer-model">
          <IconModelPart class="size-5.5" />
        </div>
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <span class="text-sm text-off-white font-medium break-all font-mono">{{ part.path }}</span>
          <span v-if="part.name" class="text-sm text-gray-01 font-semibold">{{ part.name }}</span>
          <span class="text-xs text-gray-02 uppercase tracking-widest">Model Part</span>
        </div>
      </div>
    </div>
  </div>
</template>
