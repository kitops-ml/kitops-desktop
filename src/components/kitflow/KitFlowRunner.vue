<script setup lang="ts">
import { computed } from 'vue'

import type { StepState } from '@/composables/useKitFlow'
import { useKitFlow } from '@/composables/useKitFlow'
import { formatDuration } from '@/utils'
import IconSpinner from '~icons/custom-icons/spinner'
import IconChevron from '~icons/ri/arrow-down-s-line'
import IconCheck from '~icons/ri/checkbox-circle-line'
import IconError from '~icons/ri/close-circle-line'
import IconSkip from '~icons/ri/subtract-line'
import IconPending from '~icons/ri/time-line'

import Input from '../ui/Input.vue'

const { flow, stepStates, userVars, expandedSteps, running, markDirty } = useKitFlow()

const hasStarted = computed(() => stepStates.value.some(s => s.status !== 'pending'))

const summary = computed(() => {
  const total = stepStates.value.length
  const done = stepStates.value.filter(s => s.status === 'success').length
  const errors = stepStates.value.filter(s => s.status === 'error').length
  return { total, done, errors }
})

function toggleStep(index: number) {
  if (expandedSteps.value.has(index)) {
    expandedSteps.value.delete(index)
  } else {
    expandedSteps.value.add(index)
  }
  expandedSteps.value = new Set(expandedSteps.value)
}

function dotClass(state: StepState): string {
  switch (state.status) {
    case 'success': return 'border-success bg-success/20 text-success'
    case 'error': return 'border-error bg-error/20 text-error'
    case 'running': return 'border-gold bg-gold/20 text-gold'
    case 'skipped': return 'border-gray-03 bg-elevation-03 text-gray-02'
    default: return 'border-gray-03 bg-elevation-02 text-gray-02'
  }
}

function commandBadgeClass(command: string): string {
  if (command.startsWith('kit.')) {
    return 'bg-gold/10 text-gold border-gold/20'
  }
  return 'bg-gray-03/40 text-gray-01 border-gray-03'
}

function commandLabel(command: string): string {
  return command.replace('kit.', 'kit ')
}
</script>

