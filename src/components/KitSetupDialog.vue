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
  pathSnippet?: string
  homeSnippet?: string
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
  } catch (err: unknown) {
    error.value = (err as Error).message || 'Installation failed'
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
      <div v-if="installResult" class="relative bg-surface border border-gray-03 p-6 w-full max-w-xl mx-4 shadow-xl">
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

          <!-- Shell setup snippets -->
          <div v-if="installResult.pathSnippet || installResult.homeSnippet">
            <div class="mt-6 text-sm">
              Optionally, you can add Kit CLI to your shell profile (<code class="font-mono">~/.zshrc</code> or <code class="font-mono">~/.bashrc</code>) for easier access from the terminal:
            </div>
            <pre class="my-2 text-xs font-mono bg-elevation-01 border border-gray-03 px-3 py-2 whitespace-pre-wrap break-all"><template v-if="installResult.pathSnippet">{{ installResult.pathSnippet }}</template></pre>
          </div>

          <p class="text-xs text-gray-02 mb-8">
            Open a new terminal after updating your shell profile for changes to take effect.
          </p>
        </div>

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
