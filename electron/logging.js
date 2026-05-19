import { appendLogEntry } from './ipc/modelkit-logs.js'

let mainWindow = null

export function setMainWindow(win) {
  mainWindow = win
}

function sendLog(log) {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('log', log)
  }
}

// Used by long-running IPC handlers (e.g. pull) to stream progress events to the renderer
export function sendProgress(eventName, data) {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send(eventName, data)
  }
}

export async function withLogging(commandName, args, fn, modelkitDigest) {
  const startTime = Date.now()
  const argsDisplay = args ? JSON.stringify(args) : ''

  const startedEntry = {
    type: 'command',
    level: 'info',
    command: commandName,
    args: argsDisplay,
    status: 'started',
    message: `kit ${commandName} ${argsDisplay.path ? argsDisplay.path : ''}`.trim(),
    timestamp: new Date().toISOString(),
  }
  sendLog(startedEntry)
  appendLogEntry(modelkitDigest, startedEntry)

  try {
    const result = await fn()
    const duration = Date.now() - startTime

    const completedEntry = {
      type: 'command',
      level: 'success',
      command: commandName,
      status: 'completed',
      duration,
      message: `kit ${commandName} completed`,
      result,
      timestamp: new Date().toISOString(),
    }
    sendLog(completedEntry)
    appendLogEntry(modelkitDigest, completedEntry)

    return result
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error
    }
    const duration = Date.now() - startTime
    const errorMessage = error.message || String(error)

    const failedEntry = {
      type: 'command',
      level: 'error',
      command: commandName,
      status: 'failed',
      duration,
      message: `kit ${commandName} failed: ${errorMessage}`,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }
    sendLog(failedEntry)
    appendLogEntry(modelkitDigest, failedEntry)

    throw error
  }
}
