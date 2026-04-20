<script setup lang="ts">
import IconClose from '~icons/ri/close-line'

const props = defineProps<{
  open: boolean,
  closeOnBackdropClick?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function onBackdropClick() {
  if (props.closeOnBackdropClick) {
    emit('close')
  }
}
</script>

<template>
  <Transition name="backdrop">
    <div
      v-if="props.open"
      class="fixed inset-0 z-40 bg-black/50"
      @click="onBackdropClick" />
  </Transition>

  <Transition name="slide-right">
    <aside v-if="props.open" class="fixed right-0 top-0 z-50 flex flex-col h-screen w-72 bg-elevation-02 border-l border-gray-03 shadow-2xl">
      <header class="flex items-center justify-between px-5 py-4 border-b border-gray-03">
        <slot name="header" />
        <button
          class="p-1.5 text-gray-01 hover:text-off-white hover:bg-surface transition-all duration-150"
          @click="emit('close')">
          <IconClose class="size-4" />
        </button>
      </header>

      <slot></slot>
    </aside>
  </Transition>
</template>

<style scoped>
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}

.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.2s ease;
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}
</style>