<script setup lang="ts">
import ConfirmModal from './ConfirmModal.vue'

defineProps<{ open: boolean }>()
defineEmits<{ close: []; confirm: [] }>()
</script>

<template>
  <ConfirmModal
    :open="open"
    title="Prune Untagged ModelKits"
    confirm-label="Prune"
    danger
    @close="$emit('close')"
    @confirm="$emit('confirm')">
    <p class="text-gray-01 mb-4">This will remove all untagged ModelKits from your local storage.</p>
    <p class="text-gray-02 text-sm mb-6">
      Untagged ModelKits are those that have been replaced by newer versions but still occupy storage space. This action cannot be undone.
    </p>
  </ConfirmModal>
</template>
