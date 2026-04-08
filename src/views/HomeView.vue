<script setup lang="ts">
import type { ModelKit } from '@kitops/kitops-ts'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Settings } from '@/constants/settings'
import { useSettingsStore } from '@/stores/settingsStore'
import IconSpinner from '~icons/custom-icons/spinner'
import IconAdd from '~icons/ri/add-line'
import IconSort from '~icons/ri/arrow-up-down-line'
import IconClose from '~icons/ri/close-line'
import IconDelete from '~icons/ri/delete-bin-7-line'
import IconDownload from '~icons/ri/download-line'
import IconGrid from '~icons/ri/layout-grid-line'
import IconList from '~icons/ri/list-unordered'
import IconTag from '~icons/ri/price-tag-3-line'
import IconPinned from '~icons/ri/pushpin-2-line'
import IconPin from '~icons/ri/pushpin-line'
import IconRefresh from '~icons/ri/reset-right-line'
import IconSearch from '~icons/ri/search-line'

import DeleteModelKitModal from '../components/modals/DeleteModelKitModal.vue'
import PackModal from '../components/modals/PackModal.vue'
import PruneConfirmModal from '../components/modals/PruneConfirmModal.vue'
import PullModal from '../components/modals/PullModal.vue'
import TagModal from '../components/modals/TagModal.vue'
import ModelKitCard from '../components/ModelKitCard.vue'
import UnpackedKitfileCard from '../components/UnpackedKitfileCard.vue'
import { useNotification } from '../composables/useNotification'
import { useKitStore } from '../stores/kitStore'
import { useModelKitStore } from '../stores/modelKitStore'
import type { UnpackedKitfile } from '../stores/unpackedKitfileStore'
import { useUnpackedKitfileStore } from '../stores/unpackedKitfileStore'
import { cleanIpcError, formatDigest, sizeToNumber } from '../utils'

type SortOption = 'name' | 'size' | 'author' | 'repository'

const route = useRoute()
const router = useRouter()
const kitStore = useKitStore()
const draftStore = useUnpackedKitfileStore()
const notification = useNotification()
const modelkitStore = useModelKitStore()
const settingsStore = useSettingsStore()

const { registries } = storeToRefs(kitStore)
const { pinnedModelKits } = storeToRefs(modelkitStore)
const { viewMode } = storeToRefs(settingsStore)

const searchQuery = ref('')
const sortBy = ref<SortOption>('name')
const showDeleteConfirm = ref(false)
const isDeleting = ref<boolean>(false)

const showPruneConfirm = ref(false)
const showPullModal = ref(false)
const pullError = ref<string | null>(null)
const pulling = ref(false)

const showTagModal = ref(false)
const selectedModelKit = ref<ModelKit | null>(null)
const tagError = ref<string | null>(null)

const showPackModal = ref(false)
const selectedDraft = ref<UnpackedKitfile | null>(null)
const packError = ref<string | null>(null)

const menuAction = inject<Ref<string | null>>('menuAction')
watch(menuAction!, (action) => {
  if (action === 'pull') {
    openPullModal()
    menuAction!.value = null
  }
}, { immediate: true })

const filteredModelKits = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  let modelkits = [...kitStore.modelKits] as ModelKit[]

  // If we're searching, filter it here
  if (query) {
    modelkits = modelkits.filter((modelkit) =>
      modelkit.name.toLowerCase().includes(query)
      || modelkit.digest.toLowerCase().includes(query)
      || modelkit.repository.toLowerCase().includes(query)
      || modelkit.tag.toLowerCase().includes(query)
      || modelkit.maintainer.toLowerCase().includes(query),
    )
  }

  // ModelKits should be sort by pinned status first, then by the selected sort option
  // and within the pinned group, the selected sort should be respected
  modelkits
    .sort((a, z) => {
      const aPinned = pinnedModelKits.value.includes(`${a.repository}:${a.tag}`)
      const zPinned = pinnedModelKits.value.includes(`${z.repository}:${z.tag}`)
      if (aPinned && !zPinned) {
        return -1
      }
      if (!aPinned && zPinned) {
        return 1
      }
      switch (sortBy.value) {
        case 'name':
          return a.name.localeCompare(z.name)
        case 'size':
          return sizeToNumber(z.size || '0b') - sizeToNumber(a.size || '0b')
        case 'author':
          return (a.maintainer || '').localeCompare(z.maintainer || '')
        case 'repository':
          return a.repository.localeCompare(z.repository)
      }
    })

  return modelkits
})

