import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'

const TTL_DAYS = 7

function logsDir() {
  return path.join(app.getPath('userData'), 'modelkit-logs')
}

function sanitizeDigest(digest) {
  // sha256:abcdef... → sha256abcdef....json
  return digest.replace(/:/g, '')
}

function filePath(digest) {
  return path.join(logsDir(), `${sanitizeDigest(digest)}.json`)
}

export async function appendLogEntry(digest, entry) {
  if (!digest) {
    return
  }
  const dir = logsDir()
  await fs.mkdir(dir, { recursive: true })
  await fs.appendFile(filePath(digest), JSON.stringify(entry) + '\n', 'utf-8')
}

async function readLogFile(digest) {
  try {
    const content = await fs.readFile(filePath(digest), 'utf-8')
    const entries = []
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }
      try {
        entries.push(JSON.parse(trimmed))
      } catch {
        // skip malformed lines
      }
    }
    return entries
  } catch (err) {
    if (err.code === 'ENOENT') {
      return []
    }
    throw err
  }
}

export async function pruneOldLogs() {
  const dir = logsDir()
  let files
  try {
    files = await fs.readdir(dir)
  } catch {
    return 0
  }

  const cutoff = Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000
  let pruned = 0

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue
    }
    try {
      const stat = await fs.stat(path.join(dir, file))
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(path.join(dir, file))
        pruned++
      }
    } catch {
      // skip files we can't stat or delete
    }
  }

  return pruned
}

export function register(ipcMain) {
  ipcMain.handle('modelkitLogs:read', (e, digest) => readLogFile(digest))

  ipcMain.handle('modelkitLogs:prune', async () => {
    const pruned = await pruneOldLogs()
    return { pruned }
  })
}
