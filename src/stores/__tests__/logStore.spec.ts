import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useLogStore } from '../logStore'

describe('logStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no logs', () => {
    const store = useLogStore()
    expect(store.logs).toHaveLength(0)
  })

  it('logCommand adds a command-type entry', () => {
    const store = useLogStore()
    store.logCommand('list', [])
    expect(store.commandLogs).toHaveLength(1)
    expect(store.commandLogs[0].command).toBe('list')
    expect(store.commandLogs[0].status).toBe('started')
  })

  it('logCommandResult marks the command as completed', () => {
    const store = useLogStore()
    store.logCommandResult('list', [], 120)
    expect(store.commandLogs[0].status).toBe('completed')
    expect(store.commandLogs[0].duration).toBe(120)
  })

  it('logCommandError marks the command as failed', () => {
    const store = useLogStore()
    store.logCommandError('push', 'network error', 200)
    expect(store.errorLogs).toHaveLength(1)
    expect(store.errorLogs[0].status).toBe('failed')
    expect(store.errorLogs[0].message).toContain('network error')
  })

  it('logError adds an error-level entry', () => {
    const store = useLogStore()
    store.logError('something went wrong')
    expect(store.errorLogs).toHaveLength(1)
    expect(store.errorLogs[0].message).toBe('something went wrong')
  })

  it('logInfo adds an info-level entry', () => {
    const store = useLogStore()
    store.logInfo('initialized')
    expect(store.logs[0].level).toBe('info')
    expect(store.logs[0].message).toBe('initialized')
  })

  it('clearLogs empties the log list', () => {
    const store = useLogStore()
    store.logInfo('a')
    store.logInfo('b')
    store.clearLogs()
    expect(store.logs).toHaveLength(0)
  })

  it('trims logs to maxLogs when the limit is exceeded', () => {
    const store = useLogStore()
    for (let i = 0; i < 60; i++) {
      store.logInfo(`message ${i}`)
    }
    expect(store.logs.length).toBeLessThanOrEqual(50)
  })

  it('recentLogs reflects the current log list', () => {
    const store = useLogStore()
    store.logInfo('hello')
    expect(store.recentLogs).toHaveLength(1)
  })

  it('each log entry has an id and timestamp', () => {
    const store = useLogStore()
    store.logInfo('check')
    expect(store.logs[0].id).toBeDefined()
    expect(store.logs[0].timestamp).toBeDefined()
  })
})
