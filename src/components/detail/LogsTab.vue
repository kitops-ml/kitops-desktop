<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import IconChevronRight from '~icons/ri/arrow-right-s-line'

interface LogEntry {
  type: 'command' | 'info' | 'error'
  level: 'info' | 'success' | 'error' | 'warning'
  status?: 'started' | 'completed' | 'failed'
  message: string
  timestamp: string
  command?: string
  args?: string
  result?: unknown
  duration?: number
}

const props = defineProps<{
  digest: string
}>()

const logs = ref<LogEntry[]>([])
const loading = ref(false)
const expandedLogs = reactive(new Set<string>())

onMounted(async () => {
  if (!props.digest) {
    return
  }
  loading.value = true
  try {
    logs.value = await window.kitops.modelkitLogs.read(props.digest)
  } finally {
    loading.value = false
  }
})

function entryKey(log: LogEntry, index: number): string {
  return `${log.timestamp}-${index}`
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    hour12: false,
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

interface TableRow {
  key: string
  value: string
  depth: number
}

function buildTableData(argsJson: string | undefined): TableRow[] | null {
  if (!argsJson) {
    return null
  }
  try {
    const parsed = JSON.parse(argsJson)
    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
      return null
    }
    const rows: TableRow[] = []
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        rows.push({ key, value: '', depth: 0 })
        for (const [k, v] of Object.entries(val as object)) {
          rows.push({ key: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v), depth: 1 })
        }
      } else {
        rows.push({ key, value: typeof val === 'object' ? JSON.stringify(val) : String(val), depth: 0 })
      }
    }
    return rows.length > 0 ? rows : null
  } catch {
    return null
  }
}

function formatResult(result: unknown): string {
  if (result === undefined || result === null) {
    return ''
  }
  try {
    return JSON.stringify(result, null, 2)
  } catch {
    return String(result)
  }
}

function isExpandable(log: LogEntry): boolean {
  if (log.status === 'started') {
    return Boolean(log.args && buildTableData(log.args))
  }
  return Boolean(log.result)
}

function toggleExpand(log: LogEntry, index: number) {
  if (!isExpandable(log)) {
    return
  }
  const key = entryKey(log, index)
  if (expandedLogs.has(key)) {
    expandedLogs.delete(key)
  } else {
    expandedLogs.add(key)
  }
}
</script>

<template>
  <div class="animate-in fade-in duration-200">
    <div class="bg-elevation-02 border border-gray-03 font-mono text-[13px] p-3">
      <div v-if="loading" class="flex items-center justify-center py-12 text-gray-01">
        <p>Loading logs...</p>
      </div>

      <div v-else-if="logs.length === 0" class="flex items-center justify-center py-12 text-gray-01">
        <p>No logs yet. Operations like push, pull, tag, and unpack will be recorded here.</p>
      </div>

      <template v-else>
        <div
          v-for="(log, index) in logs"
          :key="entryKey(log, index)"
          class="flex flex-col mb-1 bg-elevation-03 transition-colors duration-200 hover:bg-elevation-04">
          <div
            class="flex items-center gap-3 p-2 px-3"
            :class="{
              'cursor-pointer': isExpandable(log),
              'bg-elevation-04': expandedLogs.has(entryKey(log, index))
            }"
            @click="toggleExpand(log, index)">
            <span class="text-gray-02 shrink-0">{{ formatTime(log.timestamp) }}</span>
            <span
              class="py-0.5 px-1.5 text-[10px] font-semibold uppercase shrink-0"
              :class="{
                'bg-info/20 text-blue-400': log.level === 'info',
                'bg-success/20 text-green-400': log.level === 'success',
                'bg-error/20 text-red-400': log.level === 'error',
                'bg-warning/20 text-yellow-400': log.level === 'warning'
              }">{{ log.level.toUpperCase() }}</span>
            <span v-if="log.command" class="text-amber-400 font-medium shrink-0">{{ log.command }}</span>
            <span class="text-off-white wrap-break-word" :class="{ 'text-red-400': log.level === 'error' }">{{ log.message }}</span>
            <span v-if="log.duration" class="text-gray-02 shrink-0 ml-auto">{{ log.duration }}ms</span>
            <span v-if="isExpandable(log)" class="text-gray-02 text-[10px] shrink-0" :class="{ 'ml-auto': !log.duration }">
              <IconChevronRight :class="{ 'rotate-90 text-gold': expandedLogs.has(entryKey(log, index)) }" class="size-4" />
            </span>
          </div>
          <template v-if="log.status === 'started' && expandedLogs.has(entryKey(log, index))">
            <template v-for="(tableData, i) in [buildTableData(log.args)]" :key="i">
              <div v-if="tableData">
                <table class="text-xs border-collapse bg-elevation-02">
                  <tbody>
                    <tr
                      v-for="row in tableData"
                      :key="`${row.depth}-${row.key}`"
                      class="border-b border-gray-03/20 last:border-0">
                      <td
                        class="px-2 py-1.5 text-gray-01 select-none whitespace-nowrap"
                        :class="{ 'pl-6': row.depth === 1 }">
                        {{ row.key }}
                      </td>
                      <td class="px-2 py-1.5 text-amber-200/80 align-top">
                        <div class="wrap-break-word">{{ row.value }}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </template>
          <div v-if="log.status !== 'started' && log.result && expandedLogs.has(entryKey(log, index))" class="p-3 bg-black/30 border-l-3 border-amber-400 overflow-x-auto">
            <pre class="m-0 text-xs leading-relaxed text-off-white whitespace-pre-wrap wrap-break-word">{{ formatResult(log.result) }}</pre>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
