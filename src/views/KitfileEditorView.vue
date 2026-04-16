<script setup lang="ts">
import type { Kitfile, Layer } from '@kitops/kitops-ts'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import IconSpinner from '~icons/custom-icons/spinner'
import IconAdd from '~icons/ri/add-line'
import IconBack from '~icons/ri/arrow-left-line'
import IconRemove from '~icons/ri/close-line'
import IconCode from '~icons/ri/code-s-slash-line'
import IconVisual from '~icons/ri/layout-grid-line'

import KitfileLayerSection from '../components/kitfile-editor/KitfileLayerSection.vue'
import KitfileYamlPreview from '../components/kitfile-editor/KitfileYamlPreview.vue'
import PackModal from '../components/modals/PackModal.vue'
import FrameworkSelect from '../components/ui/FrameworkSelect.vue'
import Input from '../components/ui/Input.vue'
import InputPath from '../components/ui/InputPath.vue'
import LicenseSelect from '../components/ui/LicenseSelect.vue'
import { useKitfileLoader } from '../composables/useKitfileLoader'
import { useKitfileSave } from '../composables/useKitfileSave'
import { kitfileToYaml } from '../services/kitfile'
import { useKitStore } from '../stores/kitStore'
import { toRelativePath as toRelativePathPure } from '../utils'

const route = useRoute()
const router = useRouter()
const kitStore = useKitStore()
const editorMode = ref<'visual' | 'code'>('visual')
const showModelSection = ref(false)

const editFrom = route.query.editFrom as string | undefined
const editDir = route.query.editDir as string | undefined
const isEditing = computed(() => Boolean(editFrom && editDir))

const editedRepository = computed(() => {
  if (!editFrom) {
    return ''
  }
  const repo = editFrom.substring(0, editFrom.lastIndexOf(':'))
  const parts = repo.split('/')
  return parts.length > 1 && parts[0].includes('.') ? parts.slice(1).join('/') : repo
})

const editedTag = computed(() => {
  if (!editFrom) {
    return ''
  }
  return editFrom.substring(editFrom.lastIndexOf(':') + 1)
})

// Attempt to suggest a new tag by incrementing the last number in the existing tag (e.g. v1.0.0 -> v1.0.1, model_v2 -> model_v3, etc.)
const suggestedTag = computed(() =>
  editedTag.value.replace(/(\d+)(?!.*\d)/, n => String(parseInt(n) + 1)),
)

const formData = ref<Kitfile>({
  package: { name: '', version: '1.0.0', description: '', authors: [] },
  model: { name: '', path: '', framework: '', version: '', description: '', license: '', parts: [], parameters: '' },
  code: [],
  datasets: [],
  docs: [],
  prompts: [],
})

const { kitfilePath, isNew, loadKitfileFromPath, loadTemplate } = useKitfileLoader(formData, showModelSection)

const kitfileBaseDir = computed(() => {
  if (!kitfilePath.value) {
    return undefined
  }
  const lastSlash = kitfilePath.value.lastIndexOf('/')
  return lastSlash >= 0 ? kitfilePath.value.substring(0, lastSlash) : undefined
})

const allUsedPaths = computed<string[]>(() => {
  const paths: string[] = []
  if (showModelSection.value && formData.value.model.path) {
    paths.push(formData.value.model.path)
  }
  for (const part of formData.value.model.parts) {
    if (part.path) {
      paths.push(part.path)
    }
  }
  for (const c of formData.value.code) {
    if (c.path) {
      paths.push(c.path)
    }
  }
  for (const d of formData.value.datasets) {
    if (d.path) {
      paths.push(d.path)
    }
  }
  for (const d of formData.value.docs) {
    if (d.path) {
      paths.push(d.path)
    }
  }
  for (const p of formData.value.prompts) {
    if (p.path) {
      paths.push(p.path)
    }
  }
  return paths
})

function isPathDuplicate(path: string): boolean {
  if (!path) {
    return false
  }
  return allUsedPaths.value.filter(p => p === path).length > 1
}

