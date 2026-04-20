<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean
    maxWidth?: string
  }>(),
  { maxWidth: 'max-w-md' },
)

defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center"
      @click.self="$emit('close')">
      <div class="absolute inset-0 bg-black/70" @click="$emit('close')"></div>
      <div class="relative bg-surface border border-gray-03 p-6 w-full mx-4 shadow-xl" :class="maxWidth">
        <slot />
      </div>
    </div>
  </Teleport>
</template>
