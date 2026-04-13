<script setup lang="ts">
import { onLongPress, useEventListener } from '@vueuse/core'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

const confirmButtonRef = useTemplateRef('confirmButton')

import Modal from '../Modal.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    confirmLabel: string
    busyLabel?: string
    danger?: boolean
    disabled?: boolean
    maxWidth?: string,
    longPress?: boolean | number
  }>(),
  {
    busy: false,
    danger: false,
    disabled: false,
    maxWidth: 'max-w-md',
    busyLabel: 'Please wait...',
    longPress: false,
  },
)

const emit = defineEmits<{ close: []; confirm: [] }>()

const DEFAULT_LONGPRESS_DURATION = 2000
const LONGPRESS_DURATION = typeof props.longPress === 'number' && props.longPress > 0
  ? props.longPress
  : DEFAULT_LONGPRESS_DURATION

const isBusy = ref<boolean>(false)

const isPressing = ref<boolean>(false)

useEventListener(document, 'mouseup', () => {
  isPressing.value = isBusy.value
})

onLongPress(
  confirmButtonRef,
  () => { },
  {
    delay: LONGPRESS_DURATION,
    onMouseUp(duration, distance, isLongPress) {
      isPressing.value = false

      if (props.longPress && !isLongPress) {
        return
      }

      if (isBusy.value || props.disabled) {
        return
      }

      isBusy.value = true
      emit('confirm')
    },
  },
)

const labelToDisplay = computed(() => {
  if (isBusy.value && props.busyLabel) {
    return props.busyLabel
  }
  return props.confirmLabel
})

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
      <div class="relative">
        <button
          ref="confirmButton"
          class="button-submit"
          :class="props.danger ? 'bg-error text-white hover:bg-error/80' : 'bg-gold text-bg-primary hover:bg-gold/90'"
          :disabled="isBusy || props.disabled"
          @mousedown="isPressing = true">
          {{ labelToDisplay }}
        </button>
        <div
          class="bg-red-950/40 w-0 absolute left-0 inset-y-0 pointer-events-none"
          :class="{
            'transition-[width] ease-linear w-full': isPressing,
            'transition-none w-0': !isPressing,
            'opacity-0': !props.longPress
          }"
          :style="`transition-duration: ${LONGPRESS_DURATION}ms`"></div>
      </div>
    </div>
  </Modal>
</template>
