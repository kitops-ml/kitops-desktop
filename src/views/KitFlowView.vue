<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { FlowSession } from '@/composables/useKitFlow'
import {
  clearSession,
  initUserVars,
  loadFlow,
  restoreFromSnapshot,
  snapshotSession,
  useKitFlow,
} from '@/composables/useKitFlow'
import { useShiki } from '@/composables/useShiki'
import IconChevron from '~icons/ri/arrow-down-s-line'
import IconCode from '~icons/ri/code-line'
import IconFile from '~icons/ri/file-text-line'
import IconFlow from '~icons/ri/git-merge-line'
import IconHome from '~icons/ri/home-4-line'
import IconPlay from '~icons/ri/play-line'
import IconReload from '~icons/ri/refresh-line'
import IconRefresh from '~icons/ri/reset-right-line'
import IconStop from '~icons/ri/stop-line'

import CopyButton from '../components/CopyButton.vue'
import KitFlowHome from '../components/kitflow/KitFlowHome.vue'
import KitFlowRunner from '../components/kitflow/KitFlowRunner.vue'

const {
  importedFlows, importFlow, removeFromLibrary,
  flow, rawContent, stepStates, userVars, expandedSteps, activePane,
  parseError, validationErrors, running,
  run, stop, reset,
} = useKitFlow()

const { highlightCode } = useShiki()

const openTabs = ref<string[]>([])
const activeTabPath = ref<string | null>(null)
const sessions = new Map<string, FlowSession>()

function saveCurrentSession() {
  const path = activeTabPath.value
  if (!path) {
    return
  }
  const snap = snapshotSession()
  if (snap) {
    sessions.set(path, snap)
  }
}

async function openFlow(flowPath: string): Promise<void> {
  if (running.value || activeTabPath.value === flowPath) {
    return
  }

  if (openTabs.value.includes(flowPath)) {
    saveCurrentSession()
    activeTabPath.value = flowPath
    const snap = sessions.get(flowPath)
    if (snap) {
      restoreFromSnapshot(snap)
    }
    return
  }

  saveCurrentSession()
  openTabs.value = [...openTabs.value, flowPath]
  activeTabPath.value = flowPath
  clearSession()
  await loadFlow(flowPath)
  initUserVars()
}

function closeTab(flowPath: string): void {
  if (running.value && activeTabPath.value === flowPath) {
    return
  }

  const idx = openTabs.value.indexOf(flowPath)
  if (idx === -1) {
    return
  }

  openTabs.value = openTabs.value.filter(p => p !== flowPath)
  sessions.delete(flowPath)

  if (activeTabPath.value === flowPath) {
    const newActive = openTabs.value[Math.min(idx, openTabs.value.length - 1)] ?? null
    activeTabPath.value = newActive
    if (newActive) {
      const snap = sessions.get(newActive)
      if (snap) {
        restoreFromSnapshot(snap)
      } else {
        clearSession()
      }
    } else {
      clearSession()
    }
  }
}

function goHome(): void {
  if (running.value) {
    return
  }
  saveCurrentSession()
  activeTabPath.value = null
}

async function reloadFlow(): Promise<void> {
  if (!activeTabPath.value || running.value) {
    return
  }
  const pane = activePane.value
  clearSession()
  await loadFlow(activeTabPath.value)
  initUserVars()
  if (validationErrors.value.length === 0) {
    activePane.value = pane
  }
}

async function handleImportFlow(): Promise<void> {
  const path = await importFlow()
  if (path) {
    await openFlow(path)
  }
}

function handleRemoveFlow(flowPath: string): void {
  removeFromLibrary(flowPath)
  closeTab(flowPath)
}

const filename = computed(() => {
  if (!activeTabPath.value) {
    return ''
  }
  return activeTabPath.value.split(/[/\\]/).pop() ?? ''
})

const filteredFlows = computed(() => {
  if (!selectorSearch.value) {
    return importedFlows.value
  }
  const q = selectorSearch.value.toLowerCase()
  return importedFlows.value.filter(f =>
    f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q),
  )
})

const hasStarted = computed(() => stepStates.value.some(s => s.status !== 'pending'))
const isFlowValid = computed(() => validationErrors.value.length === 0)

const canRun = computed(() => {
  if (!flow.value || running.value || !isFlowValid.value) {
    return false
  }
  return flow.value.varDefs
    .filter(v => v.default === undefined)
    .every(v => userVars.value[v.name]?.trim())
})

const highlightedYaml = computed(() =>
  rawContent.value ? highlightCode(rawContent.value, 'yaml') : '',
)

const errorLineSet = computed(() => new Set(validationErrors.value.map(e => e.line)))
const rawLines = computed(() => rawContent.value?.split('\n') ?? [])

const selectorOpen = ref(false)
const selectorSearch = ref('')

watch(stepStates, (states) => {
  const runningStep = states.find(s => s.status === 'running')
  if (runningStep) {
    expandedSteps.value = new Set([...expandedSteps.value, runningStep.index])
  }
}, { deep: true })

