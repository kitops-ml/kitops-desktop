import type { Layer } from '@kitops/kitops-ts'

import { useLogStore } from '../stores/logStore'
import { useSettingsStore } from '../stores/settingsStore'
import { sanitizePath } from '../utils'

const TTL = 5 * 60 * 1000 // 5 minutes

type CacheEntry = {
  unpackedAt: number,
  task?: Promise<string>
}

const cache = new Map<string, CacheEntry>()

export function useUnpackCache() {
  const settingsStore = useSettingsStore()
  const logStore = useLogStore()

  function getUnpackDir(repository: string, tag: string): string {
    const tempDir = settingsStore.getEffectiveTempDir()
    if (!tempDir) {
      throw new Error('Temp directory is not initialized yet')
    }
    const sanitizedRepo = sanitizePath(repository)
    const sanitizedTag = sanitizePath(tag)
    return window.kitops.fs.pathJoin(tempDir, 'kitops-desktop', `${sanitizedRepo}_${sanitizedTag}`)
  }

  async function unpackRepository(repository: string, tag: string, layer: Layer): Promise<string> {
    const key = `${repository}:${tag}:${layer}`
    const dir = getUnpackDir(repository, tag)
    const entry = cache.get(key)

    // If there's a job attached, don't override it
    if (entry?.task) {
      return entry.task
    }

    if (entry && Date.now() - entry.unpackedAt < TTL) {
      return dir
    }

    const task = window.kitops.kit
      .unpack(`${repository}:${tag}`, { dir, filter: layer, overwrite: true })
      .then(() => {
        cache.set(key, { unpackedAt: Date.now() })
        logStore.logInfo(`Unpacked and cached ModelKit ${repository}:${tag} (layer: ${layer})`)
        return dir
      })
      .catch((err) => {
        cache.delete(key)
        throw err
      })

    cache.set(key, { unpackedAt: 0, task })
    return task
  }

  async function getFileContent(
    repository: string,
    tag: string,
    filePath: string,
    layer: Layer,
  ): Promise<string | null> {
    const dir = await unpackRepository(repository, tag, layer)
    const fullPath = window.kitops.fs.pathJoin(dir, filePath.replace(/^\.\//, ''))

    if (!await window.kitops.fs.fileExists(fullPath)) {
      return null
    }

    const result = await window.kitops.fs.readFile(fullPath)
    return result.success ? result.content : null
  }

  return { unpackRepository, getFileContent, getUnpackDir }
}
