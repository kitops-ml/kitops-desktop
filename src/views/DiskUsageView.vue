<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import IconChevronDown from '~icons/ri/arrow-down-s-line'
import IconTag from '~icons/ri/price-tag-3-line'

import { useKitStore } from '../stores/kitStore'
import { numberToSize, pluralize, sizeToNumber } from '../utils'

const kitStore = useKitStore()
const { modelKits } = storeToRefs(kitStore)

const expanded = ref<string[]>([])

const REPO_COLORS = [
  '#f97316',
  '#3b82f6',
  '#a855f7',
  '#22c55e',
  '#ec4899',
  '#14b8a6',
  '#eab308',
  '#ef4444',
  '#06b6d4',
  '#8b5cf6',
  '#f43f5e',
  '#10b981',
  '#f59e0b',
  '#6366f1',
  '#84cc16',
  '#0ea5e9',
  '#d946ef',
  '#64748b',
  '#2dd4bf',
  '#fb923c',
]

const repositoriesSummary = computed(() => {
  const repos: Record<string, number> = {}
  modelKits.value.forEach((kit) => {
    const repo = kit.repository || 'Unknown'
    repos[repo] = (repos[repo] ?? 0) + sizeToNumber(kit.size)
  })
  return Object.entries(repos)
    .sort((a, b) => b[1] - a[1])
    .map(([repo, size], i) => ({
      repo,
      size,
      color: REPO_COLORS[i % REPO_COLORS.length],
      count: modelKits.value.filter(k => (k.repository || 'Unknown') === repo).length,
    }))
})

function repositoryTags(repo: string) {
  return modelKits.value
    .filter((kit) => (kit.repository || 'Unknown') === repo)
    .map((kit) => ({ name: kit.tag, size: kit.size }))
    .sort((a, b) => sizeToNumber(b.size) - sizeToNumber(a.size))
}

function toggleExpanded(repo: string) {
  if (expanded.value.includes(repo)) {
    expanded.value = expanded.value.filter(r => r !== repo)
  } else {
    expanded.value = [...expanded.value, repo]
  }
}

function percent(size: number): string {
  return ((size / kitStore.totalSize) * 100).toFixed(1)
}

const repoCount = computed(() => repositoriesSummary.value.length)
const kitCount = computed(() => modelKits.value.length)
const untaggedCount = computed(() =>
  modelKits.value.filter(k => !k.tag || k.tag === '<none>').length,
)
</script>

<template>
  <div class="flex flex-col overflow-hidden">
    <header class="px-10 bg-elevation-02 border-b border-gray-03 h-28">
      <div class="flex justify-between items-center h-full">
        <div>
          <h1 class="text-3xl font-extrabold mb-1">Disk Usage</h1>
          <p class="text-gray-01 text-sm">
            {{ pluralize(repoCount, 'repository', 'repositories') }} &middot; {{ pluralize(kitCount, 'tag') }}
          </p>
        </div>
        <div class="flex items-center gap-6">
          <button
            v-if="untaggedCount > 0"
            class="text-xs text-gray-01 hover:text-white border border-gray-03 hover:border-gray-02 px-3 py-1.5 transition-colors"
            :disabled="kitStore.pruning"
            @click="kitStore.pruneUntaggedModelKits()">
            {{ kitStore.pruning ? 'Pruning…' : `Prune ${pluralize(untaggedCount, 'untagged modelkit')}` }}
          </button>
          <div class="text-right">
            <div class="text-2xl font-bold">{{ numberToSize(kitStore.totalSize) }}</div>
            <div class="text-xs text-gray-01 uppercase tracking-widest mt-0.5">total used</div>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 py-8 px-10 overflow-y-auto">
      <div class="max-w-4xl mx-auto">
        <div class="mb-10">
          <div class="flex h-4 bg-white/60 gap-px overflow-hidden rounded">
            <div
              v-for="{ repo, size, color } in repositoriesSummary"
              :key="repo"
              :title="`${repo} — ${numberToSize(size)} (${percent(size)}%)`"
              :style="{ width: percent(size) + '%', backgroundColor: color }"
              class="h-full transition-all duration-250 shrink-0 cursor-pointer hover:brightness-110"
              @click="toggleExpanded(repo)" />
          </div>
        </div>

        <div class="divide-y divide-gray-03/60">
          <div
            v-for="{ repo, size, color, count } in repositoriesSummary"
            :key="repo">
            <button
              class="w-full flex items-center gap-4 py-4 px-3 hover:bg-elevation-02 transition-colors text-left"
              @click="toggleExpanded(repo)">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: color }" />
              <span class="flex-1 font-semibold truncate">{{ repo }}</span>
              <span class="text-xs text-gray-02 tabular-nums px-1.5 py-0.5 bg-elevation-03 border border-gray-03/60 shrink-0">
                {{ pluralize(count, 'tag') }}
              </span>
              <div class="w-28 h-1.5 bg-elevation-03 overflow-hidden shrink-0 rounded-full">
                <div
                  class="h-full transition-all duration-500 rounded-full"
                  :style="{ width: percent(size) + '%', backgroundColor: color }" />
              </div>
              <span class="text-sm text-gray-01 w-10 text-right tabular-nums">{{ percent(size) }}%</span>
              <span class="text-sm font-mono text-gray-01 w-20 text-right tabular-nums whitespace-nowrap">{{ numberToSize(size) }}</span>
              <IconChevronDown
                class="size-4 text-gray-02 transition-transform duration-200 shrink-0"
                :class="{ 'rotate-180': expanded.includes(repo) }" />
            </button>

            <div v-if="expanded.includes(repo)" class="pb-4 pl-10 pr-11">
              <RouterLink
                v-for="tag in repositoryTags(repo)"
                :key="tag.name"
                :to="{
                  name: 'modelkit-detail',
                  params: { repository: repo, tag: tag.name }
                }"
                class="flex items-center gap-3 py-1.5 border-b border-gray-03/50 border-dashed last:border-0 group">
                <IconTag
                  class="size-3.5 shrink-0"
                  :class="tag.name === '<none>' ? 'text-gray-03' : 'text-gray-02 group-hover:text-gold'" />
                <span
                  class="flex-1 text-sm font-mono truncate"
                  :class="tag.name === '<none>' ? 'text-gray-02 italic' : 'text-gray-01 group-hover:text-gold'">
                  {{ tag.name || '<none>' }}
                </span>
                <span class="text-sm font-mono text-gray-02 tabular-nums w-20 text-right whitespace-nowrap group-hover:text-gold">{{ tag.size }}</span>
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
