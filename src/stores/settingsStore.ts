import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { DEFAULT_SETTINGS, type Settings, STORAGE_KEY } from '../constants/settings'
import { useLogStore } from './logStore'

export const useSettingsStore = defineStore('settings', () => {
  const logStore = useLogStore()

  // State
  const tempDir = ref(DEFAULT_SETTINGS.tempDir)
  const systemTempDir = ref('') // Store the system default for reference
  const kitopsHome = ref<string>('-')
  const lastUsedRegistry = ref<Settings['lastUsedRegistry']>('')
  const viewMode = ref<Settings['homeViewTab']>(DEFAULT_SETTINGS.homeViewTab)

  // Load settings from localStorage
  function loadSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Settings>
        if (parsed.tempDir !== undefined) {
          tempDir.value = parsed.tempDir
        }
        if (parsed.lastUsedRegistry !== undefined) {
          lastUsedRegistry.value = parsed.lastUsedRegistry
        }
        if (parsed.homeViewTab !== undefined) {
          viewMode.value = parsed.homeViewTab
        }
      }
    } catch (e) {
      logStore.logError('Failed to load settings', e)
    }
  }

  // Save settings to localStorage
  function saveSettings() {
    try {
      const settings: Settings = {
        tempDir: tempDir.value,
        lastUsedRegistry: lastUsedRegistry.value,
        homeViewTab: viewMode.value,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (e) {
      logStore.logError('Failed to save settings', e)
    }
  }

  // Update a specific setting and save
  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (key === 'tempDir') {
      tempDir.value = value as string
    } else if (key === 'lastUsedRegistry') {
      lastUsedRegistry.value = value as string
    } else if (key === 'homeViewTab') {
      viewMode.value = value as Settings['homeViewTab']
    }

    saveSettings()
  }

  // Initialize settings - load from storage and get system temp dir
  async function init() {
    // Get system temp directory
    const sysTempDir = await window.kitops.fs.getTempDir()
    systemTempDir.value = sysTempDir

    // Load stored settings
    loadSettings()

    // If tempDir is empty, use system default
    if (!tempDir.value) {
      tempDir.value = sysTempDir
    }
    // Get KITOPS_HOME environment variable
    const kitopsHomeEnv = await window.kitops.env.get('KITOPS_HOME')
    if (kitopsHomeEnv) {
      kitopsHome.value = kitopsHomeEnv
    }
  }

  // Get the effective temp directory (used for unpacking)
  function getEffectiveTempDir(): string {
    return tempDir.value || systemTempDir.value
  }

  // Reset temp directory to system default
  function resetTempDirToDefault() {
    tempDir.value = systemTempDir.value
    saveSettings()
  }

  // Update temp directory
  function setTempDir(dir: string) {
    tempDir.value = dir
    saveSettings()
  }

  // Watch for changes and auto-save
  watch([tempDir], () => {
    saveSettings()
  })

  return {
    // State
    tempDir,
    systemTempDir,
    kitopsHome,
    lastUsedRegistry,
    viewMode,

    // Actions
    init,
    loadSettings,
    saveSettings,
    getEffectiveTempDir,
    resetTempDirToDefault,
    setTempDir,
    updateSetting,
  }
})
