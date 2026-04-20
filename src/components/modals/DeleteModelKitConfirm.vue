<script setup lang="ts">
import ConfirmModal from './ConfirmModal.vue'

defineProps<{
  open: boolean
  name?: string
  tag: string
}>()

const emit = defineEmits<{ close: []; confirm: [] }>()
</script>

<template>
  <ConfirmModal
    :open="open"
    title="Delete ModelKit"
    confirm-label="Delete"
    danger
    :long-press="500"
    @close="emit('close')"
    @confirm="emit('confirm')">
    <p class="text-gray-01 mb-4">
      Are you sure you want to delete
      <span class="font-semibold text-off-white">"{{ name }}:{{ tag }}"</span> from local storage?
    </p>
    <p class="text-gray-02 text-sm mb-6">
      This action cannot be undone. The ModelKit will be permanently removed from your local registry.
    </p>
  </ConfirmModal>
</template>
