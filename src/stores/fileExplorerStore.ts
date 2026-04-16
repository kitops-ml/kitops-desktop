import type { ModelKit } from '@kitops/kitops-ts'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { sanitizePath } from '../utils'
import { useKitStore } from './kitStore'
import { useLogStore } from './logStore'
import { useSettingsStore } from './settingsStore'

export interface FileNode {
  name: string
  isDirectory: boolean
  /** Relative path from the unpack root, e.g. "models/weights.bin" */
  relativePath: string
  /** Absolute path on disk */
  fullPath: string
}

export interface SelectedFile {
  repository: string
  tag: string
  node: FileNode
}

export const useFileExplorerStore = defineStore('fileExplorer', () => {
  const kitStore = useKitStore()
  const settingsStore = useSettingsStore()
  const logStore = useLogStore()

  /** Node keys that are currently expanded */
  const expandedNodes = ref<Set<string>>(new Set())
  /** Node keys that are currently loading (unpack or dir listing) */
  const loadingNodes = ref<Set<string>>(new Set())
  /** Maps tag key → absolute path of its unpacked directory */
  const unpackedDirs = ref<Map<string, string>>(new Map())
  /** Maps node key → loaded FileNode children */
  const nodeChildren = ref<Map<string, FileNode[]>>(new Map())
  /** The file currently selected for preview */
  const selectedFile = ref<SelectedFile | null>(null)
  /** Cached text content keyed by absolute path */
  const fileContents = ref<Map<string, string>>(new Map())
  /** True while a pack operation is running */
  const packing = ref(false)

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const repositoryGroups = computed(() => {
    const groups: Record<string, ModelKit[]> = {}
    for (const kit of kitStore.modelKits) {
      const repo = kit.repository || 'Unknown'
      if (!groups[repo]) {
        groups[repo] = []
      }
      groups[repo].push(kit)
    }
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([repository, kits]) => ({
        repository,
        kits: [...kits].sort((a, b) => (a.tag || '').localeCompare(b.tag || '')),
      }))
  })

  // ---------------------------------------------------------------------------
  // Key helpers
  // ---------------------------------------------------------------------------

  function repoKey(repository: string) {
    return `repo:${repository}`
  }

  /** For untagged kits (tag === '<none>'), the key uses the digest so each is unique. */
  function tagKey(repository: string, tag: string, digest?: string) {
    if (!tag || tag === '<none>') {
      return `tag:${repository}@${digest}`
    }
    return `tag:${repository}:${tag}`
  }

  function nodeKey(repository: string, tag: string, relativePath: string, digest?: string) {
    return `${tagKey(repository, tag, digest)}:${relativePath}`
  }

  /** Returns the kit reference string suitable for `kit unpack`. */
  function kitRef(repository: string, tag: string, digest?: string) {
    if (!tag || tag === '<none>') {
      return `${repository}@${digest}`
    }
    return `${repository}:${tag}`
  }

  // ---------------------------------------------------------------------------
  // State checkers
  // ---------------------------------------------------------------------------

  function isExpanded(key: string) {
    return expandedNodes.value.has(key)
  }

  function isLoading(key: string) {
    return loadingNodes.value.has(key)
  }

  // ---------------------------------------------------------------------------
  // Temp-directory helpers
  // ---------------------------------------------------------------------------

  function getTempBaseDir() {
    const tempDir = settingsStore.getEffectiveTempDir()
    if (!tempDir) {
      throw new Error('Temp directory is not initialized')
    }
    return window.kitops.fs.pathJoin(tempDir, 'kitops-desktop')
  }

  function getUnpackDir(repository: string, tag: string, digest?: string) {
    const safeSuffix = !tag || tag === '<none>'
      ? sanitizePath(digest ?? 'untagged')
      : sanitizePath(tag)
    return window.kitops.fs.pathJoin(
      getTempBaseDir(),
      `explorer_${sanitizePath(repository)}_${safeSuffix}`,
    )
  }

  // ---------------------------------------------------------------------------
  // Unpack management
  // ---------------------------------------------------------------------------

  async function ensureUnpacked(repository: string, tag: string, digest?: string): Promise<string> {
    const key = tagKey(repository, tag, digest)
    const cached = unpackedDirs.value.get(key)
    if (cached) {
      return cached
    }

    const dir = getUnpackDir(repository, tag, digest)
    const ref = kitRef(repository, tag, digest)
    await window.kitops.kit.unpack(ref, { dir, overwrite: true })
    unpackedDirs.value.set(key, dir)
    return dir
  }

  // ---------------------------------------------------------------------------
  // Directory listing
  // ---------------------------------------------------------------------------

  async function listDir(dirPath: string, parentRelPath: string): Promise<FileNode[]> {
    const result = await window.kitops.fs.listDir(dirPath)
    if (!result.success) {
      return []
    }

    return result.files
      .filter(f => !f.name.startsWith('.'))
      .sort((a, b) => {
        // Directories first, then alphabetical
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
      .map(f => ({
        name: f.name,
        isDirectory: f.isDirectory,
        relativePath: parentRelPath ? `${parentRelPath}/${f.name}` : f.name,
        fullPath: window.kitops.fs.pathJoin(dirPath, f.name),
      }))
  }

  // ---------------------------------------------------------------------------
  // Toggle actions
  // ---------------------------------------------------------------------------

  function toggleRepo(repository: string) {
    const key = repoKey(repository)
    if (expandedNodes.value.has(key)) {
      expandedNodes.value.delete(key)
    } else {
      expandedNodes.value.add(key)
    }
  }

  async function toggleTag(repository: string, tag: string, digest?: string) {
    const key = tagKey(repository, tag, digest)

    if (expandedNodes.value.has(key)) {
      expandedNodes.value.delete(key)
      return
    }

    loadingNodes.value.add(key)
    try {
      const dir = await ensureUnpacked(repository, tag, digest)
      const children = await listDir(dir, '')
      nodeChildren.value.set(key, children)
      expandedNodes.value.add(key)
    } catch (err) {
      logStore.logError(`Failed to expand ${kitRef(repository, tag, digest)}`, err)
    } finally {
      loadingNodes.value.delete(key)
    }
  }

  async function toggleFolder(repository: string, tag: string, node: FileNode, digest?: string) {
    const key = nodeKey(repository, tag, node.relativePath, digest)

    if (expandedNodes.value.has(key)) {
      expandedNodes.value.delete(key)
      return
    }

    if (!nodeChildren.value.has(key)) {
      loadingNodes.value.add(key)
      try {
        const children = await listDir(node.fullPath, node.relativePath)
        nodeChildren.value.set(key, children)
      } catch (err) {
        logStore.logError(`Failed to load directory: ${node.relativePath}`, err)
      } finally {
        loadingNodes.value.delete(key)
      }
    }
    expandedNodes.value.add(key)
  }

  function getChildren(key: string): FileNode[] {
    return nodeChildren.value.get(key) ?? []
  }

  // ---------------------------------------------------------------------------
  // File selection & preview
  // ---------------------------------------------------------------------------

  async function selectFile(repository: string, tag: string, node: FileNode) {
    selectedFile.value = { repository, tag, node }
    if (!fileContents.value.has(node.fullPath)) {
      const result = await window.kitops.fs.readFile(node.fullPath)
      if (result.success) {
        fileContents.value.set(node.fullPath, result.content)
      }
    }
  }

  function getFileContent(fullPath: string): string | null {
    return fileContents.value.get(fullPath) ?? null
  }

  // ---------------------------------------------------------------------------
  // System app
  // ---------------------------------------------------------------------------

  async function openWithSystemApp(fullPath: string) {
    await window.kitops.shell.openExternal(`file://${fullPath}`)
  }

  // ---------------------------------------------------------------------------
  // Add files / folders
  // ---------------------------------------------------------------------------

  /**
   * Opens a file/folder picker and copies the selection into the unpacked dir.
   * If `targetNode` is given, copies into that directory; otherwise copies to root.
   * Refreshes the parent node's children after the copy.
   */
  async function addFiles(
    repository: string,
    tag: string,
    digest: string | undefined,
    targetNode: FileNode | null = null,
  ): Promise<boolean> {
    const tKey = tagKey(repository, tag, digest)
    const unpackDir = unpackedDirs.value.get(tKey)
    if (!unpackDir) {
      return false
    }

    const result = await window.kitops.dialog.selectPath({ title: 'Add Files or Folders', multiple: true })
    if (!result.success) {
      return false
    }

    const targetDir = targetNode
      ? window.kitops.fs.pathJoin(unpackDir, targetNode.relativePath)
      : unpackDir

    const paths: string[] = (result as { paths?: string[]; path?: string }).paths ?? (result.path ? [result.path] : [])
    for (const srcPath of paths) {
      const fileName = srcPath.replace(/\\/g, '/').split('/').pop() ?? 'file'
      await window.kitops.fs.copyPath(srcPath, window.kitops.fs.pathJoin(targetDir, fileName))
    }

    // Refresh the parent node's children
    const parentRelPath = targetNode?.relativePath ?? ''
    const parentKey = targetNode
      ? nodeKey(repository, tag, targetNode.relativePath, digest)
      : tKey
    const children = await listDir(targetDir, parentRelPath)
    nodeChildren.value.set(parentKey, children)
    return true
  }

  // ---------------------------------------------------------------------------
  // Pack / save as new tag
  // ---------------------------------------------------------------------------

  async function saveAsNewTag(
    repository: string,
    sourceTag: string,
    sourceDig: string | undefined,
    newTag: string,
  ) {
    const key = tagKey(repository, sourceTag, sourceDig)
    const unpackDir = unpackedDirs.value.get(key)
    if (!unpackDir) {
      throw new Error('This tag has not been expanded yet — expand it first.')
    }

    packing.value = true
    try {
      await window.kitops.kit.pack(unpackDir, { tag: `${repository}:${newTag}` })
      await kitStore.fetchModelKits()
    } finally {
      packing.value = false
    }
  }

  return {
    // State
    repositoryGroups,
    expandedNodes,
    loadingNodes,
    selectedFile,
    packing,
    // Key helpers
    repoKey,
    tagKey,
    nodeKey,
    kitRef,
    // Checkers
    isExpanded,
    isLoading,
    // Tree actions
    toggleRepo,
    toggleTag,
    toggleFolder,
    getChildren,
    // File actions
    selectFile,
    getFileContent,
    openWithSystemApp,
    addFiles,
    saveAsNewTag,
  }
})
