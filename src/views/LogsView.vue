<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'

import IconChevronRight from '~icons/ri/arrow-right-s-line'

import Select from '../components/ui/Select.vue'
import { useLogStore } from '../stores/logStore'

interface LogEntry {
  id: number
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

const logStore = useLogStore()
const logsContainer = ref<HTMLElement | null>(null)
const filter = ref<'all' | 'command' | 'error'>('all')
const autoScroll = ref(true)
const expandedLogs = reactive(new Set<number>())

const filteredLogs = computed(() => {
  const logs = logStore.logs as LogEntry[]
  if (filter.value === 'command') {
    return logs.filter(log => log.type === 'command')
  }
  if (filter.value === 'error') {
    return logs.filter(log => log.level === 'error')
  }
  return logs
})

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour12: false,
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

function getArgPath(argsJson: string | undefined): string | null {
  if (!argsJson) {
    return null
  }
  try {
    const parsed = JSON.parse(argsJson)
    return typeof parsed?.path === 'string' ? parsed.path : null
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
    return !!(log.args && buildTableData(log.args))
  }
  return !!log.result
}

function toggleExpand(log: LogEntry) {
  if (!isExpandable(log)) {
    return
  }
  if (expandedLogs.has(log.id)) {
    expandedLogs.delete(log.id)
  } else {
    expandedLogs.add(log.id)
  }
}

function clearLogs() {
  logStore.clearLogs()
  expandedLogs.clear()
}

function scrollToBottom() {
  if (logsContainer.value && autoScroll.value) {
    nextTick(() => {
      logsContainer.value!.scrollTop = logsContainer.value!.scrollHeight
    })
  }
}

// Watch for new logs and scroll to bottom
watch(() => logStore.logs.length, scrollToBottom)
</script>

<template>
  <div class="flex flex-col h-full p-6 bg-elevation-01">
    <div class="flex justify-between items-center mb-5">
      <h1 class="text-2xl font-semibold text-off-white">Activity Logs</h1>
      <div class="flex gap-3">
        <Select v-model="filter">
          <option value="all">All Logs</option>
          <option value="command">Commands Only</option>
          <option value="error">Errors Only</option>
        </Select>
        <button class="button-secondary whitespace-nowrap" @click="clearLogs">Clear Logs</button>
      </div>
    </div>

    <div ref="logsContainer" class="flex-1 overflow-y-auto bg-elevation-02  border border-gray-03 font-mono text-[13px] p-3">
      <div v-if="filteredLogs.length === 0" class="flex items-center justify-center h-full text-gray-01">
        <p>No logs yet. Kit commands will appear here.</p>
      </div>

      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="flex flex-col mb-1 bg-elevation-03 transition-colors duration-200 hover:bg-elevation-04">
        <div
          class="flex items-center gap-3 p-2 px-3"
          :class="{
            'cursor-pointer': isExpandable(log),
            'bg-elevation-04': expandedLogs.has(log.id)
          }"
          @click="toggleExpand(log)">
          <span class="text-gray-02 shrink-0">{{ formatTime(log.timestamp) }}</span>
          <span
            class="py-0.5 px-1.5text-[10px] font-semibold uppercase shrink-0"
            :class="{
              'bg-info/20 text-blue-400': log.level === 'info',
              'bg-success/20 text-green-400': log.level === 'success',
              'bg-error/20 text-red-400': log.level === 'error',
              'bg-warning/20 text-yellow-400': log.level === 'warning'
            }">{{ log.level.toUpperCase() }}</span>
          <span v-if="log.command" class="text-amber-400 font-medium shrink-0">{{ log.command }}</span>
          <span class="text-off-white wrap-break-word" :class="{ 'text-red-400': log.level === 'error' }">{{ log.message }}</span>
          <span v-if="log.command && getArgPath(log.args)" class="text-gray-02 shrink-0 truncate max-w-xs flex-1">{{ getArgPath(log.args) }}</span>
          <span v-if="log.duration" class="text-gray-02 shrink-0 flex-1">{{ log.duration }}ms</span>
          <span v-if="isExpandable(log)" class="text-gray-02 text-[10px] shrink-0 ml-auto">
            <IconChevronRight :class="{ 'rotate-90 text-gold': expandedLogs.has(log.id) }" class="size-4" />
          </span>
        </div>
        <template v-if="log.status === 'started' && expandedLogs.has(log.id)">
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
        <div v-if="log.status !== 'started' && log.result && expandedLogs.has(log.id)" class="p-3 bg-black/30 border-l-3 border-amber-400 overflow-x-auto">
          <pre class="m-0 text-xs leading-relaxed text-off-white whitespace-pre-wrap wrap-break-word">{{ formatResult(log.result) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
