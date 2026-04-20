<script setup lang="ts">
import { type Component, ref } from 'vue'
import { useRouter } from 'vue-router'

import IconSpinner from '~icons/custom-icons/spinner'
import IconDownload from '~icons/ri/download-line'
import IconFile from '~icons/ri/file-text-line'
import IconFolder from '~icons/ri/folder-line'
import IconFramework from '~icons/ri/stack-line'

import { useNotification } from '../composables/useNotification'
import { useUnpackedKitfileStore } from '../stores/unpackedKitfileStore'

interface Template {
  id: string
  name: string
  description?: string
  icon?: Component
  tags?: string[]
}

const router = useRouter()
const draftStore = useUnpackedKitfileStore()
const notification = useNotification()
const isImporting = ref(false)

const templates: Template[] = [
  {
    id: 'pytorch',
    name: 'PyTorch Model',
    description: 'Package a PyTorch model with training code and dependencies',
    tags: ['PyTorch', 'Deep Learning'],
  },
  {
    id: 'tensorflow',
    name: 'TensorFlow Model',
    description: 'Package a TensorFlow model with saved model format',
    tags: ['TensorFlow', 'ML'],
  },
  {
    id: 'llm',
    name: 'Large Language Model',
    description: 'Package an LLM with tokenizer and configuration',
    tags: ['LLM', 'NLP', 'Transformers'],
  },
]

function selectTemplate(template: Template) {
  if (template.id === 'blank') {
    router.push('/edit')
  } else {
    router.push({
      name: 'edit-kitfile',
      query: { template: template.id },
    })
  }
}

function goToInitFromDirectory() {
  router.push({ name: 'init-from-directory' })
}

async function importExistingKitfile(): Promise<void> {
  isImporting.value = true
  try {
    const result = await window.kitops.dialog.selectFile({
      title: 'Select Kitfile to Import',
      buttonLabel: 'Import',
      filters: [
        { name: 'Kitfile', extensions: [''] },
      ],
    })

    if (result.success && result.path) {
      // Add to draft tracking
      await draftStore.addUnpackedKitfile(result.path)
      // Navigate to editor to view/edit
      router.push({
        name: 'edit-kitfile',
        query: { kitfilePath: result.path },
      })
    }
  } catch (error) {
    notification.error('Failed to import kitfile:', error)
  } finally {
    isImporting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="px-10 bg-elevation-02 border-b border-gray-03 h-28">
      <div class="flex items-center h-full">
        <div>
          <h1 class="text-3xl font-extrabold mb-2">Create New Kitfile</h1>
          <p class="text-gray-01 text-base">Choose a template or start from scratch</p>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-10">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
        <div class="col-span-full">
          <h3 class="text-xl font-bold mb-2">Start from scratch</h3>
        </div>

        <div
          class="bg-surface border-2  border-gray-03 p-6 cursor-pointer transition-all duration-200 flex flex-col gap-3 hover:bg-surface hover:border-gold hover:-translate-y-0.5"
          @click="goToInitFromDirectory">
          <div class="size-12 bg-gold flex items-center justify-center text-black">
            <IconFolder class="size-7" />
          </div>
          <h3 class="text-xl font-bold">Init from directory</h3>
          <p class="text-gray-01 text-sm leading-relaxed flex-1">Create a Kitfile from importing an existing directory</p>
        </div>

        <div
          class="bg-surface border-2 border-gray-03 p-6 cursor-pointer transition-all duration-200 flex flex-col gap-3 hover:bg-surface hover:border-gold hover:-translate-y-0.5"
          :class="{ 'opacity-50 cursor-not-allowed': isImporting }"
          @click="!isImporting && importExistingKitfile()">
          <div class="size-12 bg-gold flex items-center justify-center text-black">
            <IconSpinner v-if="isImporting" class="size-7 animate-spin" />
            <IconDownload v-else class="size-7" />
          </div>
          <h3 class="text-xl font-bold">Import existing Kitfile</h3>
          <p class="text-gray-01 text-sm leading-relaxed flex-1">Add an existing Kitfile to your drafts for tracking and packing</p>
        </div>

        <div
          class="bg-surface border-2  border-gray-03 p-6 cursor-pointer transition-all duration-200 flex flex-col gap-3 hover:bg-surface hover:border-gold hover:-translate-y-0.5"
          @click="selectTemplate({ id: 'blank', name: 'Blank' })">
          <div class="size-12 bg-gold flex items-center justify-center text-black">
            <IconFile class="size-7" />
          </div>
          <h3 class="text-xl font-bold">Custom Kitfile</h3>
          <p class="text-gray-01 text-sm leading-relaxed flex-1">Create a custom Kitfile with full control</p>
        </div>

        <div class="col-span-full mt-10">
          <h3 class="text-xl font-bold mb-2">Or choose a template</h3>
        </div>

        <div
          v-for="template in templates"
          :key="template.id"
          class="bg-surface border-2 border-gray-03 p-6 cursor-pointer transition-all duration-200 flex flex-col gap-3 hover:bg-surface hover:border-gold hover:-translate-y-0.5"
          @click="selectTemplate(template)">
          <div class="size-12 bg-gold flex items-center justify-center text-black">
            <IconFramework class="size-7" />
          </div>
          <h3 class="text-xl font-bold">{{ template.name }}</h3>
          <p class="text-gray-01 text-sm leading-relaxed flex-1">{{ template.description }}</p>
          <div class="flex flex-wrap gap-2 mt-2">
            <span v-for="tag in template.tags" :key="tag" class="py-1 px-2 bg-elevation-03 text-gray-02 text-xs font-mono">{{ tag }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
