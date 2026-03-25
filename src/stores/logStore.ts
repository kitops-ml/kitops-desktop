import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

type LogType = 'command' | 'info' | 'error'
type LogLevel = 'info' | 'success' | 'error'
type LogStatus = 'started' | 'completed' | 'failed'

type UserLog = {
  type: LogType,
  level: LogLevel,
  command?: string,
  args?: string[],
  duration?: number,
  status?: LogStatus,
  source?: string,
  result?: unknown,
  message: string,
}

type LogEntry = UserLog & {
  id: number,
  timestamp: string
}

export const useLogStore = defineStore('logs', () => {
  const logs = ref<LogEntry[]>([])
  const maxLogs = 50

  const recentLogs = computed(() => {
    return logs.value.slice(-100)
  })

  const commandLogs = computed(() => {
    return logs.value.filter(log => log.type === 'command')
  })

  const errorLogs = computed(() => {
    return logs.value.filter(log => log.level === 'error')
  })

  function addLog(log: UserLog) {
    const entry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      ...log,
    } as LogEntry
    logs.value.push(entry)

    // Keep logs under max limit
    if (logs.value.length > maxLogs) {
      logs.value = logs.value.slice(-maxLogs)
    }
  }

  function logCommand(command: string, args: string[] = [], status: LogStatus = 'started') {
    addLog({
      type: 'command',
      level: 'info',
      command,
      args,
      status,
      message: `kit ${command} ${args.join(' ')}`.trim(),
    } as UserLog)
  }

  function logCommandResult(command: string, result: unknown, duration: number) {
    addLog({
      type: 'command',
      level: 'success',
      command,
      status: 'completed',
      result: result ?? undefined,
      duration,
      message: `kit ${command} completed`,
    } as UserLog)
  }

  function logCommandError(command: string, error: string, duration: number) {
    addLog({
      type: 'command',
      level: 'error',
      command,
      status: 'failed',
      duration,
      message: `kit ${command} failed: ${error}`,
    } as UserLog)
  }

  function logInfo(message: string, details: Record<string, unknown> = {}) {
    addLog({
      type: 'info',
      level: 'info',
      message,
      ...details,
    } as UserLog)
  }

  function logError(message: string, details: Record<string, unknown> = {}) {
    addLog({
      type: 'error',
      level: 'error',
      message,
      ...details,
    } as UserLog)
  }

  function clearLogs() {
    logs.value = []
  }

  return {
    logs,
    recentLogs,
    commandLogs,
    errorLogs,
    addLog,
    logCommand,
    logCommandResult,
    logCommandError,
    logInfo,
    logError,
    clearLogs,
  }
})
