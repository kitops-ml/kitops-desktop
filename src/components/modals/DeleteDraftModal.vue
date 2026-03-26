<script setup lang="ts">
import ConfirmModal from './ConfirmModal.vue'

defineProps<{
  open: boolean
  name: string
}>()

defineEmits<{ close: []; confirm: [] }>()
</script>

<template>
  <ConfirmModal
    :open="open"
    title="Delete Unpacked Kitfile"
    confirm-label="Delete"
    danger
    @close="$emit('close')"
    @confirm="$emit('confirm')">
    <p class="text-gray-01 mb-6">
      Are you sure you want to remove <span class="font-semibold text-off-white">"{{ name }}"</span>?
      This will only remove it from tracking, not delete the actual file.
    </p>
  </ConfirmModal>
</template>