<template>
  <div class="flex flex-1 min-h-0">
    <!-- Variables panel -->
    <aside class="w-72 shrink-0 border-r border-gray-03 flex flex-col overflow-y-auto bg-elevation-02">
      <div class="p-5 border-b border-gray-03">
        <h2 class="text-xs text-gray-02 uppercase tracking-widest font-semibold">Variables</h2>
      </div>

      <div v-if="flow!.varDefs.length === 0" class="p-5 text-gray-02 text-sm">
        This flow has no variables.
      </div>
      <div v-else class="p-5 flex flex-col gap-5">
        <div v-for="varDef in flow!.varDefs" :key="varDef.name">
          <label class="flex items-center gap-1 mb-1.5">
            <span class="text-sm text-gray-01 font-medium font-mono">{{ varDef.name }}</span>
            <span
              v-if="varDef.default === undefined"
              class="text-error text-xs leading-none"
              title="Required">*</span>
          </label>
          <Input
            v-model="userVars[varDef.name]"
            :placeholder="varDef.default === undefined ? 'Required' : varDef.default"
            :disabled="running"
            class="font-mono text-sm"
            @input="markDirty(varDef.name)" />
        </div>
      </div>

      <!-- Run status summary -->
      <div v-if="hasStarted" class="mt-auto p-5 border-t border-gray-03">
        <div class="flex items-center gap-4 text-sm">
          <span class="text-gray-02">
            <span class="text-success font-mono">{{ summary.done }}</span>/{{ summary.total }} done
          </span>
          <span v-if="summary.errors > 0" class="text-error">
            {{ summary.errors }} failed
          </span>
          <span v-if="running" class="text-gold flex items-center gap-1">
            <IconSpinner class="size-3 animate-spin" />
            Running
          </span>
        </div>
      </div>
    </aside>

    <!-- Steps timeline -->
    <main class="flex-1 overflow-y-auto bg-elevation-02">
      <div class="p-5 border-b border-gray-03">
        <h2 class="text-xs text-gray-02 uppercase tracking-widest font-semibold">
          Steps
          <span class="text-gray-03 font-normal normal-case tracking-normal ml-1">({{ flow!.steps.length }})</span>
        </h2>
      </div>

      <div class="px-5 py-4">
        <div
          v-for="(state, i) in stepStates"
          :key="state.index"
          class="relative flex gap-4"
          :class="{ 'opacity-50': state.status === 'skipped' }">
          <!-- Timeline spine -->
          <div class="flex flex-col items-center shrink-0 w-6">
            <div
              class="size-6 mt-3 rounded-full border-2 flex items-center justify-center shrink-0 z-10 bg-elevation-02 transition-colors duration-200"
              :class="dotClass(state)">
              <IconSpinner v-if="state.status === 'running'" class="size-3 animate-spin" />
              <IconCheck v-else-if="state.status === 'success'" class="size-3" />
              <IconError v-else-if="state.status === 'error'" class="size-3" />
              <IconSkip v-else-if="state.status === 'skipped'" class="size-3" />
              <IconPending v-else class="size-3" />
            </div>
            <div
              v-if="i < stepStates.length - 1"
              class="w-0.5 flex-1 min-h-4 -mb-3 transition-colors duration-300"
              :class="state.status === 'success' ? 'bg-success/30' : 'bg-gray-03'" />
          </div>

          <!-- Step card -->
          <div class="flex-1 mb-3">
            <button
              class="w-full flex items-center gap-3 px-4 py-3 text-left bg-elevation-03 border border-gray-03 hover:border-gray-02 transition-colors"
              :class="{
                'border-success/40 bg-success/5': state.status === 'success',
                'border-error/40 bg-error/5': state.status === 'error',
                'border-gold/40 bg-gold/5': state.status === 'running',
              }"
              @click="toggleStep(state.index)">
              <span class="flex-1 text-sm text-off-white font-medium truncate">
                {{ state.name }}
              </span>
              <span
                class="shrink-0 text-xs font-mono px-2 py-0.5 border"
                :class="commandBadgeClass(state.command)">
                {{ commandLabel(state.command) }}
              </span>
              <span
                v-if="state.duration !== null"
                class="shrink-0 text-xs text-gray-02 font-mono w-12 text-right">
                {{ formatDuration(state.duration) }}
              </span>
              <span v-else class="shrink-0 w-12" />
              <IconChevron
                class="size-4 text-gray-02 shrink-0 transition-transform duration-200"
                :class="{ 'rotate-180': expandedSteps.has(state.index) }" />
            </button>

            <!-- Expanded output -->
            <div v-if="expandedSteps.has(state.index)" class="border border-t-0 border-gray-03 bg-elevation-01">
              <div v-if="state.status === 'running'" class="px-4 py-3 text-xs">
                <pre
                  v-if="state.output"
                  class="text-gray-01 font-mono whitespace-pre-wrap break-all mb-2 leading-relaxed">{{ state.output }}</pre>
                <div class="flex items-center gap-2 text-gold">
                  <IconSpinner class="size-3 animate-spin" />
                  Running…
                </div>
              </div>
              <template v-else>
                <pre
                  v-if="state.output"
                  class="text-xs text-gray-01 px-4 py-3 overflow-x-auto whitespace-pre-wrap break-all font-mono"
                  :class="{ 'border-b border-gray-03': state.error }">{{ state.output }}</pre>
                <pre
                  v-if="state.error"
                  class="text-xs text-error px-4 py-3 overflow-x-auto whitespace-pre-wrap break-all font-mono">{{ state.error }}</pre>
                <div v-if="!state.output && !state.error" class="px-4 py-3 text-xs text-gray-02 italic">
                  No output
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