const filteredUnpacked = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) {
    return draftStore.sortedUnpackedKitfiles
  }
  return draftStore.sortedUnpackedKitfiles.filter(draft =>
    draft.name.toLowerCase().includes(query)
    || draft.description?.toLowerCase().includes(query),
  )
})

onMounted(async () => {
  draftStore.fetchUnpackedKitfiles()
  await kitStore.loadAuthState()
  settingsStore.loadSettings()

  if (route.query.refresh === 'true') {
    refreshAll()
  }
})

function refreshAll() {
  kitStore.fetchModelKits()
  draftStore.fetchUnpackedKitfiles()
}

function createNew() {
  router.push('/new')
}

function viewDetails(kit: ModelKit) {
  router.push(`/modelkit/${encodeURIComponent(kit.repository)}/${encodeURIComponent(kit.tag)}`)
}

function openPackModal(event: Event, draft: UnpackedKitfile) {
  event.stopPropagation()
  selectedDraft.value = draft
  packError.value = null
  showPackModal.value = true
}

function closePackModal() {
  showPackModal.value = false
  selectedDraft.value = null
  packError.value = null
}

async function confirmPack(form: { registry: string; repository: string; tag: string }) {
  if (!selectedDraft.value) {
    return
  }

  const repoPath = form.registry
    ? `${form.registry}/${form.repository.trim()}`
    : form.repository.trim()
  const tag = `${repoPath}:${form.tag.trim()}`

  try {
    await draftStore.packUnpackedKitfile(selectedDraft.value.id, tag)
    await kitStore.fetchModelKits()
    closePackModal()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to pack kitfile'
    packError.value = cleanIpcError(message)
  }
}

async function removeDraft(event: Event, draft: UnpackedKitfile) {
  event.stopPropagation()
  try {
    await draftStore.removeUnpackedKitfile(draft.id)
  } catch (error) {
    notification.error('Failed to remove:', error)
  }
}

function openDeleteConfirm(modelkit: ModelKit) {
  selectedModelKit.value = modelkit
  showDeleteConfirm.value = true
}

function cancelDelete() {
  showDeleteConfirm.value = false
  selectedModelKit.value = null
}

async function confirmDelete() {
  if (!selectedModelKit.value) {
    return
  }

  isDeleting.value = true
  const { name, repository, tag } = selectedModelKit.value
  const label = `${name || repository}:${tag && tag !== '<none>' ? tag : 'latest'}`

  try {
    await removeModelKit(selectedModelKit.value)
    notification.success(`"${label}" deleted successfully`)
  } catch {
    notification.error(`Failed to delete "${label}"`)
  } finally {
    showDeleteConfirm.value = false
    isDeleting.value = false
  }
}

async function removeModelKit(modelkit: ModelKit) {
  const tagOrDigest = (!modelkit.tag || modelkit.tag === '<none>') ? modelkit.digest : modelkit.tag
  await kitStore.removeModelKit(modelkit.repository, tagOrDigest)
}

function openPruneConfirm() {
  showPruneConfirm.value = true
}

async function confirmPrune() {
  showPruneConfirm.value = false
  try {
    await kitStore.pruneUntaggedModelKits()
  } catch (error) {
    notification.error('Failed to prune ModelKits', error)
  }
}

function openPullModal() {
  pullError.value = null
  showPullModal.value = true
}

function closePullModal() {
  showPullModal.value = false
  pullError.value = null
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
    const message = error instanceof Error ? error.message : 'Failed to pull ModelKit'
    pullError.value = cleanIpcError(message)
  } finally {
    pulling.value = false
  }
}

