export const STORAGE_KEY = 'kitops-desktop-settings'

export const DEFAULT_SETTINGS = {
  tempDir: '', // Will be set to system default on init
  lastUsedRegistry: '',
} as const

export type Settings = typeof DEFAULT_SETTINGS