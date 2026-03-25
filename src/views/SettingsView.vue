<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'

import IconAdd from '~icons/ri/add-line'
import IconCheck from '~icons/ri/check-line'
import IconDelete from '~icons/ri/delete-bin-7-line'
import IconDownload from '~icons/ri/download-cloud-2-fill'
import IconExternalLink from '~icons/ri/external-link-line'
import IconGithub from '~icons/ri/github-line'

import { version } from '../../package.json'
import type { Registry } from '../../stores/kitStore'
import BrowserLink from '../components/BrowserLink.vue'
import AddRegistryModal from '../components/modals/AddRegistryModal.vue'
import LoginModal from '../components/modals/LoginModal.vue'
import InputPath from '../components/ui/InputPath.vue'
import { useNotification } from '../composables/useNotification'
import { useKitStore } from '../stores/kitStore'
import { useSettingsStore } from '../stores/settingsStore'

interface StoredRegistry extends Registry {
  username?: string
  isCustom?: boolean
}

const kitStore = useKitStore()
const settingsStore = useSettingsStore()
const notification = useNotification()

const { tempDir, kitopsHome, systemTempDir } = storeToRefs(settingsStore)

const tempDirModel = computed({
  get: () => tempDir.value || '',
  set: (v) => settingsStore.setTempDir(v),
})
const { registries, loggingIn, loggingOut } = storeToRefs(kitStore)

const kitCliPath = ref<string>('kit')

// Login modal state
const showLoginModal = ref(false)
const loginRegistry = ref<StoredRegistry | null>(null)
const loginError = ref<string | null>(null)

// Add Registry modal state
const showAddRegistryModal = ref(false)
const addRegistryError = ref<string | null>(null)
const addingRegistry = ref(false)
const removingRegistry = ref<string | null>(null)

function showInFolder(path: string) {
  window.kitops.shell.showInFolder(path)
}

onMounted(async () => {
  await kitStore.getKitVersion()
  await settingsStore.init()
  await kitStore.loadAuthState()
  if (window.kitops?.kit?.getCliPath) {
    kitCliPath.value = await window.kitops.kit.getCliPath()
  }
})

function openLoginModal(registry: StoredRegistry) {
  loginRegistry.value = registry
  loginError.value = null
  showLoginModal.value = true
}

function closeLoginModal() {
  showLoginModal.value = false
  loginRegistry.value = null
  loginError.value = null
}

async function handleLogin(credentials: { username: string; password: string }): Promise<void> {
  if (!loginRegistry.value) {
    return
  }

  loginError.value = null
  try {
    await kitStore.loginToRegistry(loginRegistry.value.url, credentials.username, credentials.password)
    closeLoginModal()
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : 'Login failed'
  }
}

async function handleLogout(registry: StoredRegistry): Promise<void> {
  try {
    await kitStore.logoutFromRegistry(registry.url)
  } catch (error) {
    notification.error('Failed to logout', error)
  }
}

// Danger zone
const showDangerZone = ref(false)
const removingData = ref(false)

async function removeAppData(includeModelKits: boolean): Promise<void> {
  removingData.value = true
  try {
    await window.kitops.app.removeData({ includeModelKits })
  } catch (error) {
    notification.error('Failed to remove app data', error)
    removingData.value = false
  }
}

// Add Registry modal functions
function openAddRegistryModal() {
  addRegistryError.value = null
  showAddRegistryModal.value = true
}

function closeAddRegistryModal() {
  showAddRegistryModal.value = false
  addRegistryError.value = null
}

async function handleAddRegistry(registry: { name: string; url: string; tlsVerify?: boolean }): Promise<void> {
  addRegistryError.value = null
  addingRegistry.value = true

  try {
    await kitStore.addRegistry(registry.name, registry.url, { tlsVerify: registry.tlsVerify ?? true })
    closeAddRegistryModal()
  } catch (error) {
    addRegistryError.value = error instanceof Error ? error.message : 'Failed to add registry'
  } finally {
    addingRegistry.value = false
  }
}

async function handleRemoveRegistry(registry: StoredRegistry): Promise<void> {
  if (!registry.isCustom) {
    return
  }

  removingRegistry.value = registry.url
  try {
    await kitStore.removeRegistry(registry.url)
  } catch (error) {
    notification.error('Failed to remove registry', error)
  } finally {
    removingRegistry.value = null
  }
}