function openTagModal(modelkit: ModelKit) {
  selectedModelKit.value = modelkit
  tagError.value = null
  showTagModal.value = true
}

function closeTagModal() {
  showTagModal.value = false
  selectedModelKit.value = null
  tagError.value = null
}

async function handleTag(tagName: string) {
  if (!selectedModelKit.value) {
    return
  }

  tagError.value = null
  const source = `${selectedModelKit.value.repository}:${selectedModelKit.value.tag}`
  const destination = `${selectedModelKit.value.repository}:${tagName}`

  try {
    await kitStore.tagModelKit(source, destination)
    closeTagModal()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to tag modelkit'
    tagError.value = cleanIpcError(message)
  }
}

function togglePin(modelkit: ModelKit) {
  const path = `${modelkit.repository}:${modelkit.tag}`
  if (modelkitStore.isModelKitPinned(path)) {
    modelkitStore.unpinModelKit(path)
  } else {
    modelkitStore.pinModelKit(path)
  }
}

function changeViewMode(mode: Settings['homeViewTab']) {
  settingsStore.updateSetting('homeViewTab', mode)
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="px-10 bg-elevation-02 border-b border-gray-03 h-28">
      <div class="flex justify-between items-center h-full">
        <div>
          <h1 class="text-3xl font-extrabold mb-2">ModelKits</h1>
          <p class="text-gray-01">Manage your local AI models and datasets</p>
        </div>
        <div class="flex gap-3">
          <button
            class="flex items-center gap-2 button-secondary"
            :disabled="pulling"
            @click="openPullModal">
            <IconSpinner v-if="pulling" class="size-4.5 animate-spin" />
            <IconDownload v-else class="size-4" />
            Pull
          </button>
          <button
            v-if="kitStore.modelKits.length > 0"
            class="flex items-center gap-2 button-secondary hover:text-error hover:border-error"
            :disabled="kitStore.pruning"
            @click="openPruneConfirm">
            <IconSpinner v-if="kitStore.pruning" class="size-4.5 animate-spin" />
            <IconDelete class="size-4" />
            Prune
          </button>
          <button
            class="flex items-center gap-2 button-secondary"
            @click="refreshAll">
            <IconRefresh
              class="size-4"
              :class="{ 'animate-spin': kitStore.loading || draftStore.loading }" />
            Refresh
          </button>
        </div>
      </div>
    </header>

    <!-- Search & Sort Bar -->
    <div
      v-if="kitStore.modelKits.length"
      class="flex justify-between items-center gap-4 z-1 mx-10 my-5 sticky top-0">
      <div class="relative flex-1 max-w-1/2 2xl:max-w-1/3">
        <IconSearch class="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-02 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by name, digest, tag, repository, or author..."
          class="button-secondary w-full pl-10 pr-10 placeholder-gray-02 leading-none py-2.25 focus:border-gold focus:bg-elevation-02" />
        <button
          v-if="searchQuery"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-02 hover:text-off-white transition-colors duration-150"
          @click="searchQuery = ''">
          <IconClose class="size-5" />
        </button>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 w-auto relative button-secondary focus-within:ring-2 focus-within:ring-gold focus-within:ring-offset-1">
          <IconSort class="size-4 text-gray-02 pointer-events-none absolute left-2" />
          <select
            v-model="sortBy"
            class="pl-8 -ml-4">
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="author">Author</option>
            <option value="repository">Repository</option>
          </select>
        </div>

        <div>
          <button
            class="button-secondary transition-colors duration-150 py-2.5!"
            :class="viewMode === 'grid' ? 'bg-elevation-04 text-gold' : 'bg-elevation-02 text-gray-02 hover:text-off-white'"
            title="Grid view"
            @click="changeViewMode('grid')">
            <IconGrid class="size-4" />
          </button>
          <button
            class="button-secondary transition-colors duration-150 py-2.5!"
            :class="viewMode === 'list' ? 'bg-elevation-04 text-gold' : 'bg-elevation-02 text-gray-02 hover:text-off-white'"
            title="List view"
            @click="changeViewMode('list')">
            <IconList class="size-4" />
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-8 px-10">
      <!-- Draft Kitfiles Section -->
      <div v-if="draftStore.hasUnpacked" class="mb-10">
        <div class="flex items-center gap-3 mb-4">
          <h2 class="text-xl font-bold text-off-white">Unpacked Kitfiles</h2>
          <span class="py-1 px-2 bg-amber-600/20 text-amber-500 text-xs font-semibold">
            {{ draftStore.unpackedKitfiles.length }}
          </span>
        </div>
        <p class="text-gray-01 text-sm mb-4">
          These Kitfiles haven't been packed into ModelKits yet. Pack them to add to your local store.
        </p>

        <div v-if="draftStore.loading" class="flex items-center gap-3 text-gray-01 py-4">
          <div class="w-5 h-5 border-2 border-gray-03 border-t-gold animate-spin rounded-full"></div>
          <span>Loading...</span>
        </div>

        <div v-if="searchQuery && !filteredUnpacked.length" class="text-center py-8 text-gray-02 text-lg">
          <p>No unpacked Kitfiles with the term "{{ searchQuery }}".</p>
        </div>

        <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
          <RouterLink
            v-for="unpacked in filteredUnpacked"
            :key="unpacked.id"
            :to="{
              name: 'edit-kitfile',
              query: { kitfilePath: unpacked.path }
            }">
            <UnpackedKitfileCard
              :key="unpacked.id"
              :kitfile="unpacked"
              :packing="draftStore.packing === unpacked.id"
              class="h-full min-h-90"
              @pack="(e) => openPackModal(e, unpacked)"
              @remove="(e) => removeDraft(e, unpacked)" />
          </RouterLink>
        </div>
      </div>

      <!-- ModelKits Section -->
      <div>
        <template v-if="kitStore.modelKits.length">
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-bold text-off-white">Packed ModelKits</h2>
            <span class="py-1 px-2 bg-gold/20 text-gold text-xs font-semibold">
              {{ kitStore.modelKits.length }}
            </span>
          </div>
          <p class="text-gray-01 text-sm mb-4">
            These are the ModelKits that are present in your local store.
          </p>
        </template>

        <div v-if="kitStore.loading" class="flex flex-col items-center justify-center h-64 gap-4 text-gray-01">
          <IconSpinner class="size-5 animate-spin text-gold" />
          <p>Loading ModelKits...</p>
        </div>

        <div
          v-else-if="kitStore.modelKits.length === 0 && !draftStore.hasUnpacked"
          class="flex flex-col items-center justify-center h-full gap-4 text-gray-01 mt-30">
          <div class="w-20 h-20 text-gray-02 opacity-50">
            <IconAdd class="size-full" />
          </div>
          <h3 class="text-2xl text-off-white mt-4">No ModelKits found</h3>
          <p class="text-center">Pull existing ModelKits from a remote repository to get started.</p>
          <p class="text-center mb-6">Or create your first Kitfile to get started packaging AI models</p>
          <button
            class="button-primary"
            @click="createNew">
            Create Kitfile
          </button>
        </div>

        <div v-else-if="kitStore.modelKits.length === 0 && draftStore.hasUnpacked" class="text-center py-8 text-gray-01">
          <p>No packed ModelKits yet. Pack your draft Kitfiles to see them here.</p>
        </div>

        <div v-else-if="searchQuery && !filteredModelKits.length" class="py-8 text-center text-gray-02 text-lg">
          <p>No ModelKits found with the term "{{ searchQuery }}".</p>
        </div>

        <div v-else-if="viewMode === 'grid'" class="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6 animate-in fade-in duration-200">
          <ModelKitCard
            v-for="modelkit in filteredModelKits"
            :key="`${modelkit.repository}:${modelkit.tag || modelkit.digest}`"
            :modelkit="modelkit"
            :is-removing="kitStore.removing === modelkit.digest"
            :pinned="modelkitStore.isModelKitPinned(`${modelkit.repository}:${modelkit.tag}`)"
            @click="viewDetails(modelkit)"
            @click:pin="togglePin(modelkit)"
            @remove="openDeleteConfirm"
            @tag="openTagModal" />
        </div>

        <table v-else class="w-full text-sm font-mono animate-in fade-in duration-200">
          <thead>
            <tr class="text-gray-02 border-b border-gray-03 text-left uppercase text-xs tracking-wider">
              <th class="pb-2 pr-8 font-semibold">Repository</th>
              <th class="pb-2 pr-8 font-semibold">Tag</th>
              <th class="pb-2 pr-8 font-semibold">Maintainer</th>
              <th class="pb-2 pr-8 font-semibold">Size</th>
              <th class="pb-2 pr-8 font-semibold">Digest</th>
              <th class="pb-2 font-semibold"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="modelkit in filteredModelKits"
              :key="`${modelkit.repository}:${modelkit.tag || modelkit.digest}`"
              class="group border-b border-gray-03/40 hover:bg-elevation-02 cursor-pointer transition-colors duration-150"
              :class="{ 'border-gold! bg-gold/5': modelkitStore.isModelKitPinned(`${modelkit.repository}:${modelkit.tag}`) }"
              @click="viewDetails(modelkit)">
              <td class="py-3 pr-8 text-off-white truncate max-w-70">{{ modelkit.repository }}</td>
              <td class="py-3 pr-8 text-gray-01">{{ modelkit.tag || 'latest' }}</td>
              <td class="py-3 pr-8 text-gray-01">{{ modelkit.maintainer || '-' }}</td>
              <td class="py-3 pr-8 text-gray-01">{{ modelkit.size }}</td>
              <td class="py-3 pr-8 text-gray-02">{{ formatDigest(modelkit.digest) }}</td>
              <td class="py-3 text-right">
                <div
                  class="flex items-center justify-end gap-1 transition-opacity duration-150">
                  <button
                    class="button-action button-small opacity-0 group-hover:opacity-100"
                    title="Pin ModelKit"
                    @click.stop.prevent="togglePin(modelkit)">
                    <Component
                      :is="modelkitStore.isModelKitPinned(`${modelkit.repository}:${modelkit.tag}`) ? IconPinned : IconPin"
                      class="size-3.5" />
                    {{ modelkitStore.isModelKitPinned(`${modelkit.repository}:${modelkit.tag}`) ? 'Unpin' : 'Pin' }}
                  </button>
                  <button
                    class="button-action button-small opacity-0 group-hover:opacity-100"
                    title="Add a new tag"
                    @click.stop.prevent="openTagModal(modelkit)">
                    <IconTag class="size-3.5" />
                    Tag
                  </button>
                  <button
                    :disabled="kitStore.removing === modelkit.digest"
                    class="button-action-danger button-small opacity-0 group-hover:opacity-100"
                    title="Remove from local storage"
                    @click.stop.prevent="openDeleteConfirm(modelkit)">
                    <IconSpinner v-if="kitStore.removing === modelkit.digest" class="size-3.5 animate-spin" />
                    <IconDelete v-else class="size-3.5" />
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <PruneConfirmModal
      :open="showPruneConfirm"
      @close="showPruneConfirm = false"
      @confirm="confirmPrune" />

    <PullModal
      :open="showPullModal"
      :error="pullError"
      :loading="pulling"
      @close="closePullModal"
      @submit="confirmPull" />

    <PackModal
      :open="showPackModal"
      :draft-name="selectedDraft?.name"
      :registries="registries"
      :error="packError"
      :loading="draftStore.packing !== null"
      @close="closePackModal"
      @submit="confirmPack" />

    <TagModal
      :open="showTagModal"
      :repository="selectedModelKit?.repository ?? ''"
      :tag="selectedModelKit?.tag ?? ''"
      :error="tagError"
      :loading="kitStore.tagging !== null"
      @close="closeTagModal"
      @submit="handleTag" />

    <DeleteModelKitModal
      :open="showDeleteConfirm"
      :name="selectedModelKit?.name"
      :tag="selectedModelKit?.tag || 'latest'"
      @close="cancelDelete"
      @confirm="confirmDelete" />
  </div>
</template>
