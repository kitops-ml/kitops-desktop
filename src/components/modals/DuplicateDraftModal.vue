<script setup lang="ts">
import Modal from '../Modal.vue'

defineProps<{
  open: boolean
  name: string
}>()

defineEmits<{ close: []; confirm: [mode: 'copy-assets' | 'update-references'] }>()
</script>

<template>
  <Modal :open="open" class="max-w-lg" @close="$emit('close')">
    <h3 class="text-xl font-bold mb-2">Duplicate Draft Kitfile</h3>
    <p class="text-gray-01 mb-4">
      You are about to duplicate <span class="font-semibold text-off-white">"{{ name }}"</span>.
    </p>
    <p class="text-gray-01 mb-4">
      This Kitfile may reference external files (models, code, datasets). Choose how to handle these references in the duplicate:
    </p>
    <div class="flex flex-col gap-3 mb-6">
      <button
        class="flex flex-col items-start p-4 bg-elevation-03 border border-gray-03 text-left transition-all duration-200 hover:border-gold hover:bg-gold/5"
        @click="$emit('confirm', 'copy-assets')">
        <span class="font-semibold text-off-white mb-1">Copy all referenced files</span>
        <span class="text-sm text-gray-02">
          Creates a complete, independent copy. All files referenced in the Kitfile (models, code, datasets) will be copied to the new location.
        </span>
      </button>
      <button
        class="flex flex-col items-start p-4 bg-elevation-03 border border-gray-03 text-left transition-all duration-200 hover:border-gold hover:bg-gold/5"
        @click="$emit('confirm', 'update-references')">
        <span class="font-semibold text-off-white mb-1">Keep references to original files</span>
        <span class="text-sm text-gray-02">
          Only duplicates the Kitfile. Paths will be updated to point to the original files. The duplicate will share assets with the original.
        </span>
      </button>
    </div>
    <div class="flex justify-end">
      <button
        class="button-secondary"
        @click="$emit('close')">
        Cancel
      </button>
    </div>
  </Modal>
</template>
