
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { stringify } from 'yaml'

import IconOverview from '~icons/ri/apps-line'
import IconBack from '~icons/ri/arrow-left-line'
import IconChevronRight from '~icons/ri/arrow-right-s-line'
import IconModelKit from '~icons/ri/box-2-line'
import IconCode from '~icons/ri/code-line'
import IconDataset from '~icons/ri/database-2-line'
import IconKitfile from '~icons/ri/file-code-line'
import IconEdit from '~icons/ri/file-edit-line'
import IconDoc from '~icons/ri/file-line'
import IconCompare from '~icons/ri/increase-decrease-line'
import IconTag from '~icons/ri/price-tag-3-line'
import IconModel from '~icons/ri/robot-2-line'
import IconLicense from '~icons/ri/scales-3-line'
import IconFramework from '~icons/ri/stack-line'
import IconManifest from '~icons/ri/survey-line'
import IconPrompt from '~icons/ri/terminal-box-line'
import IconPush from '~icons/ri/upload-line'

import CodeTab from '../components/detail/CodeTab.vue'
import DatasetsTab from '../components/detail/DatasetsTab.vue'
import DocsTab from '../components/detail/DocsTab.vue'
import KitfileTab from '../components/detail/KitfileTab.vue'
import ManifestTab from '../components/detail/ManifestTab.vue'
import ModelTab from '../components/detail/ModelTab.vue'
import OverviewTab from '../components/detail/OverviewTab.vue'
import PromptsTab from '../components/detail/PromptsTab.vue'
import TagsFlyout from '../components/detail/TagsFlyout.vue'
import EditUnpackModal from '../components/modals/EditUnpackModal.vue'
import PushConfirmModal from '../components/modals/PushConfirmModal.vue'
import PushModal from '../components/modals/PushModal.vue'
import TagModal from '../components/modals/TagModal.vue'
import { useKitStore } from '../stores/kitStore'
import { useSettingsStore } from '../stores/settingsStore'

const route = useRoute()
const router = useRouter()
const kitStore = useKitStore()
const settingsStore = useSettingsStore()

const { currentKitfile: kitfile, currentManifest: manifest, tagging, pushing } = storeToRefs(kitStore)
const loading = ref(true)
const error = ref<string | null>(null)
const repository = route.params.repository as string
const tag = route.params.tag as string

const activeTab = ref('overview')

const showTagModal = ref(false)
const tagError = ref<string | null>(null)

const showPushModal = ref(false)
const pushError = ref<string | null>(null)

const showPushConfirmModal = ref(false)
const pushConfirmDestPath = ref('')

const showEditModal = ref(false)
const showTagsSidebar = ref(false)

const modelKit = computed(() =>
  kitStore.modelKits.find(k => k.repository === repository && k.tag === tag),
)

function onEditComplete(tempDir: string) {
  showEditModal.value = false
  router.push({
    name: 'edit-kitfile',
    query: {
      kitfilePath: window.kitops.fs.pathJoin(tempDir, 'Kitfile'),
      editFrom: `${repository}:${tag}`,
      editDir: tempDir,
    },
  })
}

const kitfileYaml = computed(() => kitfile.value ? stringify(kitfile.value) : '')
const manifestYaml = computed(() => manifest.value ? stringify(manifest.value) : '')

