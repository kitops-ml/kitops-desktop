<script setup lang="ts">
import IconAdd from '~icons/ri/add-line'
import IconRemove from '~icons/ri/close-line'

import Input from '../ui/Input.vue'
import InputPath from '../ui/InputPath.vue'
import LicenseSelect from '../ui/LicenseSelect.vue'

interface LayerEntry {
  path: string
  name?: string
  description?: string
  license?: string
}

const props = defineProps<{
  title: string
  entryLabel: string
  emptyMessage: string
  kitfileBaseDir: string | undefined
  getPathError: (path: string) => string | null
  showName?: boolean
  showLicense?: boolean
}>()

const entries = defineModel<LayerEntry[]>({ required: true })

const emit = defineEmits<{
  add: []
  remove: [index: number]
}>()
</script>

<template>
  <div class="bg-surface border border-gray-03 p-6 mb-6">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-xl font-bold">{{ title }}</h3>
      <button
        class="flex items-center gap-2 py-2 px-3 bg-gold text-black text-[0.85rem] font-semibold transition-all duration-200 hover:bg-gold hover:text-bg-primary"
        @click="emit('add')">
        <IconAdd class="size-3.5" />
        Add
      </button>
    </div>
    <div class="flex flex-col gap-3">
      <div
        v-for="(entry, i) in entries"
        :key="i"
        class="border border-gray-03 bg-elevation-02 p-4">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-semibold text-gray-02 uppercase tracking-wide">{{ entryLabel }} {{ i + 1 }}</span>
          <button
            class="p-1 text-gray-02 transition-all hover:text-error hover:bg-error/10"
            @click="emit('remove', i)">
            <IconRemove class="size-4" />
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div
            class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-01">Path <span class="text-error">*</span></label>
            <InputPath v-model="entry.path" placeholder="path/to/file" :base-dir="kitfileBaseDir" />
            <p v-if="getPathError(entry.path)" class="text-xs text-error">{{ getPathError(entry.path) }}</p>
          </div>
          <div
            class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-01">Description</label>
            <Input v-model="entry.description" type="text" placeholder="What this contains" />
          </div>
          <div v-if="props.showName" class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-01">Name</label>
            <Input v-model="entry.name" type="text" placeholder="name" />
          </div>
          <div v-if="props.showLicense" class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-01">License</label>
            <LicenseSelect v-model="entry.license" />
          </div>
        </div>
      </div>
      <div v-if="!entries.length" class="p-4 bg-elevation-03 border border-gray-03 text-gray-02 text-center text-sm">
        {{ emptyMessage }}
      </div>
    </div>
  </div>
</template>
