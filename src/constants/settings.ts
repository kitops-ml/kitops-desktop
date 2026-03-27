export const STORAGE_KEY = 'kitops-desktop-settings'

export type Settings = {
  tempDir: string,
  lastUsedRegistry: string,
  homeViewTab: 'grid' | 'list',
}

export const DEFAULT_SETTINGS: Setting = {
  tempDir: '', // Will be set to system default on init
  lastUsedRegistry: '',
  homeViewTab: 'grid',
}