function isAbsolutePath(path: string): boolean {
  return window.kitops.fs.pathIsAbsolute(path)
}

function isPathOutsideDir(path: string): boolean {
  if (!path) {
    return false
  }
  if (path.startsWith('../') || path.startsWith('..\\') || path === '..') {
    return true
  }
  if (kitfileBaseDir.value && window.kitops.fs.pathIsAbsolute(path)) {
    const relative = window.kitops.fs.pathRelative(kitfileBaseDir.value, path)
    return relative.startsWith('..')
  }
  return false
}

function getPathErrorMessage(path: string): string | null {
  if (!path) {
    return null
  }
  if (kitfilePath.value) {
    if (isAbsolutePath(path)) {
      return 'Absolute paths are not allowed'
    }
    if (isPathOutsideDir(path)) {
      return 'Path is outside the kitfile directory'
    }
  }
  if (isPathDuplicate(path)) {
    return 'This path is used multiple times'
  }
  return null
}

function toRelativePath(path: string, baseDir?: string): string {
  const kitfileBase = baseDir || kitfileBaseDir.value
  if (!kitfileBase) {
    return path
  }
  return toRelativePathPure(path, kitfileBase)
}

// In edit mode, files picked from outside the working dir are copied in before
// being referenced. In new-kitfile mode, paths are kept as-is (absolute paths
// are converted to relative at save time once the user chooses a save location).
async function resolveLayerPath(absolutePath: string): Promise<string> {
  if (isEditing.value && editDir) {
    const relative = window.kitops.fs.pathRelative(editDir, absolutePath)
    const isInside = !relative.startsWith('..') && !window.kitops.fs.pathIsAbsolute(relative)
    if (isInside) {
      return relative
    }
    const name = window.kitops.fs.pathBasename(absolutePath)
    const dest = window.kitops.fs.pathJoin(editDir, name)
    await window.kitops.fs.copyPath(absolutePath, dest)
    return name
  }
  return toRelativePath(absolutePath)
}

const { saving, showPackModal, packError, packing, saveKitfile, handlePackSubmit } = useKitfileSave({
  formData,
  showModelSection,
  kitfilePath,
  kitfileBaseDir,
  allUsedPaths,
  isEditing,
  isPathOutsideDir,
  editDir,
  router,
})

const generatedYaml = computed(() => kitfileToYaml(formData.value, showModelSection.value))

// Package
function addAuthor() {
  formData.value.package.authors.push('')
}
function removeAuthor(i: number) {
  formData.value.package.authors.splice(i, 1)
}

// Model
function addModel() {
  showModelSection.value = true
}

function removeModel() {
  showModelSection.value = false
  formData.value.model = { name: '', path: '', framework: '', version: '', description: '', license: '', parts: [], parameters: '' }
}

function addModelPart() {
  formData.value.model.parts.push({ name: '', path: '', type: '' })
}

// Layer sections
function removeFromLayer(i: number, layer: Omit<Layer, 'model'> | 'parts') {
  if (layer === 'parts') {
    formData.value.model.parts.splice(i, 1)
    return
  }

  formData.value[layer].splice(i, 1)
}

async function addCodeFile(): Promise<void> {
  const result = await window.kitops.dialog.selectPath({ defaultPath: kitfileBaseDir.value, multiple: true })
  if (!result.success || !result.paths.length) {
    formData.value.code.push({ path: '', description: '', license: '' })
    return
  }
  for (const p of result.paths) {
    formData.value.code.push({ path: await resolveLayerPath(p), description: '', license: '' })
  }
}

async function addDataset(): Promise<void> {
  const result = await window.kitops.dialog.selectPath({ defaultPath: kitfileBaseDir.value, multiple: true })
  if (!result.success || !result.paths.length) {
    formData.value.datasets.push({ name: '', path: '', description: '', license: '' })
    return
  }
  for (const p of result.paths) {
    formData.value.datasets.push({ name: '', path: await resolveLayerPath(p), description: '', license: '' })
  }
}

