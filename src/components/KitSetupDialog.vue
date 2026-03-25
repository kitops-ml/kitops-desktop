<script setup lang="ts">
import { ref } from 'vue'

import IconSpinner from '~icons/custom-icons/spinner'

const emit = defineEmits<{
  (e: 'complete'): void
}>()

const installing = ref(false)
const selectingPath = ref(false)
const error = ref<string | null>(null)

const installResult = ref<{
  success: boolean
  kitPath?: string
  kitopsHome?: string
  symlinked?: boolean
  shellProfileUpdated?: boolean
  shellProfile?: string
  pathAdded?: boolean
} | null>(null)

async function handleInstallKit() {
  installing.value = true
  error.value = null
  try {
    const result = await window.kitops.kit.installKit()
    if (result.success) {
      installResult.value = result
    } else {
      error.value = result.error || 'Installation failed'
    }
  } catch (err: any) {
    error.value = err.message || 'Installation failed'
  } finally {
    installing.value = false
  }
}

function handleCancel() {
  window.kitops.shell.quitApp()
}

function handleGetStarted() {
  installResult.value = null
  emit('complete')
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/70"></div>

      <!-- Post-install summary -->
      <div v-if="installResult" class="relative bg-surface border border-gray-03 p-6 w-full max-w-lg mx-4 shadow-xl">
        <h3 class="text-xl font-bold mb-2">Kit CLI Installed</h3>
        <p class="text-gray-01 mb-4">
          Kit CLI has been installed successfully. Here's what was set up:
        </p>

        <div class="space-y-2 mb-4">
          <!-- Binary installed -->
          <div class="flex items-start gap-2 p-3 bg-elevation-03 border border-gray-03">
            <span class="text-green-400 mt-0.5 shrink-0">&#10003;</span>
            <div>
              <p class="text-sm text-off-white">Kit CLI binary installed</p>
              <p class="text-xs text-gray-02 font-mono mt-0.5">{{ installResult.kitPath }}</p>
            </div>
          </div>

          <!-- Symlink or PATH -->
          <div class="flex items-start gap-2 p-3 bg-elevation-03 border border-gray-03">
            <span :class="installResult.symlinked || installResult.pathAdded ? 'text-green-400' : 'text-yellow-400'" class="mt-0.5 shrink-0">
              {{ installResult.symlinked || installResult.pathAdded ? '&#10003;' : '!' }}
            </span>
            <div>
              <p class="text-sm text-off-white">
                <template v-if="installResult.symlinked">
                  Command line tool linked
                </template>
                <template v-else-if="installResult.pathAdded">
                  Kit added to PATH
                </template>
                <template v-else>
                  Command line tool not linked
                </template>
              </p>
              <p class="text-xs text-gray-02 mt-0.5">
                <template v-if="installResult.symlinked">
                  Symlink created at /usr/local/bin/kit
                </template>
                <template v-else-if="installResult.pathAdded">
                  Added to PATH in {{ installResult.shellProfile }}
                </template>
                <template v-else>
                  You can set this up later from the app menu
                </template>
              </p>
            </div>
          </div>

          <!-- KITOPS_HOME -->
          <div class="flex items-start gap-2 p-3 bg-elevation-03 border border-gray-03">
            <span :class="installResult.shellProfileUpdated ? 'text-green-400' : 'text-yellow-400'" class="mt-0.5 shrink-0">
              {{ installResult.shellProfileUpdated ? '&#10003;' : '!' }}
            </span>
            <div>
              <p class="text-sm text-off-white">KITOPS_HOME configured</p>
              <p class="text-xs text-gray-02 font-mono mt-0.5">{{ installResult.kitopsHome }}</p>
              <p v-if="installResult.shellProfileUpdated" class="text-xs text-gray-02 mt-0.5">
                Added to {{ installResult.shellProfile }}
              </p>
            </div>
          </div>
        </div>

        <p class="text-xs text-gray-02 mb-4">
          Open a new terminal for shell changes to take effect.
        </p>

        <button
          class="w-full button-submit"
          @click="handleGetStarted">
          Get Started
        </button>
      </div>

      <div v-else class="relative bg-surface border border-gray-03 p-6 w-full max-w-lg mx-4 shadow-xl">
        <h3 class="text-xl font-bold mb-2">Kit CLI Not Found</h3>
        <p class="text-gray-01 mb-6">
          Kit CLI hasn't been found on your system. Would you like to install it or specify a custom path to the kit binary?
        </p>

        <div v-if="error" class="p-3 mb-4 bg-error/10 border border-error text-error text-sm">
          {{ error }}
        </div>

        <div v-if="installing" class="mb-4">
          <div class="flex items-center gap-3 p-4 bg-elevation-03 border border-gray-03">
            <IconSpinner class="size-5 animate-spin text-gold" />
            <span class="text-gray-01 text-sm">Downloading and installing Kit CLI...</span>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <button
            :disabled="installing || selectingPath"
            class="w-full button-submit"
            @click="handleInstallKit">
            Install Kit
          </button>
          <button
            :disabled="installing || selectingPath"
            class="w-full py-3 px-4 bg-transparent text-gray-02 font-semibold transition-all duration-200 hover:text-gray-01 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="handleCancel">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
