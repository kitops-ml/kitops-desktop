<script setup lang="ts">
import { ref, watch } from 'vue'

import { useNotification } from '../../composables/useNotification'
import { useFileExplorerStore } from '../../stores/fileExplorerStore'

const props = defineProps<{
  open: boolean
  repository: string
  sourceTag: string
  sourceDigest?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useFileExplorerStore()
const notification = useNotification()

const newTag = ref('')
const error = ref('')

// Reset form when dialog opens
watch(() => props.open, (val) => {
  if (val) {
    newTag.value = ''
    error.value = ''
  }
})

async function handleSave() {
  error.value = ''
  const tag = newTag.value.trim()

  if (!tag) {
    error.value = 'Tag name is required'
    return
  }

  if (!/^[\w][\w.\-/]*$/.test(tag)) {
    error.value = 'Tag can only contain letters, numbers, dots, hyphens and slashes'
    return
  }

  try {
    await store.saveAsNewTag(props.repository, props.sourceTag, props.sourceDigest, tag)
    notification.success(`Packed as ${props.repository}:${tag}`)
    emit('close')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Pack failed'
    error.value = msg
    notification.error(msg)
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        class="bg-elevation-02 border border-gray-03 w-full max-w-md p-6"
        @keydown.escape="handleClose">
        <h2 class="text-lg font-bold mb-1">Save as New Tag</h2>
        <p class="text-sm text-gray-01 mb-6">
          Pack the current contents of
          <span class="font-mono text-off-white">{{ repository }}:{{ sourceTag }}</span>
          into a new tag on the same repository.
        </p>

        <div class="mb-4">
          <div class="text-xs text-gray-02 uppercase tracking-widest mb-1.5">Repository</div>
          <div class="font-mono text-sm text-gray-01 px-3 py-2 bg-elevation-03 border border-gray-03">
            {{ repository }}
          </div>
        </div>

        <div class="mb-6">
          <label for="new-tag-input" class="block text-xs text-gray-02 uppercase tracking-widest mb-1.5">
            New Tag Name
          </label>
          <input
            id="new-tag-input"
            v-model="newTag"
            type="text"
            autofocus
            class="w-full font-mono text-sm bg-elevation-03 border px-3 py-2 text-off-white placeholder-gray-03 outline-none transition-colors"
            :class="error ? 'border-error' : 'border-gray-03 focus:border-gold'"
            placeholder="e.g. v2.0, latest, my-experiment"
            @keydown.enter="handleSave"
            @keydown.esc="handleClose" />
          <p v-if="error" class="mt-1.5 text-xs text-error">{{ error }}</p>
        </div>

        <div class="flex gap-3 justify-end">
          <button
            class="px-4 py-2 text-sm text-gray-01 hover:text-off-white border border-gray-03 hover:border-gray-02 transition-colors"
            :disabled="store.packing"
            @click="handleClose">
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm font-semibold bg-gold text-elevation-01 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="store.packing || !newTag.trim()"
            @click="handleSave">
            {{ store.packing ? 'Packing…' : 'Pack & Save' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
