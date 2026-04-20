<script setup lang="ts">
const props = defineProps<{
  href: string,
  class?: string
}>()

function handleClick() {
  window.kitops.shell.openExternal(props.href)
}
</script>

<template>
  <button :class="props.class" @click="handleClick">
    <slot />
  </button>
</template>