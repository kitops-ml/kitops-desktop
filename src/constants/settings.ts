export const STORAGE_KEY = 'kitops-desktop-settings'

export type Settings = {
  tempDir: string,
  lastUsedRegistry: string,
  homeViewTab: 'grid' | 'list',
  pushUsernameByRegistry: Record<string, string>,
}

export const DEFAULT_SETTINGS: Settings = {
  tempDir: '', // Will be set to system default on init
  lastUsedRegistry: '',
  homeViewTab: 'grid',
  pushUsernameByRegistry: {},
}
