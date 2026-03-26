<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { parse as parseYaml, stringify } from 'yaml'

import IconSpinner from '~icons/custom-icons/spinner'
import IconAdd from '~icons/ri/add-line'
import IconBack from '~icons/ri/arrow-left-line'
import IconRemove from '~icons/ri/close-line'
import IconCode from '~icons/ri/code-s-slash-line'
import IconVisual from '~icons/ri/layout-grid-line'

import CopyButton from '../components/CopyButton.vue'
import PackModal from '../components/modals/PackModal.vue'
import FrameworkSelect from '../components/ui/FrameworkSelect.vue'
import Input from '../components/ui/Input.vue'
import InputPath from '../components/ui/InputPath.vue'
import LicenseSelect from '../components/ui/LicenseSelect.vue'
import { useNotification } from '../composables/useNotification'
import { useShiki } from '../composables/useShiki'
import { useKitStore } from '../stores/kitStore'
import { useLogStore } from '../stores/logStore'
import { useUnpackedKitfileStore } from '../stores/unpackedKitfileStore'
import { toRelativePath as toRelativePathPure } from '../utils'

interface Layer {
  path: string;
  description?: string;
}

interface Code extends Layer {
  license: string;
}
interface Dataset extends Layer {
  name: string;
  license: string;
}

interface ModelPart {
  name: string;
  path: string;
  type: string;
}

interface Model extends Layer {
  name: string;
  framework: string;
  version: string;
  license: string;
  parts: ModelPart[];
  parameters: string;
}

interface FormData {
  package: {
    name: string;
    version: string;
    description: string;
    authors: string[]
  }
  model: Model,
  code: Code[]
  datasets: Dataset[]
  docs: Layer[]
  prompts: Layer[]
}

const route = useRoute()
const router = useRouter()
const draftStore = useUnpackedKitfileStore()
const kitStore = useKitStore()
const logStore = useLogStore()
const notification = useNotification()
const { highlightCode } = useShiki()
const editorMode = ref<'visual' | 'code'>('visual')
const saving = ref(false)
const isNew = ref(true)
const loadingKitfile = ref(false)
const kitfilePath = ref<string | null>(null)
const showModelSection = ref(false)

const editFrom = route.query.editFrom as string | undefined
const editDir = route.query.editDir as string | undefined

const kitfileBaseDir = computed(() => {
  if (!kitfilePath.value) {
    return undefined
  }
  const lastSlash = kitfilePath.value.lastIndexOf('/')
  return lastSlash >= 0 ? kitfilePath.value.substring(0, lastSlash) : undefined
})
const isEditing = computed(() => Boolean(editFrom && editDir))

const showPackModal = ref(false)
const packError = ref<string | null>(null)
const packing = ref(false)

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

const suggestedTag = computed(() =>
  editedTag.value.replace(/(\d+)(?!.*\d)/, n => String(parseInt(n) + 1)),
)

const formData = ref<FormData>({
  package: { name: '', version: '1.0.0', description: '', authors: [] },
  model: { name: '', path: '', framework: '', version: '', description: '', license: '', parts: [], parameters: '' },
  code: [],
  datasets: [],
  docs: [],
  prompts: [],
})

