<script setup lang="ts">
import { ref } from 'vue'

const open = ref(false)
</script>

<template>
  <div class="relative">
    <slot name="trigger" :toggle="() => (open = !open)" :open="open" />
    <div
      v-if="open"
      class="absolute right-0 top-full mt-1 z-50 min-w-36 bg-elevation-02 border border-gray-03 shadow-lg py-1"
      @mouseleave="open = false">
      <slot :close="() => (open = false)" />
    </div>
  </div>
</template>
