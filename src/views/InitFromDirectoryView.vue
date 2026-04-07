<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import Checkbox from '@/components/ui/Checkbox.vue'
import IconSpinner from '~icons/custom-icons/spinner'
import IconError from '~icons/ri/error-warning-line'

import { useNotification } from '../composables/useNotification'
import { useUnpackedKitfileStore } from '../stores/unpackedKitfileStore'
import { cleanIpcError } from '../utils'

const router = useRouter()
const draftStore = useUnpackedKitfileStore()
const notification = useNotification()

const isInitializing = ref(false)
const initError = ref<string | null>(null)
const sourceDirectory = ref<string | null>(null)
const targetDirectory = ref<string | null>(null)
const forceOverwrite = ref(false)

async function selectSourceDirectory(): Promise<void> {
  const result = await window.kitops.dialog.selectDirectory({
    title: 'Select Source Directory',
    buttonLabel: 'Select',
  })

  if (result.success && result.path) {
    sourceDirectory.value = result.path
  }
}

async function selectTargetDirectory(): Promise<void> {
  const result = await window.kitops.dialog.selectDirectory({
    title: 'Select Target Directory for Kitfile',
    buttonLabel: 'Select',
  })

  if (result.success && result.path) {
    targetDirectory.value = result.path
  }
}

function goBack() {
  router.push({ name: 'new-kitfile' })
}

async function confirmInit(): Promise<void> {
  if (!sourceDirectory.value) {
    return
  }

  initError.value = null
  isInitializing.value = true

  try {
    // Extract folder name from source path to use as default name
    const folderName = sourceDirectory.value.split(/[/\\]/).filter(Boolean).pop() || 'my-model'

    // Build init options
    const initOptions: { name: string; config?: string; force?: boolean } = { name: folderName }

    // If target directory is specified, set the config path for the Kitfile
    if (targetDirectory.value) {
      initOptions.config = window.kitops.fs.pathJoin(targetDirectory.value, 'Kitfile')
    }

    // Add force flag if enabled
    if (forceOverwrite.value) {
      initOptions.force = true
    }

    // Run kit init on the source directory
    const initResult = await window.kitops.kit.init(sourceDirectory.value, initOptions)

    // Add to draft tracking immediately after init
    if (initResult.kitfilePath) {
      await draftStore.addUnpackedKitfile(initResult.kitfilePath)
    }

    notification.success('Kitfile initialized successfully')
    router.push({ name: 'home', query: { refresh: 'true' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to initialize Kitfile'
    initError.value = cleanIpcError(message)
    notification.error('Failed to initialize Kitfile', error)
  } finally {
    isInitializing.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="py-8 px-10 bg-elevation-02 border-b border-gray-03">
      <div class="header-content">
        <div>
          <h1 class="text-3xl font-extrabold mb-2">Initialize from Directory</h1>
          <p class="text-gray-01 text-base">Create a Kitfile by scanning an existing directory</p>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-10">
      <div class="max-w-200 mx-auto">
        <div class="bg-surface border border-gray-03 p-6 mb-6">
          <div class="flex flex-col gap-6">
            <!-- Source Directory -->
            <div class="flex flex-col gap-2">
              <label class="font-semibold text-sm text-gray-01">Source Directory</label>
              <p class="text-xs text-gray-02">The directory to scan for model files</p>
              <div class="flex gap-2">
                <div class="flex-1 py-3 px-4 bg-elevation-03 border border-gray-03 text-off-white text-[0.95rem] font-mono truncate">
                  {{ sourceDirectory || 'No directory selected' }}
                </div>
                <button
                  class="py-3 px-4 bg-elevation-03 border border-gray-03 text-gray-01 font-semibold transition-all duration-200 hover:bg-surface hover:border-gold hover:text-gold"
                  @click="selectSourceDirectory">
                  Browse
                </button>
              </div>
            </div>

            <!-- Target Directory -->
            <div class="flex flex-col gap-2">
              <label class="font-semibold text-sm text-gray-01">Target Directory <span class="text-gray-02 font-normal">(optional)</span></label>
              <p class="text-xs text-gray-02">Where to save the Kitfile. Defaults to source directory if not specified.</p>
              <div class="flex gap-2">
                <div class="flex-1 py-3 px-4 bg-elevation-03 border border-gray-03 text-off-white text-[0.95rem] font-mono truncate">
                  {{ targetDirectory || sourceDirectory || 'Same as source' }}
                </div>
                <button
                  class="py-3 px-4 bg-elevation-03 border border-gray-03 text-gray-01 font-semibold transition-all duration-200 hover:bg-surface hover:border-gold hover:text-gold"
                  @click="selectTargetDirectory">
                  Browse
                </button>
              </div>
            </div>

            <!-- Force Overwrite -->
            <div class="flex items-center gap-3">
              <Checkbox id="force-overwrite" v-model="forceOverwrite">
                <span class="font-semibold text-sm text-off-white">Overwrite existing Kitfile</span>
                <p class="text-xs text-gray-02">If a Kitfile already exists in the source directory, ignore it</p>
              </Checkbox>
            </div>
          </div>
        </div>

        <div v-if="initError" class="mb-6 p-4 bg-error/10 border border-error text-error text-sm">
          <IconError class="size-5 shrink-0" />
          <div class="flex items-center gap-2">
            <span>{{ initError }}</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex justify-end gap-3">
          <button
            class="button-secondary"
            :disabled="isInitializing"
            @click="goBack">
            Cancel
          </button>
          <button
            class="button-submit"
            :disabled="!sourceDirectory || isInitializing"
            @click="confirmInit">
            <IconSpinner v-if="isInitializing" class="size-4 animate-spin" />
            {{ isInitializing ? 'Initializing...' : 'Initialize Kitfile' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
