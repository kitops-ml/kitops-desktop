import { ref } from 'vue'

import { useLogStore } from '../stores/logStore'

export type NotificationType = 'success' | 'error' | 'info' | 'warning'

export interface Notification {
  id: number
  type: NotificationType
  message: string
}

let nextId = 0
const notifications = ref<Notification[]>([])

export function useNotification() {
  const logStore = useLogStore()

  function add(type: NotificationType, message: string, duration = 4000, logInfo?: Record<string, unknown>) {
    const shouldLog = logInfo && Object.keys(logInfo).length > 0

    if (shouldLog) {
      logStore.logError(message, {
        source: 'Notification',
        message,
        ...logInfo,
      })
    }
    const id = nextId++
    notifications.value.push({ id, type, message })
    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
  }

  function remove(id: number) {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
  }

  return {
    notifications,
    success: (msg: string, logInfo?: Record<string, unknown>, duration?: number) => add('success', msg, duration, logInfo),
    error: (msg: string, logInfo?: Record<string, unknown>, duration?: number) => add('error', msg, duration, logInfo),
    info: (msg: string, logInfo?: Record<string, unknown>, duration?: number) => add('info', msg, duration, logInfo),
    warning: (msg: string, logInfo?: Record<string, unknown>, duration?: number) => add('warning', msg, duration, logInfo),
    remove,
  }
}
