import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

const PINNED_STORAGE_KEY = 'kitops-desktop-pinned-modelkits'

export const useModelKitStore = defineStore('modelKits', () => {

  // State
  const pinnedModelKits = useLocalStorage<string[]>(PINNED_STORAGE_KEY, []) // Store pinned modelkit digests

  // Actions
  function pinModelKit(path: string) {
    if (!pinnedModelKits.value.includes(path)) {
      pinnedModelKits.value.push(path)
    }
  }

  function unpinModelKit(path: string) {
    pinnedModelKits.value = pinnedModelKits.value.filter(d => d !== path)
  }

  function isModelKitPinned(path: string): boolean {
    return pinnedModelKits.value.includes(path)
  }

  return {
    pinnedModelKits,
    pinModelKit,
    unpinModelKit,
    isModelKitPinned,
  }
})