<script setup lang="ts">
import type { DiffResult } from '@kitops/kitops-ts'
import { Layer } from '@kitops/kitops-ts'
import type { Change } from 'diff'
import { diffLines } from 'diff'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { stringify } from 'yaml'

import IconBack from '~icons/ri/arrow-left-line'
import IconTag from '~icons/ri/price-tag-3-line'

import { useKitStore } from '../stores/kitStore'

const route = useRoute()
const router = useRouter()
const kitStore = useKitStore()

const repository = route.params.repository as string
const tag = route.params.tag as string
const sourcePath = `${repository}:${tag}`

const search = ref('')
const customRef = ref('')
const selectedReference = ref('')
const sidebarOpen = ref(true)

type Tab = 'kitfile' | 'config' | 'annotations' | 'layers'
const activeTab = ref<Tab>('kitfile')

const sourceModelKit = computed(() => kitStore.modelKits.find(m => getModelKitRef(m) === sourcePath))

const selectedModelKit = computed(() => kitStore.modelKits.find(m => getModelKitRef(m) === selectedReference.value))

const diffResult = ref<DiffResult | null>(null)
const kitfileDiff = ref<Change[]>([])
const error = ref<string | null>(null)
const loading = ref(false)

const filteredModelKits = computed(() => {
  const q = search.value.toLowerCase().trim()
  return kitStore.modelKits
    .filter(modelkit => {
      const ref = getModelKitRef(modelkit)
      if (ref === sourcePath) {
        return false
      }
      if (!q) {
        return true
      }
      return (
        modelkit.name.toLowerCase().includes(q)
        || modelkit.repository.toLowerCase().includes(q)
        || modelkit.tag.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const aMatch = a.repository === repository
      const bMatch = b.repository === repository
      if (aMatch !== bMatch) {
        return aMatch ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
})

const tabs = computed(() => [
  { key: 'kitfile' as Tab, label: 'Kitfile', dot: hasDiff.value },
  { key: 'config' as Tab, label: 'Config', dot: diffResult.value?.configsDiffer ?? false },
  { key: 'annotations' as Tab, label: 'Annotations', dot: !(diffResult.value?.annotationsIdentical ?? true) },
  { key: 'layers' as Tab, label: 'Layers', dot: (diffResult.value?.uniqueToKit1.length ?? 0) > 0 || (diffResult.value?.uniqueToKit2.length ?? 0) > 0 },
])

function getModelKitRef(modelkit: { repository: string; tag: string }): string {
  const t = modelkit.tag && modelkit.tag !== '<none>' ? modelkit.tag : 'latest'
  return `${modelkit.repository}:${t}`
}

function parseRef(ref: string): { repository: string; tag: string } {
  const i = ref.lastIndexOf(':')
  if (i === -1) {
    return { repository: ref, tag: 'latest' }
  }
  return { repository: ref.slice(0, i), tag: ref.slice(i + 1) }
}

async function compare(comparedPath: string) {
  if (comparedPath === selectedReference.value && diffResult.value) {
    return
  }
  selectedReference.value = comparedPath
  customRef.value = ''
  loading.value = true
  error.value = null
  diffResult.value = null
  kitfileDiff.value = []

  try {
    const [layerDiff, kitfile1, kitfile2] = await Promise.all([
      kitStore.diffModelKits(sourcePath, comparedPath),
      window.kitops.kit.info(sourcePath),
      window.kitops.kit.info(comparedPath),
    ])

    diffResult.value = layerDiff
    kitfileDiff.value = diffLines(stringify(kitfile1), stringify(kitfile2))
    sidebarOpen.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function swap() {
  const { repository: newRepo, tag: newTag } = parseRef(selectedReference.value)
  router.push({
    name: 'compare',
    params: { repository: newRepo, tag: newTag },
    query: { with: sourcePath },
  })
}

onMounted(() => {
  const withRef = route.query.with as string | undefined
  if (withRef) {
    compare(withRef)
  }
})


type SplitCell = { text: string; lineNo: number; type: 'context' | 'removed' | 'added' } | null
type SplitRow = { left: SplitCell; right: SplitCell }

function toLines(value: string): string[] {
  const lines = value.split('\n')
  if (lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines
}

const splitRows = computed((): SplitRow[] => {
  const rows: SplitRow[] = []
  let no1 = 1
  let no2 = 1
  const changes = kitfileDiff.value

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]

    // If nothing was added or removed, just show the lines as unchanged content
    if (!change.added && !change.removed) {
      for (const text of toLines(change.value)) {
        rows.push({
          left: { text, lineNo: no1++, type: 'context' },
          right: { text, lineNo: no2++, type: 'context' },
        })
      }
    } else if (change.removed) {
      const removedLines = toLines(change.value)

      // if we have `removed` followed by `added`, we want to show them side by side as changed content,
      // instead of showing the removed content and then the added content separately.
      // So, we lookahead one change to see if it's an `added` change, and if so, we consume it in this iteration.
      const next = changes[i + 1]
      const addedLines = next?.added ? toLines(next.value) : []
      if (next?.added) {
        i++
      }

      // Iterate the longer block of changes so we dont miss any line.
      const max = Math.max(removedLines.length, addedLines.length)
      for (let j = 0; j < max; j++) {
        const l = removedLines[j]
        const r = addedLines[j]
        rows.push({
          left: l !== undefined ? { text: l, lineNo: no1++, type: 'removed' } : null,
          right: r !== undefined ? { text: r, lineNo: no2++, type: 'added' } : null,
        })
      }
    } else if (change.added) {
      // if there's an `added` change type, with no `remove` before it, then we're adding a new content,
      // so, the left content is `null`.
      for (const text of toLines(change.value)) {
        rows.push({ left: null, right: { text, lineNo: no2++, type: 'added' } })
      }
    }
  }

  return rows
})

const hasDiff = computed(() => kitfileDiff.value.some(c => c.added || c.removed))

function layerTypeColor(type: Layer) {
  const classMap: Record<Layer, string> = {
    model: 'text-layer-model',
    modelpart: 'text-layer-model',
    code: 'text-layer-code',
    dataset: 'text-layer-datasets',
    docs: 'text-layer-docs',
  }

  return classMap[type.toLowerCase()] || 'text-gray-01'
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <header class="px-10 bg-elevation-02 border-b border-gray-03 h-28 shrink-0">
      <div class="flex items-center gap-6 h-full">
        <button
          class="flex items-center gap-2 py-2 px-4 bg-transparent text-gray-01 font-semibold transition-all duration-200 hover:bg-surface hover:text-off-white shrink-0"
          @click="router.back()">
          <IconBack class="size-4.5" />
          Back
        </button>
        <div class="min-w-0">
          <h1 class="text-2xl font-extrabold leading-none mb-1">Compare</h1>
          <p class="font-mono text-sm truncate">
            <span class="text-gray-01">{{ sourcePath }}</span>
            <template v-if="selectedReference">
              <button
                class="text-gray-03 mx-2 hover:text-off-white transition-colors"
                title="Swap ModelKits"
                @click="swap">
                ↔
              </button>
              <span class="text-gold">{{ selectedReference }}</span>
            </template>
          </p>
        </div>
      </div>
    </header>

    <!-- Body: sidebar + main -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left sidebar: kit picker (collapsible) -->
      <aside
        class="shrink-0 border-r border-gray-03 flex flex-col overflow-hidden transition-[width] duration-300"
        :class="sidebarOpen ? 'w-72' : 'w-0'">
        <div class="p-4 border-b border-gray-03 shrink-0 flex items-center gap-2">
          <p class="text-xs font-semibold text-gray-02 uppercase tracking-wider flex-1">Compare against</p>
          <button
            class="p-1 text-gray-02 hover:text-off-white transition-colors"
            :class="{ 'opacity-0 pointer-events-none': !selectedModelKitName }"
            title="Collapse sidebar"
            @click="sidebarOpen = false">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>

        <div class="px-4 py-3 border-b border-gray-03 shrink-0">
          <input
            v-model="search"
            type="text"
            placeholder="Filter…"
            class="w-full py-2 px-3 bg-elevation-02 border border-gray-03 text-off-white placeholder-gray-02 text-sm focus:outline-none focus:border-gold" />
        </div>

        <div class="flex-1 overflow-auto">
          <div v-if="filteredModelKits.length === 0" class="px-4 py-6 text-sm text-gray-02 italic">
            No local ModelKits found
          </div>
          <div class="min-w-full w-max">
            <button
              v-for="modelkit in filteredModelKits"
              :key="getModelKitRef(modelkit)"
              type="button"
              class="w-full text-left px-4 py-3 flex flex-col gap-0.5 border-b border-gray-03 transition-colors hover:bg-elevation-03"
              :class="selectedReference === getModelKitRef(modelkit) ? 'bg-elevation-03 border-l-2 border-l-gold pl-3.5' : ''"
              @click="compare(getModelKitRef(modelkit))">
              <span class="text-xs font-semibold text-gray-02 whitespace-nowrap flex items-center gap-1">
                <IconTag class="size-3" />{{ modelkit.tag }}
              </span>
              <span class="text-sm font-semibold text-off-white whitespace-nowrap">{{ modelkit.name }}</span>
              <span class="text-xs font-mono text-gray-01 whitespace-nowrap">{{ getModelKitRef(modelkit) }}</span>
              <span class="text-xs text-gray-02">{{ modelkit.size }}</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main content -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <div v-if="loading" class="flex-1 flex items-center justify-center gap-3 text-gray-01">
          <div class="w-6 h-6 border-2 border-gray-03 border-t-gold animate-spin rounded-full"></div>
          <span>Comparing…</span>
        </div>

        <div v-else-if="error" class="flex-1 p-8">
          <div class="py-3 px-4 bg-error/10 border border-error text-error text-sm">{{ error }}</div>
        </div>

        <div v-else-if="!diffResult" class="flex-1 flex flex-col items-center justify-center gap-3 text-gray-02 select-none">
          <svg class="w-12 h-12 opacity-30" viewBox="0 0 24 24" fill="none">
            <path d="M18 20L22 16L18 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M2 16H22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <path d="M6 4L2 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M22 8H2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <p class="text-sm">Select a ModelKit from the sidebar to start comparing</p>
        </div>

        <template v-else>
          <!-- Tab bar -->
          <div class="shrink-0 flex items-center border-b border-gray-03 bg-elevation-02 px-2 gap-1">
            <button
              v-if="!sidebarOpen"
              class="p-2 mr-2 text-gray-02 hover:text-off-white transition-colors border-r border-gray-03 pr-3"
              title="Open sidebar"
              @click="sidebarOpen = true">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>

            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="relative px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px"
              :class="activeTab === tab.key
                ? 'text-off-white border-gold'
                : 'text-gray-02 border-transparent hover:text-gray-01'"
              @click="activeTab = tab.key">
              {{ tab.label }}
              <span v-if="tab.dot" class="absolute top-2 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
            </button>
          </div>

          <!-- Tab content -->
          <div class="flex-1 overflow-y-auto p-8">
            <!-- Kitfile tab -->
            <div v-if="activeTab === 'kitfile'">
              <div v-if="!hasDiff" class="py-4 px-4 border border-gray-03 bg-elevation-02 text-gray-01 text-sm italic">
                Kitfiles are identical
              </div>

              <div v-else class="border border-gray-03 font-mono text-xs">
                <div class="flex bg-elevation-02 border-b border-gray-03">
                  <div class="flex-1 min-w-0 flex border-r border-gray-03">
                    <div class="px-4 py-3 text-gray-01 font-sans text-sm min-w-0 flex-1">
                      <p class="text-xs font-semibold text-gray-02 uppercase tracking-wider mb-0.5">{{ sourceModelKit?.name ?? sourcePath }}</p>
                      <p class="flex items-center gap-1 text-xs my-1"><IconTag class="size-3" />{{ sourceModelKit?.tag ?? null }}</p>
                      <p class="font-mono text-off-white truncate text-left" style="direction: rtl;">{{ sourcePath }}</p>
                    </div>
                  </div>
                  <div class="flex-1 min-w-0 flex">
                    <div class="px-4 py-3 text-gold truncate font-sans text-sm min-w-0 flex-1">
                      <p class="text-xs font-semibold text-gray-02 uppercase tracking-wider mb-0.5">{{ selectedModelKit?.name ?? selectedReference }}</p>
                      <p class="flex items-center gap-1 text-xs my-1"><IconTag class="size-3" />{{ selectedModelKit?.tag ?? null }}</p>
                      <p class="font-mono text-gold truncate text-left" style="direction: rtl;">{{ selectedReference }}</p>
                    </div>
                  </div>
                </div>

                <div class="flex">
                  <!-- Left panel -->
                  <div class="flex-1 min-w-0 overflow-x-auto border-r border-gray-03">
                    <div class="w-max min-w-full">
                      <div
                        v-for="(row, i) in splitRows"
                        :key="i"
                        class="flex border-b border-gray-03/30 last:border-b-0">
                        <div
                          class="sticky left-0 z-10 w-12 shrink-0 px-2 py-1 text-right select-none border-r border-gray-03/40 text-gray-02"
                          :style="{ backgroundColor: row.left?.type === 'removed' ? 'color-mix(in srgb, var(--color-error) 15%, var(--color-elevation-02))' : 'var(--color-elevation-02)' }">
                          {{ row.left?.lineNo ?? '' }}
                        </div>
                        <div
                          class="px-3 py-1 whitespace-pre leading-relaxed flex-1"
                          :class="row.left?.type === 'removed' ? 'bg-error/8 text-error' : 'text-gray-01'">
                          <template v-if="row.left">{{ row.left.text }}</template>
                          <template v-else>&#160;</template>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Right panel -->
                  <div class="flex-1 min-w-0 overflow-x-auto">
                    <div class="w-max min-w-full">
                      <div
                        v-for="(row, i) in splitRows"
                        :key="i"
                        class="flex border-b border-gray-03/30 last:border-b-0">
                        <div
                          class="sticky left-0 z-10 w-12 shrink-0 px-2 py-1 text-right select-none border-r border-gray-03/40 text-gray-02"
                          :style="{ backgroundColor: row.right?.type === 'added' ? 'color-mix(in srgb, #4ade80 15%, var(--color-elevation-02))' : 'var(--color-elevation-02)' }">
                          {{ row.right?.lineNo ?? '' }}
                        </div>
                        <div
                          class="px-3 py-1 whitespace-pre leading-relaxed flex-1"
                          :class="row.right?.type === 'added' ? 'bg-green-400/8 text-green-400' : 'text-gray-01'">
                          <template v-if="row.right">{{ row.right.text }}</template>
                          <template v-else>&#160;</template>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Config tab -->
            <div v-else-if="activeTab === 'config'">
              <div
                v-if="!diffResult.configsDiffer"
                class="px-4 py-8 text-center text-gray-02 text-sm italic border border-gray-03">
                Config is identical.
              </div>

              <div v-else class="border border-gray-03 overflow-hidden">
                <div class="grid grid-cols-2 divide-x divide-gray-03">
                  <div class="px-4 py-3">
                    <p class="text-xs font-semibold text-gray-02 uppercase tracking-wider mb-0.5">{{ sourceModelKitName ?? sourcePath }}</p>
                    <p class="font-mono text-sm text-off-white truncate mb-3">{{ sourcePath }}</p>
                    <p class="text-xs text-gray-02 mb-1">Config digest</p>
                    <p class="font-mono text-xs text-gray-01 break-all">{{ diffResult.config1Digest ?? '—' }}</p>
                  </div>
                  <div class="px-4 py-3">
                    <p class="text-xs font-semibold text-gray-02 uppercase tracking-wider mb-0.5">{{ selectedModelKitName ?? selectedReference }}</p>
                    <p class="font-mono text-sm text-gold truncate mb-3">{{ selectedReference }}</p>
                    <p class="text-xs text-gray-02 mb-1">Config digest</p>
                    <p class="font-mono text-xs text-gray-01 break-all">{{ diffResult.config2Digest ?? '—' }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Annotations tab -->
            <div v-else-if="activeTab === 'annotations'">
              <div
                class="py-4 px-5 border text-sm"
                :class="!diffResult.annotationsIdentical
                  ? 'border-amber-500/50 bg-amber-500/5 text-amber-400'
                  : 'border-gray-03 bg-elevation-02 text-gray-01'">
                <p class="font-semibold text-off-white">Annotations {{ diffResult.annotationsIdentical ? 'are identical' : 'differ' }}</p>
              </div>
            </div>

            <!-- Layers tab -->
            <div v-else-if="activeTab === 'layers'">
              <div
                v-if="diffResult.uniqueToKit1.length === 0 && diffResult.uniqueToKit2.length === 0"
                class="px-4 py-8 text-center text-gray-02 text-sm italic border border-gray-03">
                No layer differences — ModelKits share all layers.
              </div>

              <div v-else class="border border-gray-03 overflow-hidden">
                <div class="grid grid-cols-2 divide-x divide-gray-03">
                  <div>
                    <div class="px-4 py-3 bg-elevation-02 border-b border-gray-03">
                      <p class="text-xs font-semibold text-gray-02 uppercase tracking-wider mb-0.5">{{ sourceModelKitName ?? sourcePath }}</p>
                      <p class="font-mono text-sm text-off-white truncate">{{ sourcePath }}</p>
                    </div>
                    <div v-if="diffResult.uniqueToKit1.length === 0" class="px-4 py-6 text-sm text-gray-02 italic">No unique layers</div>
                    <div
                      v-for="(layer, i) in diffResult.uniqueToKit1"
                      :key="i"
                      class="px-4 py-3 border-b border-gray-03 last:border-b-0 flex items-center gap-3">
                      <div class="min-w-0 flex-1">
                        <span :class="layerTypeColor(layer.type)" class="text-xs font-semibold">{{ layer.type }}</span>
                        <p class="font-mono text-xs text-gray-01 truncate">{{ layer.digest }}</p>
                      </div>
                      <span class="text-xs text-gray-02 shrink-0">{{ layer.size }}</span>
                    </div>
                  </div>

                  <div>
                    <div class="px-4 py-3 bg-elevation-02 border-b border-gray-03">
                      <p class="text-xs font-semibold text-gray-02 uppercase tracking-wider mb-0.5">{{ selectedModelKitName ?? selectedReference }}</p>
                      <p class="font-mono text-sm text-gold truncate">{{ selectedReference }}</p>
                    </div>
                    <div v-if="diffResult.uniqueToKit2.length === 0" class="px-4 py-6 text-sm text-gray-02 italic">No unique layers</div>
                    <div
                      v-for="(layer, i) in diffResult.uniqueToKit2"
                      :key="i"
                      class="px-4 py-3 border-b border-gray-03 last:border-b-0 flex items-center gap-3">
                      <div class="min-w-0 flex-1">
                        <span :class="layerTypeColor(layer.type)" class="text-xs font-semibold">{{ layer.type }}</span>
                        <p class="font-mono text-xs text-gray-01 truncate">{{ layer.digest }}</p>
                      </div>
                      <span class="text-xs text-gray-02 shrink-0">{{ layer.size }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="diffResult.sharedLayers.length > 0" class="mt-4 border border-gray-03 overflow-hidden">
                <div class="px-4 py-2 bg-elevation-01 border-b border-gray-03">
                  <span class="text-xs font-semibold text-gray-02 uppercase tracking-wider">Shared ({{ diffResult.sharedLayers.length }})</span>
                </div>
                <div
                  v-for="(layer, i) in diffResult.sharedLayers"
                  :key="i"
                  class="px-4 py-3 border-b border-gray-03 last:border-b-0 flex items-center gap-3">
                  <div class="min-w-0 flex-1">
                    <span :class="layerTypeColor(layer.type)" class="text-xs font-semibold">{{ layer.type }}</span>
                    <p class="font-mono text-xs text-gray-01 truncate">{{ layer.digest }}</p>
                  </div>
                  <span class="text-xs text-gray-02 shrink-0">{{ layer.size }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
