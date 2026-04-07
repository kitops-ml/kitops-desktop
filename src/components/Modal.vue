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
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center"
      @click.self="handleBackdropClick()">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/70" @click="handleBackdropClick()"></div>
      <!-- Modal Content -->
      <div class="relative bg-surface border border-gray-03 p-6 w-full mx-4 shadow-xl" :class="props.class">
        <slot />
      </div>
    </div>
  </Teleport>
</template>