const allUsedPaths = computed((): string[] => {
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

function toRelativePath(path: string, baseDir?: string): string {
  const kitfileBase = baseDir || kitfileBaseDir.value
  if (!kitfileBase) {
    return path
  }
  return toRelativePathPure(path, kitfileBase)
}

const generatedYaml = computed((): string => {
  const kit: Record<string, unknown> = { manifestVersion: '1.0' }

  const pkg: Record<string, unknown> = {}
  if (formData.value.package.name) {
    pkg.name = formData.value.package.name
  }
  if (formData.value.package.version) {
    pkg.version = formData.value.package.version
  }
  if (formData.value.package.description) {
    pkg.description = formData.value.package.description
  }
  const authors = formData.value.package.authors.filter(a => a.trim())
  if (authors.length) {
    pkg.authors = authors
  }
  kit.package = pkg

  if (showModelSection.value) {
    const model: Record<string, unknown> = { path: formData.value.model.path || 'model/' }
    if (formData.value.model.name) {
      model.name = formData.value.model.name
    }
    if (formData.value.model.framework) {
      model.framework = formData.value.model.framework
    }
    if (formData.value.model.version) {
      model.version = formData.value.model.version
    }
    if (formData.value.model.description) {
      model.description = formData.value.model.description
    }
    if (formData.value.model.license) {
      model.license = formData.value.model.license
    }
    const validParts = formData.value.model.parts.filter(p => p.path)
    if (validParts.length) {
      model.parts = validParts.map(p => {
        const part: Record<string, string> = { path: p.path }
        if (p.name) {
          part.name = p.name
        }
        if (p.type) {
          part.type = p.type
        }
        return part
      })
    }
    if (formData.value.model.parameters.trim()) {
      try {
        model.parameters = parseYaml(formData.value.model.parameters)
      } catch {
        model.parameters = formData.value.model.parameters
      }
    }
    kit.model = model
  }

  const validCode = formData.value.code.filter(c => c.path)
  if (validCode.length) {
    kit.code = validCode.map(c => {
      const entry: Record<string, string> = { path: c.path }
      if (c.description) {
        entry.description = c.description
      }
      if (c.license) {
        entry.license = c.license
      }
      return entry
    })
  }

  const validDatasets = formData.value.datasets.filter(d => d.path)
  if (validDatasets.length) {
    kit.datasets = validDatasets.map(d => {
      const entry: Record<string, string> = { path: d.path }
      if (d.name) {
        entry.name = d.name
      }
      if (d.description) {
        entry.description = d.description
      }
      if (d.license) {
        entry.license = d.license
      }
      return entry
    })
  }

  const validDocs = formData.value.docs.filter(d => d.path)
  if (validDocs.length) {
    kit.docs = validDocs.map(d => {
      const entry: Record<string, string> = { path: d.path }
      if (d.description) {
        entry.description = d.description
      }
      return entry
    })
  }

  const validPrompts = formData.value.prompts.filter(d => d.path)
  if (validPrompts.length) {
    kit.prompts = validPrompts.map(d => {
      const entry: Record<string, string> = { path: d.path }
      if (d.description) {
        entry.description = d.description
      }
      return entry
    })
  }

  return stringify(kit)
})

const generatedYamlHtml = computed(() => highlightCode(generatedYaml.value, 'yaml'))

onMounted(async () => {
  if (route.query.kitfilePath) {
    await loadKitfileFromPath(route.query.kitfilePath as string)
  } else if (route.query.template) {
    loadTemplate(route.query.template as string)
  }
})

function loadTemplate(templateId: string) {
  switch (templateId) {
    case 'pytorch':
      formData.value.package.name = 'my-pytorch-model'
      formData.value.package.description = 'PyTorch model package'
      formData.value.model.framework = 'pytorch'
      formData.value.model.path = 'model.pt'
      formData.value.code = [
        { path: 'train.py', description: '', license: '' },
        { path: 'requirements.txt', description: '', license: '' },
      ]
      formData.value.datasets = [{ name: '', path: 'data/', description: '', license: '' }]
      showModelSection.value = true
      break
    case 'tensorflow':
      formData.value.package.name = 'my-tensorflow-model'
      formData.value.package.description = 'TensorFlow model package'
      formData.value.model.framework = 'tensorflow'
      formData.value.model.path = 'saved_model/'
      formData.value.code = [
        { path: 'train.py', description: '', license: '' },
        { path: 'requirements.txt', description: '', license: '' },
      ]
      showModelSection.value = true
      break
    case 'llm':
      formData.value.package.name = 'my-llm'
      formData.value.package.description = 'Large Language Model package'
      formData.value.model.framework = 'transformers'
      formData.value.model.path = 'model/'
      formData.value.code = [
        { path: 'inference.py', description: '', license: '' },
        { path: 'config.json', description: '', license: '' },
        { path: 'tokenizer.json', description: '', license: '' },
      ]
      showModelSection.value = true
      break
  }
}

async function loadKitfileFromPath(path: string): Promise<void> {
  loadingKitfile.value = true
  kitfilePath.value = path

  try {
    const result = await window.kitops.fs.readFile(path)
    if (!result.success) {
      notification.error('Failed to read kitfile', result.error)
    }

    const kitfile = parseYaml(result.content)

    if (kitfile.package) {
      formData.value.package.name = kitfile.package.name || ''
      formData.value.package.version = kitfile.package.version || '1.0.0'
      formData.value.package.description = kitfile.package.description || ''
      formData.value.package.authors = Array.isArray(kitfile.package.authors) ? kitfile.package.authors : []
    }

    if (kitfile.model) {
      formData.value.model.name = kitfile.model.name || ''
      formData.value.model.path = kitfile.model.path || ''
      formData.value.model.framework = kitfile.model.framework || ''
      formData.value.model.version = kitfile.model.version || ''
      formData.value.model.description = kitfile.model.description || ''
      formData.value.model.license = kitfile.model.license || ''
      formData.value.model.parameters = kitfile.model.parameters
        ? stringify(kitfile.model.parameters).trim()
        : ''
      type RawPart = { name?: string; path?: string; type?: string }
      formData.value.model.parts = Array.isArray(kitfile.model.parts)
        ? kitfile.model.parts.map((p: RawPart) => ({
          name: p.name || '',
          path: p.path || '',
          type: p.type || '',
        }))
        : []
      showModelSection.value = true
    }

    if (Array.isArray(kitfile.code)) {
      type RawCode = { path?: string; description?: string; license?: string }
      formData.value.code = kitfile.code.map((c: RawCode) => ({
        path: c.path || '',
        description: c.description || '',
        license: c.license || '',
      }))
    }

    if (Array.isArray(kitfile.datasets)) {
      type RawDataset = { name?: string; path?: string; description?: string; license?: string }
      formData.value.datasets = kitfile.datasets.map((d: RawDataset) => ({
        name: d.name || '',
        path: d.path || '',
        description: d.description || '',
        license: d.license || '',
      }))
    }

    if (Array.isArray(kitfile.docs)) {
      formData.value.docs = kitfile.docs.map((d: { path?: string; description?: string }) => ({
        path: d.path || '',
        description: d.description || '',
      }))
    }

    if (Array.isArray(kitfile.prompts)) {
      formData.value.prompts = kitfile.prompts.map((d: { path?: string; description?: string }) => ({
        path: d.path || '',
        description: d.description || '',
      }))
    }
  } catch (error) {
    notification.error('Failed to parse kitfile', error)
  } finally {
    loadingKitfile.value = false
  }
}

function addAuthor() {
  formData.value.package.authors.push('')
}

function removeAuthor(i: number) {
  formData.value.package.authors.splice(i, 1)
}

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

function removeModelPart(i: number) {
  formData.value.model.parts.splice(i, 1)
}

async function addCodeFile(): Promise<void> {
  const result = await window.kitops.dialog.selectPath({ defaultPath: kitfileBaseDir.value, multiple: true })
  if (!result.success || !result.paths.length) {
    formData.value.code.push({ path: '', description: '', license: '' })
    return
  }
  for (const p of result.paths) {
    formData.value.code.push({ path: toRelativePath(p), description: '', license: '' })
  }
}

function removeCodeFile(i: number) {
  formData.value.code.splice(i, 1)
}

async function addDataset(): Promise<void> {
  const result = await window.kitops.dialog.selectPath({ defaultPath: kitfileBaseDir.value, multiple: true })
  if (!result.success || !result.paths.length) {
    formData.value.datasets.push({ name: '', path: '', description: '', license: '' })
    return
  }
  for (const p of result.paths) {
    formData.value.datasets.push({ name: '', path: toRelativePath(p), description: '', license: '' })
  }
}
function removeDataset(i: number) {
  formData.value.datasets.splice(i, 1)
}

async function addDoc(): Promise<void> {
  const result = await window.kitops.dialog.selectPath({ defaultPath: kitfileBaseDir.value, multiple: true })
  if (!result.success || !result.paths.length) {
    formData.value.docs.push({ path: '', description: '' })
    return
  }
  for (const p of result.paths) {
    formData.value.docs.push({ path: toRelativePath(p), description: '' })
  }
}

function removeDoc(i: number) {
  formData.value.docs.splice(i, 1)
}

async function addPrompt(): Promise<void> {
  const result = await window.kitops.dialog.selectPath({ defaultPath: kitfileBaseDir.value, multiple: true })
  if (!result.success || !result.paths.length) {
    formData.value.prompts.push({ path: '', description: '' })
    return
  }
  for (const p of result.paths) {
    formData.value.prompts.push({ path: toRelativePath(p), description: '' })
  }
}

function removePrompt(i: number) {
  formData.value.prompts.splice(i, 1)
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

function makeAllPathsRelative(baseDir?: string) {
  // small helper
  const convert = (original: string): string => {
    const converted = toRelativePath(original, baseDir)
    if (converted !== original) {
      logStore.logInfo(`Path converted to relative: ${original} → ${converted}`)
    }
    return converted
  }

  if (formData.value.model.path) {
    formData.value.model.path = convert(formData.value.model.path)
  }
  for (const part of formData.value.model.parts) {
    if (part.path) {
      part.path = convert(part.path)
    }
  }
  for (const c of formData.value.code) {
    if (c.path) {
      c.path = convert(c.path)
    }
  }
  for (const d of formData.value.datasets) {
    if (d.path) {
      d.path = convert(d.path)
    }
  }
  for (const d of formData.value.docs) {
    if (d.path) {
      d.path = convert(d.path)
    }
  }
  for (const p of formData.value.prompts) {
    if (p.path) {
      p.path = convert(p.path)
    }
  }
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

async function saveKitfile(): Promise<void> {
  saving.value = true
  try {
    let savePath = kitfilePath.value

    // If editing an existing kitfile, overwrite it
    if (isEditing.value) {
      makeAllPathsRelative()
      if (allUsedPaths.value.some(p => isPathOutsideDir(p))) {
        notification.error('Some paths are outside the kitfile directory. Fix them before saving.')
        return
      }
      await window.kitops.fs.writeFile(savePath, generatedYaml.value)
    } else {
      // Otherwise, ask user where to save the new kitfile
      const result = await window.kitops.dialog.selectDirectory({
        title: 'Select Directory to Save Kitfile',
        buttonLabel: 'Save Here',
      })
      if (result.success && result.path) {
        savePath = window.kitops.fs.pathJoin(result.path, 'Kitfile')
        kitfilePath.value = savePath
        makeAllPathsRelative(savePath.substring(0, savePath.lastIndexOf('/')))
        if (allUsedPaths.value.some(p => isPathOutsideDir(p))) {
          notification.error('Some paths are outside the kitfile directory. Fix them before saving.')
          return
        }
        await window.kitops.fs.writeFile(savePath, generatedYaml.value)
        logStore.logInfo('Kitfile created', { savePath })
        notification.success('Kitfile created')
      }
    }

    if (!savePath) {
      return
    }

    if (isEditing.value) {
      showPackModal.value = true
    } else {
      await draftStore.addUnpackedKitfile(savePath)
      router.push({ name: 'home' })
    }
  } catch (error) {
    notification.error('Failed to save kitfile', error)
  } finally {
    saving.value = false
  }
}

async function handlePackSubmit(form: { registry: string; repository: string; tag: string }): Promise<void> {
  packError.value = null
  packing.value = true
  try {
    const ref = form.registry
      ? `${form.registry}/${form.repository}:${form.tag}`
      : `${form.repository}:${form.tag}`
    await window.kitops.kit.pack(editDir!, { tag: ref })
    await kitStore.fetchModelKits()
    showPackModal.value = false

    if (editDir) {
      const result = await window.kitops.fs.deleteDir(editDir)
      if (result.success) {
        logStore.logInfo('Temporary directory removed', { dir: editDir })
      } else {
        logStore.logError('Failed to remove temporary directory', { dir: editDir, error: result.error })
      }
    }

    const newRepository = form.registry ? `${form.registry}/${form.repository}` : form.repository
    router.push({ name: 'modelkit-detail', params: { repository: newRepository, tag: form.tag } })
  } catch (e) {
    packError.value = e instanceof Error ? e.message : String(e)
  } finally {
    packing.value = false
  }
}
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
      <div class=" max-w-225 mx-auto">
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
              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                  <label class="font-semibold text-sm text-gray-01">Path <span class="text-error">*</span></label>
                  <InputPath v-model="formData.model.path" placeholder="model.pt" :base-dir="kitfileBaseDir" />
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
                <div class="flex flex-col gap-2">
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
                      <InputPath v-model="part.path" placeholder="model.shard1.pt" :base-dir="kitfileBaseDir" />
                      <p v-if="getPathErrorMessage(part.path)" class="text-xs text-error mt-0.5">{{ getPathErrorMessage(part.path) }}</p>
                    </div>
                    <Input v-model="part.name" type="text" placeholder="shard-1" />
                    <Input v-model="part.type" type="text" placeholder="weights" />
                    <button
                      class="p-2 text-gray-02 transition-all hover:text-error hover:bg-error/10"
                      @click="removeModelPart(i)">
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
                  class="form-input w-full"
                  placeholder="learning_rate: 0.001&#10;batch_size: 32&#10;epochs: 100&#10;optimizer: adam"
                  rows="4"
                  spellcheck="false" />
              </div>
            </div>
            <div v-else class="p-4 bg-elevation-03 border border-gray-03 text-gray-02 text-center text-sm">
              No model added. Click "Add" to include a model in your package.
            </div>
          </div>

          <!-- Code -->
          <div class="bg-surface border border-gray-03 p-6 mb-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">Code</h3>
              <button
                class="flex items-center gap-2 py-2 px-3 bg-gold text-black text-[0.85rem] font-semibold transition-all duration-200 hover:bg-gold hover:text-bg-primary"
                @click="addCodeFile">
                <IconAdd class="size-3.5" />
                Add
              </button>
            </div>
            <div class="flex flex-col gap-3">
              <div
                v-for="(entry, i) in formData.code"
                :key="i"
                class="border border-gray-03 bg-elevation-02 p-4">
                <div class="flex items-center justify-between mb-3">
                  <span class="text-xs font-semibold text-gray-02 uppercase tracking-wide">File {{ i + 1 }}</span>
                  <button
                    class="p-1 text-gray-02 transition-all hover:text-error hover:bg-error/10"
                    @click="removeCodeFile(i)">
                    <IconRemove class="size-4" />
                  </button>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1 col-span-2">
                    <label class="text-xs font-semibold text-gray-01">Path <span class="text-error">*</span></label>
                    <InputPath v-model="entry.path" placeholder="path/to/file.py" :base-dir="kitfileBaseDir" />
                    <p v-if="getPathErrorMessage(entry.path)" class="text-xs text-error">{{ getPathErrorMessage(entry.path) }}</p>
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-semibold text-gray-01">Description</label>
                    <Input v-model="entry.description" type="text" placeholder="What this file does" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-semibold text-gray-01">License</label>
                    <LicenseSelect v-model="entry.license" />
                  </div>
                </div>
              </div>
              <div v-if="!formData.code.length" class="p-4 bg-elevation-03 border border-gray-03 text-gray-02 text-center text-sm">
                No code files added. Click "Add" to include training scripts or dependencies.
              </div>
            </div>
          </div>

          <!-- Datasets -->
          <div class="bg-surface border border-gray-03 p-6 mb-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">Datasets</h3>
              <button
                class="flex items-center gap-2 py-2 px-3 bg-gold text-black text-[0.85rem] font-semibold transition-all duration-200 hover:bg-gold hover:text-bg-primary"
                @click="addDataset">
                <IconAdd class="size-3.5" />
                Add
              </button>
            </div>
            <div class="flex flex-col gap-3">
              <div
                v-for="(entry, i) in formData.datasets"
                :key="i"
                class="border border-gray-03 bg-elevation-02 p-4">
                <div class="flex items-center justify-between mb-3">
                  <span class="text-xs font-semibold text-gray-02 uppercase tracking-wide">Dataset {{ i + 1 }}</span>
                  <button
                    class="p-1 text-gray-02 transition-all hover:text-error hover:bg-error/10"
                    @click="removeDataset(i)">
                    <IconRemove class="size-4" />
                  </button>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-semibold text-gray-01">Path <span class="text-error">*</span></label>
                    <InputPath v-model="entry.path" placeholder="data/" :base-dir="kitfileBaseDir" />
                    <p v-if="getPathErrorMessage(entry.path)" class="text-xs text-error">{{ getPathErrorMessage(entry.path) }}</p>
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-semibold text-gray-01">Name</label>
                    <Input v-model="entry.name" type="text" placeholder="training-set" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-semibold text-gray-01">Description</label>
                    <Input v-model="entry.description" type="text" placeholder="What this dataset contains" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-semibold text-gray-01">License</label>
                    <LicenseSelect v-model="entry.license" />
                  </div>
                </div>
              </div>
              <div v-if="!formData.datasets.length" class="p-4 bg-elevation-03 border border-gray-03 text-gray-02 text-center text-sm">
                No datasets added. Click "Add" to include training or validation data.
              </div>
            </div>
          </div>

          <!-- Docs -->
          <div class="bg-surface border border-gray-03 p-6 mb-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">Docs</h3>
              <button
                class="flex items-center gap-2 py-2 px-3 bg-gold text-black text-[0.85rem] font-semibold transition-all duration-200 hover:bg-gold hover:text-bg-primary"
                @click="addDoc">
                <IconAdd class="size-3.5" />
                Add
              </button>
            </div>
            <div class="flex flex-col gap-3">
              <div
                v-for="(entry, i) in formData.docs"
                :key="i"
                class="border border-gray-03 bg-elevation-02 p-4">
                <div class="flex items-center justify-between mb-3">
                  <span class="text-xs font-semibold text-gray-02 uppercase tracking-wide">Doc {{ i + 1 }}</span>
                  <button
                    class="p-1 text-gray-02 transition-all hover:text-error hover:bg-error/10"
                    @click="removeDoc(i)">
                    <IconRemove class="size-4" />
                  </button>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-semibold text-gray-01">Path <span class="text-error">*</span></label>
                    <InputPath v-model="entry.path" placeholder="README.md" :base-dir="kitfileBaseDir" />
                    <p v-if="getPathErrorMessage(entry.path)" class="text-xs text-error">{{ getPathErrorMessage(entry.path) }}</p>
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-semibold text-gray-01">Description</label>
                    <Input v-model="entry.description" type="text" placeholder="What this document covers" />
                  </div>
                </div>
              </div>
              <div v-if="!formData.docs.length" class="p-4 bg-elevation-03 border border-gray-03 text-gray-02 text-center text-sm">
                No docs added. Click "Add" to include README files or other documentation.
              </div>
            </div>
          </div>

          <!-- Prompts -->
          <div class="bg-surface border border-gray-03 p-6 mb-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">Prompts</h3>
              <button
                class="flex items-center gap-2 py-2 px-3 bg-gold text-black text-[0.85rem] font-semibold transition-all duration-200 hover:bg-gold hover:text-bg-primary"
                @click="addPrompt">
                <IconAdd class="size-3.5" />
                Add
              </button>
            </div>
            <div class="flex flex-col gap-3">
              <div
                v-for="(entry, i) in formData.prompts"
                :key="i"
                class="border border-gray-03 bg-elevation-02 p-4">
                <div class="flex items-center justify-between mb-3">
                  <span class="text-xs font-semibold text-gray-02 uppercase tracking-wide">Prompt {{ i + 1 }}</span>
                  <button
                    class="p-1 text-gray-02 transition-all hover:text-error hover:bg-error/10"
                    @click="removePrompt(i)">
                    <IconRemove class="size-4" />
                  </button>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-semibold text-gray-01">Path <span class="text-error">*</span></label>
                    <InputPath v-model="entry.path" placeholder="PROMPT.md" :base-dir="kitfileBaseDir" />
                    <p v-if="getPathErrorMessage(entry.path)" class="text-xs text-error">{{ getPathErrorMessage(entry.path) }}</p>
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-semibold text-gray-01">Description</label>
                    <Input v-model="entry.description" type="text" placeholder="What is this prompt about" />
                  </div>
                </div>
              </div>
              <div v-if="!formData.prompts.length" class="p-4 bg-elevation-03 border border-gray-03 text-gray-02 text-center text-sm">
                No prompts added. Click "Add" to include prompts.
              </div>
            </div>
          </div>
        </div>

        <!-- Kitfile preview -->
        <div v-show="editorMode === 'code'">
          <div class="flex justify-between items-center p-4 px-6 bg-surface border border-gray-03 border-b-0">
            <span class="font-semibold text-gray-01 text-sm">Kitfile</span>
            <CopyButton :content="generatedYaml" />
          </div>
          <div v-if="generatedYamlHtml" class="shiki-container m-0 p-6 bg-elevation-01 border border-gray-03 overflow-x-auto" v-html="generatedYamlHtml" />
          <pre v-else class="m-0 p-6 bg-elevation-01 border border-gray-03 overflow-x-auto"><code class="font-mono text-sm leading-relaxed text-off-white">{{ generatedYaml }}</code></pre>
        </div>

        <ul class="text-gold text-xs mt-6 list-disc list-inside p-4 px-6">
          <li>All layer paths must be relative to the kitfile location.</li>
          <li>Absolute paths will be converted on save.</li>
          <li>Paths outside the kitfile directory will block saving.</li>
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

<style scoped>
.shiki-container :deep(.shiki) {
  background-color: transparent !important;
}

.shiki-container :deep(pre) {
  margin: 0;
  background: transparent;
}

.shiki-container :deep(code) {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.625;
}
</style>
