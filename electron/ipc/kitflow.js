import { spawn } from 'child_process'
import { app } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// In production the CJS bundle is copied from extraResources into the install dir
// (next to the kit binary) by ensureKitflowWrapper() on startup.
// In dev the source ESM file is used directly (ELECTRON_RUN_AS_NODE handles ESM
// because the project root package.json has "type":"module").
function getKitflowScript() {
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'kitops', 'kitflow.cjs')
    : path.resolve(__dirname, '../../bin/kitflow.js')
}

let activeChild = null

export function register(ipcMain) {
  // Spawns the kitflow binary in --json mode with pre-supplied variable values,
  // then streams each JSON event back to the renderer via 'kitflow:event'.
  // Returns a promise that resolves when the flow finishes (exit 0) or rejects
  // on non-zero exit. Cancellation via kitflow:cancel also resolves the promise.
  ipcMain.handle('kitflow:run', (ipcEvent, filePath, vars) => {
    if (activeChild) {
      activeChild.kill()
      activeChild = null
    }

    const varFlags = Object.entries(vars).map(([k, v]) => `--${k}=${v}`)
    const spawnArgs = [getKitflowScript(), filePath, '--json', ...varFlags]

    // Run the script through Electron's own Node runtime.
    // ELECTRON_RUN_AS_NODE=1 makes the Electron binary behave as plain Node.js.
    activeChild = spawn(process.execPath, spawnArgs, {
      stdio: 'pipe',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    })

    let lineBuffer = ''

    activeChild.stdout.on('data', (chunk) => {
      lineBuffer += chunk.toString()
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          continue
        }
        try {
          const event = JSON.parse(trimmed)
          ipcEvent.sender.send('kitflow:event', event)
        } catch { /* non-JSON line — ignore */ }
      }
    })

    // Forward unexpected stderr as an error event so the UI can surface it.
    activeChild.stderr.on('data', (chunk) => {
      const text = chunk.toString().trim()
      if (text) {
        ipcEvent.sender.send('kitflow:event', { type: 'error', message: text })
      }
    })

    return new Promise((resolve, reject) => {
      activeChild.on('close', (code, signal) => {
        activeChild = null
        // SIGTERM / SIGKILL means we cancelled — treat as clean exit
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          return resolve()
        }
        if (code === 0) {
          return resolve()
        }
        reject(new Error(`kitflow exited with code ${code}`))
      })
      activeChild.on('error', (err) => {
        activeChild = null
        reject(err)
      })
    })
  })

  // Kills the running flow, if any. The kitflow:run promise will resolve cleanly.
  ipcMain.handle('kitflow:cancel', () => {
    if (activeChild) {
      activeChild.kill()
      activeChild = null
    }
  })
}