async function addDoc(): Promise<void> {
  const result = await window.kitops.dialog.selectPath({ defaultPath: kitfileBaseDir.value, multiple: true })
  if (!result.success || !result.paths.length) {
    formData.value.docs.push({ path: '', description: '' })
    return
  }
  for (const p of result.paths) {
    formData.value.docs.push({ path: await resolveLayerPath(p), description: '' })
  }
}

async function addPrompt(): Promise<void> {
  const result = await window.kitops.dialog.selectPath({ defaultPath: kitfileBaseDir.value, multiple: true })
  if (!result.success || !result.paths.length) {
    formData.value.prompts.push({ path: '', description: '' })
    return
  }
  for (const p of result.paths) {
    formData.value.prompts.push({ path: await resolveLayerPath(p), description: '' })
  }
}

function goBack() {
  if (isEditing.value) {
    const repo = editFrom!.substring(0, editFrom!.lastIndexOf(':'))
    const tag = editFrom!.substring(editFrom!.lastIndexOf(':') + 1)
    router.push({ name: 'modelkit-detail', params: { repository: repo, tag } })
  } else {
    router.push({ name: 'new-kitfile' })
  }
}

onMounted(async () => {
  if (route.query.kitfilePath) {
    await loadKitfileFromPath(route.query.kitfilePath as string)
  } else if (route.query.template) {
    loadTemplate(route.query.template as string)
  }
})
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="px-10 bg-elevation-02 border-b border-gray-03 h-28">
      <div class="flex justify-between items-center h-full">
        <div>
          <button
            v-if="isEditing"
            class="flex items-center gap-1.5 text-xs text-gray-02 hover:text-off-white transition-colors mb-2"
            @click="goBack">
            <IconBack class="size-4.5" />
            Back to modelkit
          </button>
          <h1 class="text-3xl font-extrabold mb-2">{{ isNew ? 'New Kitfile' : 'Edit Kitfile' }}</h1>
          <p class="text-gray-01">Configure your ModelKit package</p>
        </div>
        <div class="flex border border-gray-03 overflow-hidden">
          <button
            class="flex gap-2 items-center"
            :class="editorMode === 'visual' ? 'button-submit' : 'button-secondary'"
            @click="editorMode = 'visual'">
            <IconVisual class="size-4" />
            Visual
          </button>
          <button
            class="flex gap-2 items-center"
            :class="editorMode === 'code' ? 'button-submit' : 'button-secondary'"
            @click="editorMode = 'code'">
            <IconCode class="size-4" />
            Kitfile
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto py-8 px-10">
      <div class="max-w-225 mx-auto">
        <div v-show="editorMode === 'visual'">
          <!-- Package -->
          <div class="bg-surface border border-gray-03 p-6 mb-6">
            <h3 class="text-xl font-bold mb-4">Package</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-2">
                <label class="font-semibold text-sm text-gray-01">Name</label>
                <Input v-model="formData.package.name" type="text" placeholder="my-model" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="font-semibold text-sm text-gray-01">Version</label>
                <Input v-model="formData.package.version" type="text" placeholder="1.0.0" />
              </div>
              <div class="flex flex-col gap-2 col-span-2">
                <label class="font-semibold text-sm text-gray-01">Description</label>
                <textarea
                  v-model="formData.package.description"
                  placeholder="A brief description of your model"
                  class="form-input w-full"
                  rows="2" />
              </div>
              <div class="flex flex-col gap-2 col-span-2">
                <div class="flex items-center justify-between">
                  <label class="font-semibold text-sm text-gray-01">Authors</label>
                  <button
                    class="text-xs text-gold font-semibold hover:text-gold/80 transition-colors"
                    @click="addAuthor">
                    + Add author
                  </button>
                </div>
                <div v-for="(_, i) in formData.package.authors" :key="i" class="flex gap-2">
                  <Input
                    v-model="formData.package.authors[i]"
                    type="text"
                    placeholder="Author"
                    class="flex-1" />
                  <button
                    class="p-2 text-gray-02 transition-all hover:text-error hover:bg-error/10"
                    @click="removeAuthor(i)">
                    <IconRemove class="size-4.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Model -->
          <div class="bg-surface border border-gray-03 p-6 mb-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">Model</h3>
              <button
                v-if="!showModelSection"
                class="flex items-center gap-2 py-2 px-3 bg-gold text-black text-[0.85rem] font-semibold transition-all duration-200 hover:bg-gold hover:text-bg-primary"
                @click="addModel">
                <IconAdd class="size-3.5" />
                Add
              </button>
              <button
                v-else
                class="flex items-center gap-2 py-2 px-3 bg-transparent text-error text-[0.85rem] font-semibold transition-all duration-200 hover:bg-error/10"
                @click="removeModel">
                <IconRemove class="size-3.5" />
                Remove
              </button>
            </div>

            <div v-if="showModelSection" class="flex flex-col gap-4">
              <div class="grid grid-cols-2 gap-4 border border-gray-03 bg-elevation-02 p-4">
                <div class="flex flex-col gap-2">
                  <label class="font-semibold text-sm text-gray-01">Path <span class="text-error">*</span></label>
                  <InputPath v-model="formData.model.path" placeholder="model.pt" :base-dir="kitfileBaseDir" :copy-to-dir="isEditing ? editDir : undefined" />
                  <p v-if="getPathErrorMessage(formData.model.path)" class="text-xs text-error">{{ getPathErrorMessage(formData.model.path) }}</p>
                </div>
                <div class="flex flex-col gap-2">
                  <label class="font-semibold text-sm text-gray-01">Framework</label>
                  <FrameworkSelect v-model="formData.model.framework" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="font-semibold text-sm text-gray-01">Name</label>
                  <Input v-model="formData.model.name" type="text" placeholder="My Model" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="font-semibold text-sm text-gray-01">Version</label>
                  <Input v-model="formData.model.version" type="text" placeholder="1.0.0" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="font-semibold text-sm text-gray-01">License</label>
                  <LicenseSelect v-model="formData.model.license" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="font-semibold text-sm text-gray-01">Description</label>
                  <Input v-model="formData.model.description" type="text" placeholder="What this model does" />
                </div>
              </div>

              <!-- Parts -->
              <div class="border-t border-gray-03 pt-4">
                <div class="flex items-center justify-between mb-3">
                  <span class="font-semibold text-sm text-gray-01">Parts</span>
                  <button
                    class="text-xs text-gold font-semibold hover:text-gold/80 transition-colors"
                    @click="addModelPart">
                    + Add part
                  </button>
                </div>
                <div class="flex flex-col gap-2 border border-gray-03 bg-elevation-02 p-4">
                  <div
                    v-if="formData.model.parts.length"
                    class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1">
                    <span class="text-xs font-semibold text-gray-02">Path <span class="text-error">*</span></span>
                    <span class="text-xs font-semibold text-gray-02">Name</span>
                    <span class="text-xs font-semibold text-gray-02">Type</span>
                    <span />
                  </div>
                  <div
                    v-for="(part, i) in formData.model.parts"
                    :key="i"
                    class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
                    <div>
                      <InputPath v-model="part.path" placeholder="model.shard1.pt" :base-dir="kitfileBaseDir" :copy-to-dir="isEditing ? editDir : undefined" />
                      <p v-if="getPathErrorMessage(part.path)" class="text-xs text-error mt-0.5">{{ getPathErrorMessage(part.path) }}</p>
                    </div>
                    <Input v-model="part.name" type="text" placeholder="shard-1" />
                    <Input v-model="part.type" type="text" placeholder="weights" />
                    <button
                      class="p-2 text-gray-02 transition-all hover:text-error hover:bg-error/10"
                      @click="removeFromLayer(i, 'parts')">
                      <IconRemove class="size-4" />
                    </button>
                  </div>
                  <p v-if="!formData.model.parts.length" class="text-xs text-gray-02">
                    Parts let you split a model across multiple files (e.g. shards).
                  </p>
                </div>
              </div>

              <!-- Parameters -->
              <div class="border-t border-gray-03 pt-4">
                <div class="mb-2">
                  <span class="font-semibold text-sm text-gray-01">Parameters</span>
                  <p class="text-xs text-gray-02 mt-0.5">Arbitrary YAML for storing additional model metadata (training config, optimizer settings, etc.)</p>
                </div>
                <textarea
                  v-model="formData.model.parameters"
                  class="form-input w-full bg-elevation-02"
                  placeholder="learning_rate: 0.001&#10;batch_size: 32&#10;epochs: 100&#10;optimizer: adam"
                  rows="4"
                  spellcheck="false" />
              </div>
            </div>
            <div v-else class="p-4 bg-elevation-03 border border-gray-03 text-gray-02 text-center text-sm">
              No model added. Click &quot;Add&quot; to include a model in your package.
            </div>
          </div>

          <KitfileLayerSection
            v-model="formData.code"
            title="Code"
            entry-label="File"
            empty-message="No code files added. Click &quot;Add&quot; to include training scripts or dependencies."
            :kitfile-base-dir="kitfileBaseDir"
            :get-path-error="getPathErrorMessage"
            show-license
            @add="addCodeFile"
            @remove="removeFromLayer($event, 'code')" />

          <KitfileLayerSection
            v-model="formData.datasets"
            title="Datasets"
            entry-label="Dataset"
            empty-message="No datasets added. Click &quot;Add&quot; to include training or validation data."
            :kitfile-base-dir="kitfileBaseDir"
            :get-path-error="getPathErrorMessage"
            show-name
            show-license
            @add="addDataset"
            @remove="removeFromLayer($event, 'datasets')" />

          <KitfileLayerSection
            v-model="formData.docs"
            title="Docs"
            entry-label="Doc"
            empty-message="No docs added. Click &quot;Add&quot; to include README files or other documentation."
            :kitfile-base-dir="kitfileBaseDir"
            :get-path-error="getPathErrorMessage"
            @add="addDoc"
            @remove="removeFromLayer($event, 'docs')" />

          <KitfileLayerSection
            v-model="formData.prompts"
            title="Prompts"
            entry-label="Prompt"
            empty-message="No prompts added. Click &quot;Add&quot; to include prompts."
            :kitfile-base-dir="kitfileBaseDir"
            :get-path-error="getPathErrorMessage"
            @add="addPrompt"
            @remove="removeFromLayer($event, 'prompts')" />
        </div>

        <KitfileYamlPreview v-show="editorMode === 'code'" :yaml="generatedYaml" />

        <ul class="text-gold text-xs mt-6 list-disc list-inside p-4 px-6">
          <li v-if="isEditing">Files you browse will be copied into the working directory and referenced by filename.</li>
          <li v-if="isEditing">Paths outside the working directory will block saving.</li>
          <li v-if="!isEditing">All layer paths must be relative to the kitfile location.</li>
          <li v-if="!isEditing">Absolute paths will be converted on save.</li>
          <li v-if="!isEditing">Paths outside the kitfile directory will block saving.</li>
        </ul>

        <!-- Actions -->
        <div class="flex justify-end items-center gap-3 mt-6">
          <button
            class="py-3 px-6 bg-transparent text-gray-01 border border-gray-03 font-semibold transition-all duration-200 hover:bg-surface hover:text-off-white"
            :disabled="saving"
            @click="goBack">
            Cancel
          </button>
          <button
            class="button-submit"
            :disabled="!formData.package.name || saving"
            @click="saveKitfile">
            <IconSpinner v-if="saving" class="size-4 animate-spin" />
            {{ saving ? 'Saving...' : isEditing ? 'Save & Pack' : 'Save Kitfile' }}
          </button>
        </div>
      </div>
    </div>

    <PackModal
      :open="showPackModal"
      :draft-name="editedRepository"
      :initial-tag="suggestedTag"
      :registries="kitStore.registries"
      :error="packError"
      :loading="packing"
      @close="showPackModal = false"
      @submit="handlePackSubmit" />
  </div>
</template>
