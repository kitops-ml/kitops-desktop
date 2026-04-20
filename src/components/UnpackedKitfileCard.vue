<script setup lang="ts">
import { ref } from 'vue'

import IconSpinner from '~icons/custom-icons/spinner'
import IconModelKit from '~icons/ri/box-2-line'
import IconDelete from '~icons/ri/delete-bin-7-line'
import IconFile from '~icons/ri/file-line'

import type { UnpackedKitfile } from '../stores/unpackedKitfileStore'
import DeleteDraftModal from './modals/DeleteDraftConfirm.vue'

const props = defineProps<{
  kitfile: UnpackedKitfile
  packing?: boolean
}>()

const emit = defineEmits<{
  (event: 'pack', e: Event): void
  (event: 'remove', e: Event): void
}>()

const showDeleteConfirm = ref(false)
const pendingDeleteEvent = ref<Event | null>(null)

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function openDeleteConfirm(e: Event) {
  e.stopPropagation()
  e.preventDefault()
  pendingDeleteEvent.value = e
  showDeleteConfirm.value = true
}

function cancelDelete() {
  showDeleteConfirm.value = false
  pendingDeleteEvent.value = null
}

function confirmDelete() {
  if (pendingDeleteEvent.value) {
    emit('remove', pendingDeleteEvent.value)
  }
  showDeleteConfirm.value = false
  pendingDeleteEvent.value = null
}
</script>

<template>
  <div
    class="group bg-white/80 text-black p-6 transition-all duration-200 flex flex-col gap-4 hover:bg-white/90 hover:-translate-y-0.5 hover:shadow-md">
    <div class="flex items-start gap-3">
      <IconFile class="size-6 shrink-0 mt-1.5 group-hover:text-black/80" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <h3 class="text-lg font-bold truncate group-hover:text-black/80">{{ props.kitfile.name }}</h3>
        </div>
        <span class="inline-block py-1 px-2 bg-elevation-03 text-gray-01 text-xs font-mono mt-1">
          v{{ props.kitfile.version }}
        </span>
      </div>
    </div>

    <p class="group-hover:text-gray-01 text-sm line-clamp-2 flex-1">
      {{ props.kitfile.description }}
    </p>

    <div class="text-xs text-gray-02 font-mono truncate" :title="props.kitfile.path">
      {{ props.kitfile.directory }}
    </div>

    <div class="text-xs text-gray-02 border-b border-gray-03 pb-3">
      Updated {{ formatDate(props.kitfile.updatedAt) }}
    </div>

    <!-- Action buttons -->
    <div class="flex justify-end items-center gap-1">
      <button
        :disabled="props.packing"
        class="button-action text-black! group-hover:text-black! hover:bg-gray-300!"
        title="Pack into ModelKit"
        @click.stop.prevent="emit('pack', $event)">
        <IconSpinner v-if="props.packing" class="size-4 animate-spin" />
        <IconModelKit v-else class="size-4" />
        Pack
      </button>

      <button
        class="button-action-danger text-black! group-hover:text-red-500!"
        title="Remove from list"
        @click.stop.prevent="openDeleteConfirm">
        <IconDelete />
        Delete
      </button>
    </div>

    <DeleteDraftModal :open="showDeleteConfirm" :name="props.kitfile.name" @close="cancelDelete" @confirm="confirmDelete" />
  </div>
</template>
