<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean
    class?: string,
    closeOnBackdropClick?: boolean
  }>(),
  { class: 'max-w-lg', closeOnBackdropClick: false },
)

const emit = defineEmits<{ close: [] }>()

function handleBackdropClick() {
  if (props.closeOnBackdropClick) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-backdrop">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center"
        @click.self="handleBackdropClick()">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/70" @click="handleBackdropClick()"></div>
        <!-- Modal Content -->
        <Transition name="modal-panel" appear>
          <div
            v-if="open"
            class="relative bg-surface border border-gray-03 p-6 w-full mx-4 shadow-xl"
            :class="props.class">
            <slot />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop-enter-active,
.modal-backdrop-leave-active {
  transition: opacity 0.2s ease;
}

.modal-backdrop-enter-from,
.modal-backdrop-leave-to {
  opacity: 0;
}

.modal-panel-enter-active {
  transition: opacity 0.2s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-panel-leave-active {
  transition: opacity 0.15s ease, transform 0.45s ease;
}

.modal-panel-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-16px);
}

.modal-panel-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(4px);
}
</style>