function resetTempDir() {
  settingsStore.resetTempDirToDefault()
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="py-8 px-10 bg-elevation-02 border-b border-gray-03 h-28 flex items-center">
      <div>
        <h1 class="text-3xl font-extrabold mb-2">Settings</h1>
        <p class="text-gray-01">Configure KitOps Desktop preferences</p>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-10">
      <div class="max-w-200 mx-auto flex flex-col gap-8">
        <div class="bg-surface border border-gray-03  p-6">
          <h3 class="text-xl font-bold mb-2">Registries</h3>
          <p class="text-gray-01 text-sm mb-6">Manage your container registry credentials</p>

          <div class="flex flex-col gap-4 mb-6">
            <div
              v-for="registry in registries" :key="registry.url"
              class="flex justify-between items-center p-4 bg-elevation-03 border border-gray-03">
              <div class="flex flex-col gap-1 min-w-0 w-full">
                <span class="font-semibold text-off-white">{{ registry.name }}</span>
                <span class="text-sm text-gray-02 font-mono truncate" :title="registry.url">{{ registry.url }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span
                  v-if="registry.authenticated"
                  class="flex items-center gap-1.5 text-xs font-semibold text-success whitespace-nowrap">
                  <IconCheck class="w-3.5 h-3.5" /> {{ registry.username }}
                </span>
                <button
                  class="button-small button-primary"
                  :class="registry.authenticated ? 'button-action-danger border-red-500 text-red-500' : ''"
                  :disabled="loggingIn === registry.url || loggingOut === registry.url"
                  @click="registry.authenticated ? handleLogout(registry) : openLoginModal(registry)">
                  <template v-if="loggingIn === registry.url">Logging in...</template>
                  <template v-else-if="loggingOut === registry.url">Logging out...</template>
                  <template v-else>{{ registry.authenticated ? 'Logout' : 'Login' }}</template>
                </button>

                <button
                  v-if="registry.isCustom"
                  class="p-2 text-gray-02 hover:text-error hover:bg-error/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="removingRegistry === registry.url"
                  title="Remove registry"
                  @click="handleRemoveRegistry(registry)">
                  <IconDelete class="size-4" />
                </button>
              </div>
            </div>
          </div>

          <button
            class="flex items-center justify-center gap-2 w-full p-3 bg-transparent border-2 border-gray-03 text-gray-01 font-semibold transition-all duration-200 hover:border-gold hover:text-gold hover:bg-transparent"
            @click="openAddRegistryModal">
            <IconAdd class="size-4.5" />
            Add Registry
          </button>
        </div>

        <div class="bg-surface border border-gray-03  p-6">
          <h3 class="text-xl font-bold mb-2">Storage</h3>
          <p class="text-gray-01 text-sm mb-6">Configure where temporary files are stored</p>

          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <label class="font-semibold text-sm text-gray-01">Temporary Directory</label>
              <p class="text-xs text-gray-02 mb-1">Used for unpacking ModelKit contents</p>
              <InputPath
                v-model="tempDirModel"
                placeholder="System default"
                picker-type="dir"
                class="font-mono" />
              <div class="flex items-center justify-between mt-1">
                <span class="text-xs text-gray-02">
                  System default: <span class="font-mono">{{ systemTempDir }}</span>
                </span>
                <button
                  v-if="tempDir !== systemTempDir"
                  class="text-xs text-gold hover:text-gold transition-colors"
                  @click="resetTempDir">
                  Reset to default
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-surface border border-gray-03  p-6">
          <h3 class="text-xl font-bold mb-2">About this app</h3>
          <div class="flex flex-col gap-3 mb-6">
            <div class="flex justify-between pb-3 border-b border-gray-03">
              <span class="text-gray-01 font-semibold">Version</span>
              <span class="text-off-white">{{ version }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-01 font-semibold">License</span>
              <span class="text-off-white">MIT</span>
            </div>
          </div>
        </div>

        <div class="bg-surface border border-gray-03  p-6">
          <h3 class="text-xl font-bold mb-2">About Kit CLI</h3>
          <a v-if="kitStore.updateAvailable" :href="kitStore.updateAvailable.url" target="_blank" class="flex items-center gap-3 p-3 mb-4 bg-elevation-03 border border-gold/30 text-gold no-underline transition-all duration-200 hover:border-gold hover:bg-elevation-03/80">
            <IconDownload class="size-5 shrink-0" />
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-semibold">Kit v{{ kitStore.updateAvailable.latest }} available</span>
              <span class="text-xs text-gray-02">You're on v{{ kitStore.updateAvailable.current }} — click to view release notes</span>
            </div>
          </a>
          <div class="flex flex-col gap-3 mb-6">
            <div class="flex justify-between pb-3 border-b border-gray-03">
              <span class="text-gray-01 font-semibold">Version</span>
              <span class="text-off-white font-mono">{{ kitStore.kitVersion?.Version || '<unknown>' }}</span>
            </div>
            <div class="flex justify-between pb-3 border-b border-gray-03">
              <span class="text-gray-01 font-semibold">Commit</span>
              <span class="text-off-white font-mono">{{ kitStore.kitVersion?.Commit || '<unknown>' }}</span>
            </div>
            <div class="flex justify-between pb-3 border-b border-gray-03">
              <span class="text-gray-01 font-semibold">Built</span>
              <span class="text-off-white font-mono">{{ kitStore.kitVersion?.Built || '<unknown>' }}</span>
            </div>
            <div class="flex justify-between pb-3 border-b border-gray-03">
              <span class="text-gray-01 font-semibold">Go Version</span>
              <span class="text-off-white font-mono">{{ kitStore.kitVersion?.GoVersion || '<unknown>' }}</span>
            </div>
            <div class="flex justify-between pb-3 border-b border-gray-03">
              <span class="text-gray-01 font-semibold">Install Path</span>
              <button class="text-off-white font-mono text-left text-sm truncate max-w-120 hover:text-gold transition-colors cursor-pointer bg-transparent border-none p-0" dir="rtl" :title="kitCliPath" @click="showInFolder(kitCliPath)">{{ kitCliPath }}</button>
            </div>
            <div class="flex justify-between pb-3 border-b border-gray-03">
              <span class="text-gray-01 font-semibold">$KITOPS_HOME</span>
              <button class="text-off-white font-mono text-left text-sm truncate max-w-120 hover:text-gold transition-colors cursor-pointer bg-transparent border-none p-0" dir="rtl" :title="kitopsHome" @click="showInFolder(kitopsHome)">{{ kitopsHome }}</button>
            </div>
          </div>

          <div class="flex gap-3">
            <BrowserLink href="https://kitops.org/docs/overview/" class="flex-1 flex items-center justify-center gap-2 p-3 bg-elevation-03 border border-gray-03  text-gray-01 font-semibold transition-all duration-200 hover:bg-surface hover:border-gold hover:text-gold">
              <IconExternalLink class="w-4.5 h-4.5" />
              Documentation
            </BrowserLink>
            <BrowserLink href="https://github.com/kitops-ml/kitops" class="flex-1 flex items-center justify-center gap-2 p-3 bg-elevation-03 border border-gray-03  text-gray-01 font-semibold transition-all duration-200 hover:bg-surface hover:border-gold hover:text-gold">
              <IconGithub class="w-4.5 h-4.5" />
              GitHub
            </BrowserLink>
          </div>
        </div>

        <div class="border border-error/40 p-6">
          <h3 class="text-xl font-bold mb-2 text-error">Danger Zone</h3>
          <p class="text-gray-01 text-sm mb-6">These actions are irreversible. The app will quit after removal.</p>

          <div v-if="!showDangerZone" class="flex">
            <button
              class="button-secondary border-error/40 text-error hover:border-error"
              @click="showDangerZone = true">
              Show uninstall options...
            </button>
          </div>

          <div v-else class="flex flex-col gap-3">
            <div class="flex items-start justify-between gap-6 p-4 bg-elevation-03 border border-gray-03">
              <div>
                <p class="font-semibold text-off-white mb-1">Remove app data</p>
                <p class="text-xs text-gray-02">Deletes app preferences, stored Kitfile paths, credentials, and the embedded Kit CLI binary. Does not touch your ModelKits.</p>
              </div>
              <button
                class="button-secondary border-error/40 text-error hover:border-error shrink-0"
                :disabled="removingData"
                @click="removeAppData(false)">
                Remove
              </button>
            </div>

            <div class="flex items-start justify-between gap-6 p-4 bg-elevation-03 border border-gray-03">
              <div>
                <p class="font-semibold text-off-white mb-1">Remove app data + ModelKits</p>
                <p class="text-xs text-gray-02">Everything above, plus deletes all ModelKits stored in <span class="font-mono">{{ kitopsHome }}</span>. This cannot be undone.</p>
              </div>
              <button
                class="button-secondary border-error/40 text-error hover:border-error shrink-0"
                :disabled="removingData"
                @click="removeAppData(true)">
                Remove all
              </button>
            </div>

            <p class="text-xs text-gray-02 mt-1">
              To fully uninstall, also remove the app from your Applications folder and clean up
              <span class="font-mono">/usr/local/bin/kit</span> and any <span class="font-mono"># KitOps</span> lines from your shell profile.
            </p>
          </div>
        </div>
      </div>
    </div>

    <LoginModal :open="showLoginModal" :registry-name="loginRegistry?.name" :registry-url="loginRegistry?.url" :error="loginError" :loading="loggingIn !== null" @close="closeLoginModal" @submit="handleLogin" />
    <AddRegistryModal :open="showAddRegistryModal" :error="addRegistryError" :loading="addingRegistry" @close="closeAddRegistryModal" @submit="handleAddRegistry" />
  </div>
</template>
