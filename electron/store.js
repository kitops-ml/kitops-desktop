import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'

export function jsonStore(filename) {
  let filePath = null

  // Lazy — resolves only after Electron's app is ready
  function getPath() {
    if (!filePath) {
      filePath = path.join(app.getPath('userData'), filename)
    }
    return filePath
  }

  return {
    async load(fallback = []) {
      try {
        const data = await fs.readFile(getPath(), 'utf-8')
        return JSON.parse(data)
      } catch {
        return fallback
      }
    },

    async save(data) {
      await fs.writeFile(getPath(), JSON.stringify(data, null, 2), 'utf-8')
    },
  }
}

// Produces a short base36 string — not cryptographically unique, just collision-resistant enough for local IDs
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}
