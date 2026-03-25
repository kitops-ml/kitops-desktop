<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'

import Modal from '../Modal.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    confirmLabel: string
    busyLabel?: string
    danger?: boolean
    disabled?: boolean
    maxWidth?: string
  }>(),
  { busy: false, danger: false, disabled: false, maxWidth: 'max-w-md', busyLabel: 'Please wait...' },
)

const emit = defineEmits<{ close: []; confirm: [] }>()

const isBusy = ref<boolean>(false)

const labelToDisplay = computed(() => {
  if (isBusy.value && props.busyLabel) {
    return props.busyLabel
  }
  return props.confirmLabel
})

function onConfirm() {
  if (isBusy.value) {
    return
  }

  isBusy.value = true
  emit('confirm')
}

watchEffect(() => {
  if (!props.open) {
    isBusy.value = false
  }
})
</script>

<template>
  <Modal
    :open="props.open"
    :class="props.maxWidth"
    @close="emit('close')">
    <h3 class="text-xl font-bold mb-2">{{ props.title }}</h3>
    <slot />
    <div class="flex justify-end gap-3">
      <button
        class="button-secondary"
        @click="emit('close')">
        Cancel
      </button>
      <button
        class="button-submit"
        :class="props.danger ? 'bg-error text-white hover:bg-error/80' : 'bg-gold text-bg-primary hover:bg-gold/90'"
        :disabled="isBusy || props.disabled"
        @click="onConfirm">
        {{ labelToDisplay }}
      </button>
    </div>
  </Modal>
</template>
