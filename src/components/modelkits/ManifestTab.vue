<script setup lang="ts">
import { computed } from 'vue'

import { useShiki } from '../../composables/useShiki'
import CopyButton from '../CopyButton.vue'

const props = defineProps<{
  yaml: string
}>()

const { highlightCode } = useShiki()

const html = computed(() => highlightCode(props.yaml, 'yaml'))
</script>

<template>
  <div class="animate-in fade-in duration-200 bg-surface border border-gray-03 overflow-hidden">
    <div class="flex justify-between items-center py-3 px-4 bg-elevation-03 border-b border-gray-03">
      <span class="text-sm font-semibold text-gray-01">ModelKit Manifest</span>
      <CopyButton :content="props.yaml" />
    </div>
    <div v-if="html" class="shiki-container m-0 p-5 bg-elevation-01" v-html="html"></div>
    <pre v-else class="m-0 p-5 bg-elevation-01"><code class="font-mono text-sm leading-relaxed text-off-white whitespace-pre">{{ props.yaml }}</code></pre>
  </div>
</template>
