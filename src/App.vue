<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref } from 'vue'
import { useRouter } from 'vue-router'

import KitSetupDialog from './components/KitSetupDialog.vue'
import PullModal from './components/modals/PullModal.vue'
import NotificationContainer from './components/NotificationContainer.vue'
import Sidebar from './components/Sidebar.vue'
import { useNotification } from './composables/useNotification'
import { useKitStore } from './stores/kitStore'
import { useLogStore } from './stores/logStore'
import { useSettingsStore } from './stores/settingsStore'
import { useUnpackedKitfileStore } from './stores/unpackedKitfileStore'
import { cleanIpcError } from './utils'

const router = useRouter()
const kitStore = useKitStore()
const logStore = useLogStore()
const notification = useNotification()
const settingsStore = useSettingsStore()
const draftStore = useUnpackedKitfileStore()

const kitNotFound = ref(false)
const checkingKit = ref(true)

// Pull modal — lives at app level so it can be opened from any route or deep link
const showPullModal = ref(false)
const pullPrefill = ref<string | undefined>(undefined)
const pullError = ref<string | null>(null)
const pulling = ref(false)

function openPullModal(prefill?: string) {
  pullError.value = null
  pullPrefill.value = prefill
  showPullModal.value = true
}

function closePullModal() {
  if (pulling.value) {
    window.kitops.kit.cancelOperation()
  }
  showPullModal.value = false
  pullError.value = null
  pullPrefill.value = undefined
}

async function confirmPull(reference: string) {
  pulling.value = true
  pullError.value = null
  try {
    await kitStore.pullModelKit(reference)
    const lastColon = reference.lastIndexOf(':')
    const repo = reference.substring(0, lastColon)
    const tag = reference.substring(lastColon + 1)
    closePullModal()
    notification.success(`Pulled ${reference} successfully`)
    router.push({ name: 'modelkit-detail', params: { repository: repo, tag } })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return
    }
    const message = error instanceof Error ? error.message : 'Failed to pull ModelKit'
    pullError.value = cleanIpcError(message)
  } finally {
    pulling.value = false
  }
}

// Provide to child views (e.g. HomeView's Pull button)
provide('openPullModal', openPullModal)
provide('pulling', pulling)

function handleProtocolUrl(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'kitops:') {
      return
    }
    // kitops://registry/org/repo:tag → registry/org/repo:tag
    const reference = parsed.host + parsed.pathname
    openPullModal(reference || undefined)
  } catch {
    // Ignore malformed URLs
  }
}

async function handleMenuAction(action: string) {
  switch (action) {
    case 'kitfiles:new':
      router.push('/new')
      break
    case 'kitfiles:import': {
      const result = await window.kitops.dialog.selectFile({
        title: 'Select Kitfile to Import',
        buttonLabel: 'Import',
        filters: [{ name: 'Kitfile', extensions: [''] }],
      })
      if (result.success && result.path) {
        await draftStore.addUnpackedKitfile(result.path)
        router.push({ name: 'edit-kitfile', query: { kitfilePath: result.path } })
      }
      break
    }
    case 'modelkits:pull':
      openPullModal()
      break
    case 'modelkits:list':
      router.push({ name: 'home' })
      break
    case 'navigate:home':
      router.push('/')
      break
    case 'navigate:disk-usage':
      router.push('/disk-usage')
      break
    case 'navigate:logs':
      router.push('/logs')
      break
    case 'navigate:settings':
      router.push('/settings')
      break
  }
}

async function initializeApp() {
  kitStore.fetchModelKits()
  kitStore.loadAuthState()
  kitStore.checkForUpdate()
  logStore.logInfo('KitOps Desktop initialized')

  // Initialize settings (needed for temp dir path), then clear leftover
  // temp data from previous sessions and measure current session usage.
  // We should do this at unload instead, but if the user force-quits or the app crashes, the lifecycle isn't guaranteed.
  settingsStore.init().then(() => kitStore.clearUnpackedData())
}

function onSetupComplete() {
  kitNotFound.value = false
  initializeApp()
}

onMounted(async () => {
  // Set up log listener from main process
  if (window.kitops && window.kitops.app.onLog) {
    window.kitops.app.onLog((log: Record<string, unknown>) => {
      logStore.addLog(log)
    })
  }

  // Handle actions triggered from the native menu bar
  window.kitops.app.onMenuAction(handleMenuAction)

  // Handle kitops:// deep links
  window.kitops.app.onProtocolUrl(handleProtocolUrl)

  // Check if kit CLI is available before initializing
  try {
    const result = await window.kitops.kit.checkInstalled()
    if (result.installed) {
      initializeApp()
    } else {
      kitNotFound.value = true
    }
  } catch {
    kitNotFound.value = true
  } finally {
    checkingKit.value = false
  }
})

onUnmounted(() => {
  if (window.kitops && window.kitops.app.removeLogListener) {
    window.kitops.app.removeLogListener()
  }
  window.kitops.app.removeMenuActionListener()
  window.kitops.app.removeProtocolUrlListener()
})
</script>

<template>
  <div class="flex h-screen">
    <template v-if="!checkingKit && !kitNotFound">
      <Sidebar />
      <main class="flex-1 overflow-auto flex flex-col">
        <RouterView v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" :key="$route.fullPath" />
          </transition>
        </RouterView>
      </main>
    </template>

    <KitSetupDialog
      v-if="kitNotFound"
      @complete="onSetupComplete" />

    <PullModal
      :open="showPullModal"
      :error="pullError"
      :loading="pulling"
      :prefill="pullPrefill"
      @close="closePullModal"
      @submit="confirmPull" />

    <NotificationContainer />
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 250ms ease, transform 250ms ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