async function handleRun() {
  if (running.value) {
    stop()
    return
  }
  if (hasStarted.value) {
    reset()
  }
  await run(activeTabPath.value!)
  const failed = stepStates.value.find(s => s.status === 'error')
  if (failed) {
    expandedSteps.value = new Set([...expandedSteps.value, failed.index])
  }
}

function tabName(tabPath: string): string {
  return tabPath.split(/[/\\]/).pop() ?? tabPath
}

function tabLastRunResult(tabPath: string): 'success' | 'failed' | null {
  return importedFlows.value.find(f => f.path === tabPath)?.lastRunResult ?? null
}

onBeforeUnmount(() => {
  if (running.value) {
    stop()
  }
})
</script>

<template>
  <div class="flex flex-col h-full">
    <header class="px-8 bg-elevation-02 border-b border-gray-03 h-28 shrink-0">
      <div class="flex items-center justify-between h-full gap-4">
        <div class="min-w-0">
          <h1 class="text-xl font-bold text-off-white truncate">
            {{ activeTabPath && flow ? flow.name : 'KitFlow' }}
          </h1>
          <p
            v-if="activeTabPath && flow?.description"
            class="text-gray-02 text-xs truncate mt-0.5">
            {{ flow.description }}
          </p>
          <p v-else-if="!activeTabPath" class="text-gray-02 text-xs mt-0.5">
            Import and run YAML flow files
          </p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <div class="relative">
            <button
              class="button-secondary h-10"
              :class="{ 'border-gray-02 text-off-white': selectorOpen }"
              @click="selectorOpen = !selectorOpen">
              <IconFlow class="size-4" />
              <span>Select flow</span>
              <IconChevron
                class="size-4 transition-transform duration-150"
                :class="{ 'rotate-180': selectorOpen }" />
            </button>

            <div
              v-if="selectorOpen"
              class="fixed inset-0 z-40"
              @click="selectorOpen = false" />

            <div
              v-if="selectorOpen"
              class="absolute right-0 top-full mt-1 z-50 w-80 bg-elevation-02 border border-gray-03 shadow-xl">
              <div class="p-2 border-b border-gray-03">
                <input
                  v-model="selectorSearch"
                  placeholder="Search flows..."
                  class="w-full bg-elevation-01 border border-gray-03 px-3 py-1.5 text-sm text-off-white placeholder-gray-02 outline-none focus:border-gray-02"
                  @click.stop />
              </div>

              <div class="max-h-72 overflow-y-auto">
                <button
                  v-for="f in filteredFlows"
                  :key="f.path"
                  class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-elevation-03 transition-colors"
                  :class="{ 'bg-elevation-03': activeTabPath === f.path }"
                  @click="openFlow(f.path); selectorOpen = false; selectorSearch = ''">
                  <span
                    class="size-2 rounded-full shrink-0"
                    :class="{
                      'bg-success': f.lastRunResult === 'success',
                      'bg-error': f.lastRunResult === 'failed',
                      'bg-gray-03': !f.lastRunResult,
                    }" />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm text-off-white truncate">{{ f.name }}</p>
                    <p class="text-xs text-gray-02 truncate font-mono">{{ f.path }}</p>
                  </div>
                </button>

                <div
                  v-if="importedFlows.length === 0"
                  class="px-3 py-5 text-sm text-gray-02 text-center">
                  No flows imported yet
                </div>
                <div
                  v-else-if="filteredFlows.length === 0"
                  class="px-3 py-5 text-sm text-gray-02 text-center">
                  No flows match "{{ selectorSearch }}"
                </div>
              </div>
            </div>
          </div>

          <button
            class="button-secondary h-10"
            @click="handleImportFlow">
            <IconFile class="size-4" />
            Import
          </button>

          <button
            v-if="activeTabPath"
            class="button-secondary h-10"
            :disabled="running"
            title="Reload from disk"
            @click="reloadFlow">
            <IconReload class="size-4" />
          </button>

          <button
            v-if="activeTabPath && flow"
            class="button-submit flex items-center gap-2 text-sm h-10"
            :disabled="!running && !canRun"
            @click="handleRun">
            <Component
              :is="running
                ? IconStop
                : (
                  hasStarted
                    ? IconRefresh
                    : IconPlay
                )"
              class="size-4"></Component>
            <span>{{ running ? 'Stop' : hasStarted ? 'Run again' : 'Run' }}</span>
          </button>
        </div>
      </div>
    </header>

    <div
      v-if="openTabs.length > 0"
      class="flex overflow-x-auto border-b border-gray-03 bg-elevation-01 shrink-0">
      <button
        class="flow-tab shrink-0 border-r border-gray-03"
        :class="{ active: !activeTabPath }"
        title="Home"
        @click="goHome">
        <IconHome class="size-3.5" />
      </button>

      <button
        v-for="tabPath in openTabs"
        :key="tabPath"
        class="flow-tab group border-r border-gray-03"
        :class="{ active: activeTabPath === tabPath }"
        :title="tabPath"
        @click="openFlow(tabPath)">
        <span
          class="size-1.5 rounded-full shrink-0 transition-colors"
          :class="{
            'bg-gold animate-pulse': running && activeTabPath === tabPath,
            'bg-success': !running && tabLastRunResult(tabPath) === 'success',
            'bg-error': !running && tabLastRunResult(tabPath) === 'failed',
            'bg-gray-03': !running && !tabLastRunResult(tabPath),
          }" />
        <span class="max-w-36 truncate">{{ tabName(tabPath) }}</span>
        <span
          class="size-4 flex items-center justify-center text-xs text-gray-02 hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
          :class="{ 'pointer-events-none opacity-0!': running && activeTabPath === tabPath }"
          @click.stop="closeTab(tabPath)">
          ×
        </span>
      </button>
    </div>

    <KitFlowHome
      v-if="!activeTabPath"
      :open-flow="openFlow"
      :remove-flow="handleRemoveFlow" />

    <template v-else>
      <div v-if="parseError && !flow" class="flex-1 flex items-center justify-center p-12">
        <p class="text-error text-sm bg-error/10 border border-error/20 px-4 py-3 max-w-lg">
          {{ parseError }}
        </p>
      </div>

      <template v-else-if="flow">
        <div class="flex gap-1 p-1 bg-surface border-b border-gray-03 shrink-0">
          <button
            class="tab-button"
            :class="{ active: activePane === 'flow' }"
            :disabled="!isFlowValid"
            :title="!isFlowValid ? 'Fix validation errors before viewing the flow' : undefined"
            @click="activePane = 'flow'">
            <IconFlow class="size-4" />
            Flow
          </button>
          <button
            class="tab-button"
            :class="{ active: activePane === 'raw' }"
            @click="activePane = 'raw'">
            <IconCode class="size-4" />
            {{ filename }}
            <span v-if="!isFlowValid" class="text-error text-xs font-semibold">
              {{ validationErrors.length }} {{ validationErrors.length === 1 ? 'error' : 'errors' }}
            </span>
          </button>
        </div>

        <div v-if="activePane === 'raw'" class="flex-1 overflow-y-auto">
          <div class="flex justify-between items-center py-3 px-5 bg-elevation-03 border-b border-gray-03">
            <span class="text-sm text-gray-02 font-mono truncate">{{ activeTabPath }}</span>
            <CopyButton :content="rawContent ?? ''" />
          </div>

          <div
            v-if="!isFlowValid"
            class="border-b border-error/20 bg-error/5 px-5 py-3">
            <p class="text-xs font-semibold text-error uppercase tracking-wider mb-2">
              {{ validationErrors.length }} validation {{ validationErrors.length === 1 ? 'error' : 'errors' }}
            </p>
            <ul class="space-y-1">
              <li
                v-for="err in validationErrors"
                :key="`${err.line}-${err.message}`"
                class="flex gap-3 text-xs font-mono">
                <span class="shrink-0 text-error/60">line {{ err.line }}</span>
                <span class="text-error/90">{{ err.message }}</span>
              </li>
            </ul>
          </div>

          <div v-if="!isFlowValid" class="bg-elevation-01 overflow-x-auto">
            <div
              v-for="(line, i) in rawLines"
              :key="i"
              class="flex min-w-0"
              :class="errorLineSet.has(i + 1) ? 'bg-error/10 border-l-2 border-error' : 'border-l-2 border-transparent'">
              <span class="select-none w-10 shrink-0 text-right pr-4 py-px text-xs font-mono leading-5 text-gray-03">
                {{ i + 1 }}
              </span>
              <span
                class="font-mono text-sm whitespace-pre leading-5 py-px"
                :class="errorLineSet.has(i + 1) ? 'text-error/80' : 'text-off-white'">{{ line || '\u200b' }}</span>
            </div>
          </div>

          <template v-else>
            <div
              v-if="highlightedYaml"
              class="shiki-container bg-elevation-01"
              v-html="highlightedYaml" />
            <pre v-else class="p-5 bg-elevation-01 font-mono text-sm text-off-white leading-relaxed whitespace-pre">{{ rawContent }}</pre>
          </template>
        </div>

        <KitFlowRunner v-else />
      </template>
    </template>
  </div>
</template>

<style scoped>
@reference "../style.css";

:deep(.shiki) {
  @apply p-5;
}

.flow-tab {
  @apply flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap cursor-pointer transition-colors duration-150;
}

.flow-tab:not(.active) {
  @apply text-gray-01 hover:text-off-white hover:bg-elevation-02;
}

.flow-tab.active {
  @apply text-off-white bg-elevation-02;
}

.tab-button {
  @apply flex items-center gap-2 py-3 px-4 bg-transparent text-gray-01 font-medium text-sm whitespace-nowrap transition-all duration-200;
}

.tab-button:hover {
  @apply bg-elevation-03 text-off-white;
}

.tab-button.active {
  @apply bg-elevation-01 text-off-white shadow-sm;
}
</style>
