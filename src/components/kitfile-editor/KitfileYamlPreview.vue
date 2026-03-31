<script setup lang="ts">
import { computed } from 'vue'

import { useShiki } from '../../composables/useShiki'
import CopyButton from '../CopyButton.vue'

const props = defineProps<{ yaml: string }>()
const { highlightCode } = useShiki()
const yamlHtml = computed(() => highlightCode(props.yaml, 'yaml'))
</script>

<template>
  <div>
    <div class="flex justify-between items-center p-4 px-6 bg-surface border border-gray-03 border-b-0">
      <span class="font-semibold text-gray-01 text-sm">Kitfile</span>
      <CopyButton :content="yaml" />
    </div>
    <div
      v-if="yamlHtml"
      class="shiki-container m-0 p-6 bg-elevation-01 border border-gray-03 overflow-x-auto"
      v-html="yamlHtml" />
    <pre v-else class="m-0 p-6 bg-elevation-01 border border-gray-03 overflow-x-auto"><code class="font-mono text-sm leading-relaxed text-off-white">{{ yaml }}</code></pre>
  </div>
</template>

<style scoped>
.shiki-container :deep(.shiki) {
  background-color: transparent !important;
}

.shiki-container :deep(pre) {
  margin: 0;
  background: transparent;
}

.shiki-container :deep(code) {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.625;
}
</style>
