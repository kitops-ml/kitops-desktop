import type { DiffResult, InspectFlags, Kitfile, Manifest, ModelKit, TLSFlags, VersionResult } from '@kitops/kitops-ts'

import type { UnpackedKitfile } from '@/stores/unpackedKitfileStore'

type DialogResult = { success: boolean; path: string }
type MultiPathDialogResult = { success: boolean; paths: string[] }
type FileReadResult = { success: boolean; content: string }
type FileWriteResult = { success: boolean }

interface DialogOptions {
  title?: string
  buttonLabel?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
  multiple?: boolean
}

interface StoredCredential {
  registry: string
  username: string
  flags?: TLSFlags
}

interface Credential {
  username: string
  password: string
}

interface UpdateInfo {
  current: string
  latest: string
  url: string
}

interface InstallResult {
  success: boolean
  error?: string
  kitPath?: string
}

interface ShellSnippets {
  pathSnippet: string | null
}

interface PullOptions {
  reference: string
  flags?: TLSFlags
}

interface ModelKitLogEntry {
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

type KitflowEventCallback = (event: unknown) => void
type LogCallback = (log: Record<string, unknown>) => void
type MenuActionCallback = (action: string) => void
type ProtocolUrlCallback = (url: string) => void
type ProgressCallback = (line: string) => void

interface KitopsApi {
  kit: {
    version: () => Promise<VersionResult>
    checkUpdate: () => Promise<UpdateInfo | null>
    list: (repository?: string) => Promise<ModelKit[]>
    init: (directory: string, flags?: Record<string, unknown>) => Promise<{ path: string; kitfilePath: string }>
    info: (path: string, flags?: Record<string, unknown>, modelkitDigest?: string) => Promise<Kitfile>
    inspect: (path: string, flags?: InspectFlags, modelkitDigest?: string) => Promise<Manifest>
    push: (source: string, destination?: string, flags?: TLSFlags, modelkitDigest?: string) => Promise<unknown>
    pull: (options: PullOptions) => Promise<unknown>
    pack: (directory: string, flags?: Record<string, unknown>) => Promise<unknown>
    unpack: (path: string, flags?: Record<string, unknown>, modelkitDigest?: string) => Promise<unknown>
    remove: (path: string, flags?: { force?: boolean }, modelkitDigest?: string) => Promise<void>
    removeAll: (force?: boolean) => Promise<void>
    tag: (source: string, destination: string, modelkitDigest?: string) => Promise<void>
    diff: (reference1: string, reference2: string) => Promise<DiffResult>
    login: (registry: string, username: string, password: string, flags?: TLSFlags) => Promise<void>
    loginUnsafe: (registry: string, username: string, password: string, flags?: TLSFlags) => Promise<void>
    logout: (registry: string) => Promise<void>
    checkInstalled: () => Promise<boolean>
    setCliPath: (kitBinaryPath: string) => Promise<void>
    installKit: () => Promise<InstallResult>
    getShellSnippets: () => Promise<ShellSnippets>
    getCliPath: () => Promise<string>
    isAppInstalled: () => Promise<boolean>
    run: (args: string[]) => Promise<unknown>
    onProgress: (callback: ProgressCallback) => void
    removeProgressListener: () => void
    cancelOperation: () => Promise<void>
  }
  credentials: {
    set: (registry: string, username: string, password: string) => Promise<void>
    get: (registry: string) => Promise<Credential | null>
    has: (registry: string) => Promise<boolean>
    delete: (registry: string) => Promise<void>
    list: () => Promise<StoredCredential[]>
  }
  kitfiles: {
    list: () => Promise<UnpackedKitfile[]>
    add: (kitfilePath: string) => Promise<UnpackedKitfile>
    update: (id: string, updates: Partial<UnpackedKitfile>) => Promise<UnpackedKitfile>
    remove: (id: string) => Promise<void>
    duplicate: (id: string, mode: 'copy-assets' | 'update-references') => Promise<UnpackedKitfile>
    refresh: (id: string) => Promise<UnpackedKitfile>
  }
  fs: {
    readFile: (filePath: string) => Promise<FileReadResult>
    writeFile: (filePath: string, content: string) => Promise<FileWriteResult>
    fileExists: (filePath: string) => Promise<boolean>
    getTempDir: (subfolder?: string) => Promise<string>
    listDir: (dirPath: string) => Promise<string[]>
    deleteDir: (dirPath: string) => Promise<void>
    mkdir: (dirPath: string) => Promise<void>
    copyPath: (src: string, dest: string) => Promise<void>
    movePath: (src: string, dest: string) => Promise<void>
    pathJoin: (...args: string[]) => string
    pathIsAbsolute: (p: string) => boolean
    pathRelative: (from: string, to: string) => string
    pathBasename: (p: string) => string
    pathSep: string
  }
  dialog: {
    selectDirectory: (options?: DialogOptions) => Promise<DialogResult>
    selectFile: (options?: DialogOptions) => Promise<DialogResult>
    selectPath: (options?: DialogOptions & { multiple: true }) => Promise<MultiPathDialogResult>
  }
  shell: {
    showInFolder: (filePath: string) => Promise<void>
    openExternal: (url: string) => Promise<void>
    quitApp: () => Promise<void>
  }
  app: {
    onLog: (callback: LogCallback) => void
    removeLogListener: () => void
    onMenuAction: (callback: MenuActionCallback) => void
    removeMenuActionListener: () => void
    onProtocolUrl: (callback: ProtocolUrlCallback) => void
    removeProtocolUrlListener: () => void
    removeData: (options: { includeModelKits?: boolean }) => Promise<void>
  }
  kitflow: {
    run: (filePath: string, vars: Record<string, string>) => Promise<void>
    cancel: () => Promise<void>
    onEvent: (callback: KitflowEventCallback) => void
    removeEventListener: () => void
  }
  env: {
    get: (key: string) => Promise<string | undefined>
  }
  modelkitLogs: {
    read: (digest: string) => Promise<ModelKitLogEntry[]>
    prune: () => Promise<void>
  }
}

declare global {
  interface Window {
    kitops: KitopsApi
  }
}

export {}
