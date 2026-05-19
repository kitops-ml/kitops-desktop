import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useLogStore } from './logStore'

export interface UnpackedKitfile {
  id: string
  path: string
  directory: string
  name: string
  version: string
  description: string
  addedAt: string
  updatedAt: string
}

export const useUnpackedKitfileStore = defineStore('unpackedKitfiles', () => {
  const logStore = useLogStore()

  // State
  const unpackedKitfiles = ref<UnpackedKitfile[]>([])
  const loading = ref(false)
  const packing = ref<string | null>(null) // ID of the kitfile being packed

  // Getters
  const sortedUnpackedKitfiles = computed(() => {
    return [...unpackedKitfiles.value].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  })

  const hasUnpacked = computed(() => unpackedKitfiles.value.length > 0)

  // Actions
  async function fetchUnpackedKitfiles() {
    loading.value = true
    try {
      const kitfiles = await window.kitops.kitfiles.list()
      unpackedKitfiles.value = kitfiles
    } catch (error) {
      logStore.logError('Failed to fetch unpacked kitfiles', error)
    } finally {
      loading.value = false
    }
  }

  async function addUnpackedKitfile(kitfilePath: string): Promise<UnpackedKitfile> {
    try {
      const newKitfile = await window.kitops.kitfiles.add(kitfilePath)
      // Refresh the list to include the new item
      await fetchUnpackedKitfiles()
      return newKitfile
    } catch (error) {
      logStore.logError('Failed to add unpacked kitfile', error)
      throw error
    }
  }

  async function removeUnpackedKitfile(id: string) {
    try {
      await window.kitops.kitfiles.remove(id)
      unpackedKitfiles.value = unpackedKitfiles.value.filter(k => k.id !== id)
    } catch (error) {
      logStore.logError('Failed to remove unpacked kitfile', error)
      throw error
    }
  }

  async function duplicateUnpackedKitfile(id: string, mode: 'copy-assets' | 'update-references'): Promise<UnpackedKitfile> {
    try {
      const newKitfile = await window.kitops.kitfiles.duplicate(id, mode)
      await fetchUnpackedKitfiles()
      return newKitfile
    } catch (error) {
      logStore.logError('Failed to duplicate unpacked kitfile', error)
      throw error
    }
  }

  async function refreshUnpackedKitfile(id: string) {
    try {
      const result = await window.kitops.kitfiles.refresh(id)
      if (result.removed) {
        unpackedKitfiles.value = unpackedKitfiles.value.filter(k => k.id !== id)
      } else {
        const index = unpackedKitfiles.value.findIndex(k => k.id === id)
        if (index !== -1) {
          unpackedKitfiles.value[index] = result
        }
      }
      return result
    } catch (error) {
      logStore.logError('Failed to refresh unpacked kitfile', error)
      throw error
    }
  }

  async function packUnpackedKitfile(id: string, tag?: string) {
    const kitfile = unpackedKitfiles.value.find(k => k.id === id)
    if (!kitfile) {
      throw new Error('Unpacked kitfile not found')
    }

    packing.value = id
    try {
      // Build flags with explicit Kitfile path
      // The file flag tells pack exactly where the Kitfile is
      // The directory is the context for resolving relative paths in the Kitfile
      const flags: { file: string; tag?: string } = {
        file: kitfile.path,
      }
      if (tag) {
        flags.tag = tag
      }

      await window.kitops.kit.pack(kitfile.directory, flags)

      // After successful pack, remove from unpacked
      await removeUnpackedKitfile(id)

      return { success: true }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        logStore.logError('Failed to pack unpacked kitfile', error as Record<string, unknown>)
      }
      throw error
    } finally {
      packing.value = null
    }
  }

  return {
    // State
    unpackedKitfiles,
    loading,
    packing,

    // Getters
    sortedUnpackedKitfiles,
    hasUnpacked,

    // Actions
    fetchUnpackedKitfiles,
    addUnpackedKitfile,
    removeUnpackedKitfile,
    duplicateUnpackedKitfile,
    refreshUnpackedKitfile,
    packUnpackedKitfile,
  }
})
