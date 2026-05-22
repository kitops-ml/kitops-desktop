import type { DiffResult, InspectFlags, Kitfile, Manifest, ModelKit, TLSFlags, VersionResult } from '@kitops/kitops-ts'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { sizeToNumber } from '@/utils'

import { useUnpackCache } from '../composables/useUnpackCache'
import { useLogStore } from './logStore'

export interface Registry {
  name: string
  url: string
  authenticated: boolean
  username?: string
  flags?: TLSFlags
}

interface StoredRegistry extends Registry {
  isCustom?: boolean
}

const BUILTIN_REGISTRIES: StoredRegistry[] = [
  { name: 'Jozu Hub', url: 'jozu.ml', authenticated: false, isCustom: false },
]

export const useKitStore = defineStore('kit', () => {
  const logStore = useLogStore()

  // State
  const modelKits = ref<ModelKit[]>([])
  const loading = ref(false)
  const removing = ref<string | null>(null) // digest of ModelKit being removed
  const pruning = ref(false)
  const currentKitfile = ref<Kitfile | null>(null)
  const currentManifest = ref<Manifest | null>(null)
  const packProgress = ref<number | null>(null)
  const kitVersion = ref<VersionResult | null>(null)
  const loggingIn = ref<string | null>(null) // url of registry being logged into
  const loggingOut = ref<string | null>(null) // url of registry being logged out of
  const tagging = ref<string | null>(null) // digest of ModelKit being tagged
  const pushing = ref<string | null>(null) // reference of ModelKit being pushed
  const storedRegistries = useLocalStorage<StoredRegistry[]>('kitops-registries', [])
  const registries = ref<StoredRegistry[]>([])
  const updateAvailable = ref<{ current: string; latest: string; url: string } | null>(null)

  // Getters
  const sortedModelKits = computed(() =>
    [...modelKits.value].sort((a, b) =>
      new Date(b.updated) - new Date(a.updated),
    ),
  )

  const totalSize = computed(() =>
    modelKits.value.reduce((sum, kit) => sum + sizeToNumber(kit.size || '0b'), 0),
  )


  // Actions
  async function checkForUpdate() {
    try {
      const update = await window.kitops.kit.checkUpdate()
      updateAvailable.value = update ?? null
    } catch (error) {
      logStore.logError('Failed to check for updates', error)
    }
  }

  async function getKitVersion() {
    try {
      const version = await window.kitops.kit.version()
      kitVersion.value = version
    } catch (error) {
      logStore.logError('Failed to fetch kit version', error)
    }
  }

  async function fetchModelKits() {
    loading.value = true
    try {
      // Call kitops-ts via Electron IPC
      const kits = await window.kitops.kit.list()
      modelKits.value = kits
    } catch (error) {
      logStore.logError('Failed to fetch modelkits', error)
    } finally {
      loading.value = false
    }
  }

  async function getKitfile(path: string): Promise<Kitfile> {
    const lastColonIndex = path.lastIndexOf(':')
    const repo = lastColonIndex === -1 ? path : path.substring(0, lastColonIndex)
    const tag = lastColonIndex === -1 ? '<none>' : path.substring(lastColonIndex + 1)
    const found = modelKits.value.find(k => k.repository === repo && k.tag === tag)
    const digest = found?.digest
    const ref = tag === '<none>' && digest ? `${repo}@${digest}` : path
    try {
      const kitfile = await window.kitops.kit.info(ref, undefined, digest)
      setCurrentKitfile(kitfile)
      return kitfile
    } catch (error) {
      logStore.logError('Failed to get kitfile', error)
      throw error
    }
  }

  async function getManifest(path: string, flags?: InspectFlags): Promise<Manifest> {
    const lastColonIndex = path.lastIndexOf(':')
    const repo = lastColonIndex === -1 ? path : path.substring(0, lastColonIndex)
    const tag = lastColonIndex === -1 ? '<none>' : path.substring(lastColonIndex + 1)
    const found = modelKits.value.find(k => k.repository === repo && k.tag === tag)
    const digest = found?.digest
    const ref = tag === '<none>' && digest ? `${repo}@${digest}` : path
    try {
      const manifest = await window.kitops.kit.inspect(ref, flags, digest)
      setCurrentManifest(manifest)
      return manifest
    } catch (error) {
      logStore.logError('Failed to get manifest', error)
      throw error
    }
  }

  async function pushModelKit(source: string, destination?: string) {
    pushing.value = source
    try {
      const pushRef = destination || source
      const registry = registries.value.find(r => pushRef.startsWith(r.url))
      if (!registry) {
        throw new Error(`No registry found for reference: ${pushRef}`)
      }
      const credentials = await window.kitops.credentials.get(registry.url)
      if (!credentials) {
        throw new Error(`No credentials found for registry: ${registry.url}`)
      }

      const flags = registry.flags ? { ...registry.flags } : undefined
      await window.kitops.kit.login(registry.url, credentials.username, credentials.password, flags)

      if (destination && destination !== source) {
        await window.kitops.kit.tag(source, destination)
      }

      const digest = modelKits.value.find(k => `${k.repository}:${k.tag}` === source)?.digest
      return await window.kitops.kit.push(pushRef, undefined, flags, digest)
    } catch (error) {
      logStore.logError('Failed to push modelkit', error)
      throw error
    } finally {
      pushing.value = null
    }
  }

  async function pullModelKit(reference) {
    try {
      // Some registry might require specific TLS flags, so find the most specific registry matching the reference, if any.
      const registry = registries.value.find(r => reference.startsWith(r.url))
      const result = await window.kitops.kit.pull({ reference, flags: registry?.flags ? { ...registry.flags } : undefined })
      await fetchModelKits()
      return result
    } catch (error) {
      logStore.logError('Failed to pull modelkit', error)
      throw error
    }
  }

  function setCurrentKitfile(kitfile) {
    currentKitfile.value = kitfile
  }

  function setCurrentManifest(manifest: Manifest) {
    currentManifest.value = manifest
  }

  async function removeModelKit(repository: string, tagOrDigest: string, force = false) {
    const modelkit = modelKits.value.find((k) =>
      k.repository === repository && (k.tag === tagOrDigest || k.digest === tagOrDigest),
    )
    if (modelkit) {
      removing.value = modelkit.digest
    }
    const path = `${repository}:${tagOrDigest}`
    try {
      // Use the provided tagOrDigest - caller should pass digest for untagged ModelKits
      await window.kitops.kit.remove(path, { force }, modelkit?.digest)
      // Refresh the list after removal
      await fetchModelKits()
    } catch (error) {
      logStore.logError('Failed to remove modelkit', error)
      throw error
    } finally {
      removing.value = null
    }
  }

  async function pruneUntaggedModelKits(force = false) {
    pruning.value = true
    try {
      await window.kitops.kit.removeAll(force)
      // Refresh the list after pruning
      await fetchModelKits()
    } catch (error) {
      logStore.logError('Failed to prune modelkits', error)
      throw error
    } finally {
      pruning.value = false
    }
  }

  // Load authentication state from stored credentials
  async function loadAuthState() {
    try {
      // First load custom registries
      await loadRegistries()

      // Then load credentials for all registries
      const storedCredentials = await window.kitops.credentials.list()
      for (const registry of registries.value) {
        const stored = storedCredentials.find(c => c.registry === registry.url)
        if (stored) {
          registry.authenticated = true
          registry.username = stored.username
          registry.flags = stored.flags ?? registry.flags ?? { tlsVerify: true }
        } else {
          registry.authenticated = false
          registry.username = undefined
        }
      }
    } catch (error) {
      logStore.logError('Failed to load auth state', error)
    }
  }

  // Login to a registry
  async function loginToRegistry(registryUrl: string, username: string, password: string) {
    loggingIn.value = registryUrl
    try {
      const loginFlags: TLSFlags = {}
      const registry = registries.value.find(r => r.url === registryUrl)
      if (registry) {
        loginFlags.tlsVerify = registry.flags?.tlsVerify ?? true
      }

      // First run kit login
      await window.kitops.kit.login(registryUrl, username, password, loginFlags)
      // If successful, store credentials securely
      await window.kitops.credentials.set(registryUrl, username, password)
      // Update local state
      if (registry) {
        registry.authenticated = true
        registry.username = username
      }
    } catch (error) {
      logStore.logError('Failed to login to registry', error)
      throw error
    } finally {
      loggingIn.value = null
    }
  }

  // Logout from a registry
  async function logoutFromRegistry(registryUrl: string) {
    loggingOut.value = registryUrl
    try {
      // Run kit logout
      await window.kitops.kit.logout(registryUrl)
    } catch (error) {
      logStore.logError('kit logout failed (continuing with cleanup)', error)
      // Don't throw - we still want to clean up credentials
    } finally {
      // Always delete stored credentials, even if kit logout fails
      try {
        await window.kitops.credentials.delete(registryUrl)
      } catch (error) {
        logStore.logError('Failed to delete credentials', error)
      }
      // Update local state
      const registry = registries.value.find(r => r.url === registryUrl)
      if (registry) {
        registry.authenticated = false
        registry.username = undefined
      }
      loggingOut.value = null
    }
  }

  function loadRegistries() {
    const missing = BUILTIN_REGISTRIES.filter(b => !storedRegistries.value.some(r => r.url === b.url))
    if (missing.length > 0) {
      storedRegistries.value = [...missing, ...storedRegistries.value]
    }

    registries.value = storedRegistries.value.map(r => ({
      name: r.name,
      url: r.url,
      authenticated: false,
      isCustom: r.isCustom ?? true,
      flags: r.flags ?? { tlsVerify: true },
    }))
  }

  function addRegistry(name: string, url: string, flags?: TLSFlags) {
    if (registries.value.some(r => r.url === url)) {
      throw new Error('A registry with this URL already exists')
    }
    const entry: StoredRegistry = { name, url, flags, authenticated: false, isCustom: true }
    storedRegistries.value = [...storedRegistries.value, entry]
    registries.value.push({ ...entry, authenticated: false })
  }

  async function removeRegistry(registryUrl: string) {
    const registry = registries.value.find(r => r.url === registryUrl)
    if (!registry?.isCustom) {
      throw new Error('Cannot remove this registry')
    }
    if (registry.authenticated) {
      await logoutFromRegistry(registryUrl)
    }
    storedRegistries.value = storedRegistries.value.filter(r => r.url !== registryUrl)
    registries.value = registries.value.filter(r => r.url !== registryUrl)
  }

  async function clearUnpackedData() {
    try {
      const { clearUnpackCache } = useUnpackCache()
      await clearUnpackCache()
    } catch (error) {
      logStore.logError('Failed to clear temp data', error)
    }
  }

  async function diffModelKits(reference1: string, reference2: string): Promise<DiffResult> {
    return window.kitops.kit.diff(reference1, reference2)
  }

  // Tag a ModelKit with a new reference
  async function tagModelKit(source: string, destination: string) {
    // Find the ModelKit by source reference to track loading state
    const kit = modelKits.value.find(k => {
      const ref = k.tag && k.tag !== '<none>'
        ? `${k.repository}:${k.tag}`
        : `${k.repository}@${k.digest}`
      return ref === source
    })
    if (kit) {
      tagging.value = kit.digest
    }
    try {
      await window.kitops.kit.tag(source, destination, kit?.digest)
      // Refresh the list after tagging
      await fetchModelKits()
    } catch (error) {
      logStore.logError('Failed to tag modelkit', error)
      throw error
    } finally {
      tagging.value = null
    }
  }

  return {
    // State
    modelKits,
    loading,
    removing,
    pruning,
    currentKitfile,
    currentManifest,
    packProgress,
    registries,
    kitVersion,
    loggingIn,
    loggingOut,
    tagging,
    pushing,

    // Getters
    sortedModelKits,
    totalSize,

    // Actions
    getKitVersion,
    fetchModelKits,
    getKitfile,
    getManifest,
    pushModelKit,
    pullModelKit,
    removeModelKit,
    pruneUntaggedModelKits,
    loadAuthState,
    loginToRegistry,
    logoutFromRegistry,
    addRegistry,
    removeRegistry,
    tagModelKit,
    diffModelKits,
    checkForUpdate,
    updateAvailable,
    clearUnpackedData,
  }
})
