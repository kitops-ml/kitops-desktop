<script setup lang="ts">
import { useKitFlow } from '@/composables/useKitFlow'
import type { KitFlowExample } from '@/constants/kitflow-examples'
import { KITFLOW_EXAMPLES } from '@/constants/kitflow-examples'
import { relativeTime } from '@/utils'
import IconFile from '~icons/ri/file-text-line'
import IconFlow from '~icons/ri/git-merge-line'

const props = defineProps<{
  openFlow: (path: string) => Promise<void>
  removeFlow: (path: string) => void
}>()

const { importedFlows, importFlow, addToLibrary } = useKitFlow()

async function openExample(ex: KitFlowExample) {
  const tempDir = await window.kitops.fs.getTempDir('kitflow-examples')
  await window.kitops.fs.mkdir(tempDir)
  const filePath = window.kitops.fs.pathJoin(tempDir, ex.filename)
  await window.kitops.fs.writeFile(filePath, ex.yaml)
  await addToLibrary(filePath, ex.name, ex.description)
  await props.openFlow(filePath)
}

async function handleImportFlow() {
  const path = await importFlow()
  if (path) {
    await props.openFlow(path)
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-10">
    <!-- Your flows -->
    <template v-if="importedFlows.length > 0">
      <h2 class="section-heading">Your Flows</h2>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 mb-12">
        <div
          v-for="f in importedFlows"
          :key="f.path"
          class="flow-card group">
          <div class="flex items-start justify-between mb-2 gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="size-2 rounded-full shrink-0"
                :class="{
                  'bg-success': f.lastRunResult === 'success',
                  'bg-error': f.lastRunResult === 'failed',
                  'bg-gray-03': !f.lastRunResult,
                }" />
              <span class="text-off-white font-medium text-sm truncate">{{ f.name }}</span>
            </div>
            <button
              class="text-xs text-gray-03 hover:text-error transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              @click="props.removeFlow(f.path)">
              Remove
            </button>
          </div>

          <p
            v-if="f.description"
            class="text-gray-02 text-xs mb-3 line-clamp-2 leading-relaxed">
            {{ f.description }}
          </p>
          <p v-else class="text-gray-03 text-xs mb-3 italic">No description</p>

          <div class="text-xs text-gray-02 space-y-0.5 mb-4">
            <div>Imported {{ relativeTime(f.importedAt) }}</div>
            <div v-if="f.lastRunAt" class="flex items-center gap-1">
              Last run {{ relativeTime(f.lastRunAt) }}
              <span :class="f.lastRunResult === 'success' ? 'text-success' : 'text-error'">
                · {{ f.lastRunResult === 'success' ? 'Success' : 'Failed' }}
              </span>
            </div>
            <div v-else class="text-gray-03">Never run</div>
          </div>

          <button
            class="button-secondary w-full justify-center mt-auto"
            @click="props.openFlow(f.path)">
            Open
          </button>
        </div>
      </div>
    </template>

    <!-- Empty state -->
    <div v-else class="flex flex-col items-center justify-center py-16 text-center mb-12">
      <div class="w-14 h-14 rounded-full bg-elevation-03 flex items-center justify-center mb-4">
        <IconFlow class="size-7 text-gray-02" />
      </div>
      <p class="text-off-white font-medium mb-1">No flows imported yet</p>
      <p class="text-gray-02 text-sm mb-6 max-w-xs">
        Import a YAML flow file or try one of the examples below
      </p>
      <button class="button-submit flex items-center gap-2" @click="handleImportFlow">
        <IconFile class="size-4" />
        Import flow
      </button>
    </div>

    <!-- Examples -->
    <div>
      <h2 class="section-heading">Examples</h2>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        <div v-for="ex in KITFLOW_EXAMPLES" :key="ex.name" class="flow-card">
          <p class="text-off-white font-medium text-sm mb-1">{{ ex.name }}</p>
          <p class="text-gray-02 text-xs mb-4 leading-relaxed">{{ ex.description }}</p>
          <button
            class="button-secondary w-full justify-center mt-auto"
            @click="openExample(ex)">
            Try example
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.section-heading {
  @apply text-xs uppercase tracking-widest text-gray-02 font-semibold mb-5;
}

.flow-card {
  @apply p-4 bg-elevation-03 border border-gray-03 flex flex-col transition-colors;
}

.flow-card:hover {
  @apply border-gray-02;
}
</style>