onMounted(async () => {
  if (!repository || !tag) {
    router.push('/'); return
  }

  await settingsStore.init()
  await kitStore.loadAuthState()

  try {
    loading.value = true
    error.value = null
    await kitStore.getKitfile(`${repository}:${tag}`)
    await kitStore.getManifest(`${repository}:${tag}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

const hasModel = computed(() => Boolean(kitfile.value?.model))
const hasCode = computed(() => (kitfile.value?.code?.length ?? 0) > 0)
const hasDatasets = computed(() => (kitfile.value?.datasets?.length ?? 0) > 0)
const hasDocs = computed(() => (kitfile.value?.docs?.length ?? 0) > 0)
const hasPrompts = computed(() => (kitfile.value?.prompts?.length ?? 0) > 0)

const modelPartsCount = computed(() => kitfile.value?.model?.parts?.length ?? 0)
const codeCount = computed(() => kitfile.value?.code?.length ?? 0)
const datasetsCount = computed(() => kitfile.value?.datasets?.length ?? 0)
const docsCount = computed(() => kitfile.value?.docs?.length ?? 0)
const promptsCount = computed(() => kitfile.value?.prompts?.length ?? 0)

const availableTabs = computed(() => {
  const tabs = [{ id: 'overview', label: 'Overview', icon: IconOverview }]
  if (hasModel.value) {
    tabs.push({ id: 'model', label: 'Model', icon: IconModel, count: 1 + modelPartsCount.value })
  }
  if (hasCode.value) {
    tabs.push({ id: 'code', label: 'Code', icon: IconCode, count: codeCount.value })
  }
  if (hasDatasets.value) {
    tabs.push({ id: 'datasets', label: 'Datasets', icon: IconDataset, count: datasetsCount.value })
  }
  if (hasDocs.value) {
    tabs.push({ id: 'docs', label: 'Docs', icon: IconDoc, count: docsCount.value })
  }
  if (hasPrompts.value) {
    tabs.push({ id: 'prompts', label: 'Prompts', icon: IconPrompt, count: promptsCount.value })
  }
  tabs.push({ id: 'kitfile', label: 'Kitfile', icon: IconKitfile })
  tabs.push({ id: 'manifest', label: 'Manifest', icon: IconManifest })
  return tabs
})

const modelkitTags = computed<Record<string, number>[]>(() => {
  const tags = kitStore.modelKits
    .filter((m) => m.repository === repository)
    .map((m) => ({
      name: m.tag,
      size: m.size,
    }))
    .toSorted((a, z) => a.name.localeCompare(z.name))
  return tags
})

function goBack() {
  router.push('/')
}

function openTagModal() {
  tagError.value = null
  showTagModal.value = true
}

function closeTagModal() {
  showTagModal.value = false
  tagError.value = null
}

async function handleTag(tagName: string): Promise<void> {
  tagError.value = null
  try {
    await kitStore.tagModelKit(`${repository}:${tag}`, `${repository}:${tagName}`)
    closeTagModal()
  } catch (err) {
    tagError.value = err instanceof Error ? err.message : 'Failed to tag modelkit'
  }
}

const isRemoteModelKit = computed(() => {
  if (!repository.includes('/')) {
    return false
  }
  return repository.split('/')[0].includes('.')
})

function openPushModal() {
  pushError.value = null
  showPushModal.value = true
}

function closePushModal() {
  showPushModal.value = false
  pushError.value = null
}

function openPushConfirmModal(destPath: string) {
  pushConfirmDestPath.value = destPath
  showPushConfirmModal.value = true
}

function closePushConfirmModal() {
  showPushConfirmModal.value = false
  pushConfirmDestPath.value = ''
}

function onPushClick() {
  if (isRemoteModelKit.value) {
    const repoPath = repository.split('/').slice(1).join('/')
    openPushConfirmModal(`${repoPath}:${tag}`)
  } else {
    openPushModal()
  }
}

function onPushFormSubmit(form: { repository: string; tag: string }) {
  closePushModal()
  openPushConfirmModal(`${form.repository}:${form.tag}`)
}

async function confirmPush(destination: string): Promise<void> {
  const source = `${repository}:${tag}`
  try {
    await kitStore.pushModelKit(source, destination)
    closePushConfirmModal()
    const lastColon = destination.lastIndexOf(':')
    const destRepo = destination.substring(0, lastColon)
    const destTag = destination.substring(lastColon + 1)
    router.push({ name: 'modelkit-detail', params: { repository: destRepo, tag: destTag } })
  } catch (err) {
    closePushConfirmModal()
    alert(err instanceof Error ? err.message : 'Failed to push modelkit')
  }
}
</script>

<template>
  <div>
    <header class="px-10 bg-elevation-02 border-b border-gray-03 h-28">
      <div class="flex justify-between items-center h-full">
        <button
          class="flex items-center gap-2 py-2 px-4 bg-transparent text-gray-01 font-semibold transition-all duration-200 hover:bg-surface hover:text-off-white"
          @click="goBack">
          <IconBack class="size-4.5" />
          Back
        </button>

        <div class="flex gap-3">
          <button
            v-if="tag !== '<none>'"
            class="flex items-center gap-2 button-secondary"
            @click="showEditModal = true">
            <IconEdit class="size-4" />
            Edit
          </button>
          <button
            class="flex items-center gap-2 button-secondary"
            @click="router.push({ name: 'compare', params: { repository, tag } })">
            <IconCompare class="size-4" />
            Compare
          </button>
          <button
            class="flex items-center gap-2 button-secondary"
            :disabled="tagging !== null"
            @click="openTagModal">
            <IconTag class="size-4" />
            {{ tagging ? 'Tagging...' : 'New Tag' }}
          </button>
          <button
            class="flex items-center gap-2 button-secondary"
            :disabled="pushing !== null"
            @click="onPushClick">
            <IconPush class="size-4" />
            {{ pushing ? 'Pushing...' : 'Push' }}
          </button>
          <div class="w-px h-6 bg-gray-03 self-center" />
          <button
            class="flex items-center gap-2 button-action text-gray-01 hover:text-off-white"
            @click="showTagsSidebar = true">
            <IconTag class="size-4" />
            More tags
            <span class="py-0.5 px-1.5 bg-elevation-03 text-xs font-semibold">{{ modelkitTags.length }}</span>
            <IconChevronRight class="size-4 -ml-1" />
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 p-10">
      <div v-if="loading" class="flex flex-col items-center justify-center h-full gap-4 text-gray-01">
        <p>Loading...</p>
      </div>

      <div v-else-if="error" class="flex flex-col items-center justify-center h-full gap-4 text-red-500">
        <p>{{ error }}</p>
        <button class="flex items-center gap-2 py-3 px-5 font-semibold bg-surface text-off-white border border-gray-03 hover:bg-surface transition-all duration-200" @click="goBack">Go Back</button>
      </div>

      <div v-else-if="kitfile" class="max-w-6xl mx-auto">
        <div class="model-header sticky top-0 z-10 -mx-10 px-10 mb-6">
          <div class="compact-info">
            <div class="flex items-center gap-3 py-3">
              <IconModelKit class="size-5 text-gold shrink-0" />
              <span class="font-bold text-sm text-off-white truncate font-mono">{{ repository }}:{{ tag }}</span>
            </div>
          </div>
          <div class="full-info">
            <div class="flex items-start gap-6">
              <div class="flex items-center justify-center text-gold shrink-0">
                <IconModelKit class="size-9" />
              </div>
              <div class="min-w-0 flex-1">
                <h1 class="text-3xl font-extrabold mb-2 wrap-break-word leading-none">{{ kitfile.package?.name || repository }}</h1>
                <div v-if="kitfile.package?.authors">By {{ kitfile.package.authors.join(', ') }}</div>
                <div class="flex flex-wrap items-center gap-2 my-2">
                  <span class="py-1 px-2 bg-elevation-03 text-gray-01 text-xs font-mono truncate max-w-full" title="Tag">
                    <IconTag class="w-3.5 h-3.5 inline-block" />
                    {{ tag }}
                  </span>
                  <span v-if="kitfile.package?.version" class="py-1 px-2 bg-transparent text-gold text-xs font-mono" title="Version">
                    v{{ kitfile.package.version }}
                  </span>
                  <span v-if="kitfile.model?.framework" class="py-1 px-2 bg-amber-500/15 text-amber-400 text-xs font-mono" title="Framework">
                    <IconFramework class="w-3.5 h-3.5 inline-block" /> {{ kitfile.model.framework }}
                  </span>
                  <span v-if="kitfile.model?.license" class="py-1 px-2 bg-green-500/15 text-green-400 text-xs font-mono flex items-center gap-1" title="License">
                    <IconLicense class="w-3.5 h-3.5 inline-block" />
                    {{ kitfile.model.license }}
                  </span>
                </div>
                <p v-if="kitfile.package?.description" class="text-gray-01 text-sm leading-relaxed wrap-break-word">{{ kitfile.package.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 p-1 bg-surface border border-gray-03 mb-6 overflow-x-auto">
          <button
            v-for="tab in availableTabs"
            :key="tab.id"
            class="tab-button"
            :class="[tab.icon, tab.id, { 'active': activeTab === tab.id }]"
            @click="activeTab = tab.id">
            <Component :is="tab.icon" class="size-4.5 shrink-0" />
            <span class="font-semibold">{{ tab.label }}</span>
            <span v-if="tab.count" class="py-0.5 px-1.5 bg-elevation-03 text-xs font-semibold">{{ tab.count }}</span>
          </button>
        </div>

        <div class="min-h-75">
          <OverviewTab
            v-if="activeTab === 'overview'"
            :repository="repository" :tag="tag" :manifest-version="kitfile.manifestVersion"
            :docs="kitfile.docs || []" />

          <ModelTab
            v-if="activeTab === 'model' && kitfile.model"
            :model="kitfile.model" />
          <CodeTab
            v-if="activeTab === 'code'"
            :items="kitfile.code || []" />
          <DatasetsTab
            v-if="activeTab === 'datasets'"
            :items="kitfile.datasets || []" />
          <DocsTab
            v-if="activeTab === 'docs'"
            :items="kitfile.docs || []" />
          <PromptsTab
            v-if="activeTab === 'prompts'"
            :items="kitfile?.prompts || []"
            :repository="repository"
            :tag="tag" />
          <KitfileTab
            v-if="activeTab === 'kitfile'"
            :yaml="kitfileYaml" />
          <ManifestTab
            v-if="activeTab === 'manifest'"
            :yaml="manifestYaml" />
        </div>
      </div>
    </div>

    <TagsFlyout
      :open="showTagsSidebar"
      :repository="repository"
      :current-tag="tag"
      :tags="modelkitTags"
      @close="showTagsSidebar = false"
      @select="(selectedTag) => router.push({ name: 'modelkit-detail', params: { repository, tag: selectedTag } })" />

    <TagModal
      :open="showTagModal"
      :repository="repository"
      :tag="tag"
      :error="tagError"
      :loading="tagging !== null" @close="closeTagModal"
      @submit="handleTag" />

    <PushModal
      :open="showPushModal"
      :initial-repository="repository"
      :initial-tag="tag"
      :error="pushError"
      @close="closePushModal"
      @submit="onPushFormSubmit" />

    <PushConfirmModal
      :open="showPushConfirmModal"
      :source="`${repository}:${tag}`"
      :destination-path="pushConfirmDestPath"
      :loading="pushing !== null"
      @close="closePushConfirmModal"
      @confirm="confirmPush" />

    <EditUnpackModal
      :open="showEditModal"
      :repository="repository"
      :tag="tag"
      :size="modelKit?.size"
      @close="showEditModal = false"
      @complete="onEditComplete" />
  </div>
</template>

<style scoped>
@reference "../style.css";

.tab-button {
  @apply flex items-center gap-2 py-3 px-4 bg-transparent text-gray-01 font-medium text-sm whitespace-nowrap transition-all duration-200;
}

.tab-button:hover {
  @apply bg-elevation-03 text-off-white;
}

.tab-button.active {
  @apply bg-elevation-01 text-off-white shadow-sm;
}

.tab-button.active.model {
  @apply text-layer-model;
}

.tab-button.active.code {
  @apply text-layer-code;
}

.tab-button.active.datasets {
  @apply text-layer-datasets;
}

.tab-button.active.docs {
  @apply text-layer-docs;
}

.tab-button.active.prompts {
  @apply text-layer-prompt;
}

.tab-button.active .py-0\.5 {
  @apply bg-surface;
}

/* Sticky model header with scroll-driven animation */
.model-header {
  animation: header-bg linear both;
  animation-timeline: scroll();
  animation-range: 80px 180px;
}

.compact-info {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  overflow: hidden;
  animation: show-compact linear both;
  animation-timeline: scroll();
  animation-range: 80px 180px;
}

.compact-info>* {
  overflow: hidden;
}

.full-info {
  display: grid;
  grid-template-rows: 1fr;
  animation: hide-full linear both;
  animation-timeline: scroll();
  animation-range: 0px 180px;
}

.full-info>* {
  overflow: hidden;
}

@keyframes header-bg {
  from {
    background: transparent;
    border-bottom: 1px solid transparent;
  }

  to {
    background: var(--color-elevation-01);
    border-bottom: 1px solid var(--color-gray-03);
  }
}

@keyframes show-compact {
  from {
    grid-template-rows: 0fr;
    opacity: 0;
  }

  to {
    grid-template-rows: 1fr;
    opacity: 1;
  }
}

@keyframes hide-full {
  from {
    grid-template-rows: 1fr;
    opacity: 1;
  }

  to {
    grid-template-rows: 0fr;
    opacity: 0;
  }
}

/* shiki */
:deep(.shiki) {
  background: transparent !important;
}

.shiki-container :deep(pre) {
  @apply m-0 bg-transparent;
}

.shiki-container :deep(code) {
  @apply font-mono text-sm leading-relaxed;
}
</style>
