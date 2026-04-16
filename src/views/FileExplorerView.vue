<script setup lang="ts">
import { onMounted, ref } from 'vue'

import IconAdd from '~icons/ri/add-line'
import IconChevronRight from '~icons/ri/arrow-right-s-line'
import IconFolder from '~icons/ri/folder-line'
import IconFolderOpen from '~icons/ri/folder-open-line'
import IconSpinner from '~icons/ri/loader-4-line'
import IconTag from '~icons/ri/price-tag-3-line'
import IconRefresh from '~icons/ri/refresh-line'
import IconSave from '~icons/ri/save-line'

import FilePreview from '../components/file-explorer/FilePreview.vue'
import FileTreeNode from '../components/file-explorer/FileTreeNode.vue'
import SaveAsTagModal from '../components/file-explorer/SaveAsTagModal.vue'
import { useFileExplorerStore } from '../stores/fileExplorerStore'
import { useKitStore } from '../stores/kitStore'

const kitStore = useKitStore()
const store = useFileExplorerStore()

interface SaveContext {
  repository: string
  tag: string
  digest?: string
}

const saveModalOpen = ref(false)
const saveContext = ref<SaveContext | null>(null)

function openSaveModal(ctx: SaveContext) {
  saveContext.value = ctx
  saveModalOpen.value = true
}

onMounted(() => {
  if (kitStore.modelKits.length === 0) {
    kitStore.fetchModelKits()
  }
})
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <header class="px-10 bg-elevation-02 border-b border-gray-03 h-28 shrink-0">
      <div class="flex justify-between items-center h-full">
        <div>
          <h1 class="text-3xl font-extrabold mb-1">File Explorer</h1>
          <p class="text-gray-01 text-sm">Browse, edit and repack your local modelkits</p>
        </div>
        <button
          class="flex items-center gap-2 text-sm text-gray-01 hover:text-off-white border border-gray-03 hover:border-gray-02 px-3 py-2 transition-colors disabled:opacity-50"
          :disabled="kitStore.loading"
          @click="kitStore.fetchModelKits()">
          <IconRefresh class="size-4" :class="{ 'animate-spin': kitStore.loading }" />
          Refresh
        </button>
      </div>
    </header>

    <!-- Split pane -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left: tree panel -->
      <aside class="w-76 shrink-0 bg-elevation-02 border-r border-gray-03 flex flex-col overflow-hidden">
        <div class="px-4 py-2.5 border-b border-gray-03 shrink-0">
          <span class="text-xs text-gray-02 uppercase tracking-widest font-semibold">Local ModelKits</span>
        </div>

        <div class="flex-1 overflow-y-auto py-1">
          <!-- Empty state -->
          <div
            v-if="kitStore.modelKits.length === 0 && !kitStore.loading"
            class="px-4 py-8 text-center">
            <p class="text-sm text-gray-02">No local modelkits found.</p>
            <p class="text-xs text-gray-03 mt-1">Pull a modelkit to get started.</p>
          </div>

          <!-- Initial loading -->
          <div
            v-else-if="kitStore.loading && kitStore.modelKits.length === 0"
            class="flex items-center justify-center py-8">
            <IconSpinner class="size-5 animate-spin text-gray-02" />
          </div>

          <!-- Repository groups -->
          <template v-for="group in store.repositoryGroups" :key="group.repository">
            <!-- Repository row -->
            <button
              class="repo-row group"
              @click="store.toggleRepo(group.repository)">
              <IconChevronRight
                class="size-4 text-gray-03 transition-transform duration-150 shrink-0"
                :class="{ 'rotate-90': store.isExpanded(store.repoKey(group.repository)) }" />
              <IconFolderOpen
                v-if="store.isExpanded(store.repoKey(group.repository))"
                class="size-4 text-gold shrink-0" />
              <IconFolder v-else class="size-4 text-gray-02 group-hover:text-gold transition-colors shrink-0" />
              <span class="flex-1 truncate text-xs font-mono text-off-white">{{ group.repository }}</span>
              <span class="text-xs text-gray-03 tabular-nums shrink-0 pr-1">{{ group.kits.length }}</span>
            </button>

            <!-- Tags within repository -->
            <template v-if="store.isExpanded(store.repoKey(group.repository))">
              <div v-for="kit in group.kits" :key="kit.digest">
                <!-- Tag row -->
                <button
                  class="tag-row group"
                  @click="store.toggleTag(group.repository, kit.tag, kit.digest)">
                  <!-- Expand indicator -->
                  <span class="size-4 flex items-center justify-center shrink-0">
                    <IconSpinner
                      v-if="store.isLoading(store.tagKey(group.repository, kit.tag, kit.digest))"
                      class="size-3.5 animate-spin text-gray-02" />
                    <IconChevronRight
                      v-else
                      class="size-4 text-gray-03 transition-transform duration-150"
                      :class="{ 'rotate-90': store.isExpanded(store.tagKey(group.repository, kit.tag, kit.digest)) }" />
                  </span>

                  <IconTag
                    class="size-3.5 shrink-0 transition-colors"
                    :class="kit.tag && kit.tag !== '<none>'
                      ? 'text-gray-02 group-hover:text-gold'
                      : 'text-gray-03'" />

                  <span
                    class="flex-1 truncate text-xs font-mono transition-colors"
                    :class="kit.tag && kit.tag !== '<none>'
                      ? 'text-gray-01 group-hover:text-off-white'
                      : 'text-gray-03 italic'">
                    {{ kit.tag && kit.tag !== '<none>' ? kit.tag : `@${kit.digest.slice(7, 19)}` }}
                  </span>

                  <!-- Actions (visible when tag is expanded) -->
                  <template v-if="store.isExpanded(store.tagKey(group.repository, kit.tag, kit.digest))">
                    <button
                      class="opacity-0 group-hover:opacity-100 p-0.5 text-gray-02 hover:text-gold transition-all shrink-0"
                      title="Add files to root"
                      @click.stop="store.addFiles(group.repository, kit.tag, kit.digest)">
                      <IconAdd class="size-3.5" />
                    </button>
                    <button
                      class="opacity-0 group-hover:opacity-100 p-0.5 text-gray-02 hover:text-gold transition-all shrink-0"
                      title="Pack as new tag"
                      @click.stop="openSaveModal({ repository: group.repository, tag: kit.tag, digest: kit.digest })">
                      <IconSave class="size-3.5" />
                    </button>
                  </template>
                </button>

                <!-- File tree for this tag -->
                <template v-if="store.isExpanded(store.tagKey(group.repository, kit.tag, kit.digest))">
                  <FileTreeNode
                    v-for="node in store.getChildren(store.tagKey(group.repository, kit.tag, kit.digest))"
                    :key="node.relativePath"
                    :repository="group.repository"
                    :tag="kit.tag"
                    :digest="kit.digest"
                    :node="node"
                    :depth="1" />
                  <div
                    v-if="store.getChildren(store.tagKey(group.repository, kit.tag, kit.digest)).length === 0
                      && !store.isLoading(store.tagKey(group.repository, kit.tag, kit.digest))"
                    class="pl-14 py-1 text-xs text-gray-03 italic">
                    Empty
                  </div>
                </template>
              </div>
            </template>
          </template>
        </div>
      </aside>

      <!-- Right: preview panel -->
      <main class="flex-1 bg-elevation-01 overflow-hidden">
        <FilePreview />
      </main>
    </div>

    <!-- Save as new tag modal -->
    <SaveAsTagModal
      v-if="saveContext"
      :open="saveModalOpen"
      :repository="saveContext.repository"
      :source-tag="saveContext.tag"
      :source-digest="saveContext.digest"
      @close="saveModalOpen = false" />
  </div>
</template>

<style scoped>
@reference "../style.css";

.repo-row {
  @apply w-full flex items-center gap-1.5 px-2 py-1.5 text-left transition-colors;
}

.repo-row:hover {
  @apply bg-elevation-04;
}

.tag-row {
  @apply w-full flex items-center gap-1.5 pl-5 pr-2 py-1 text-left transition-colors;
}

.tag-row:hover {
  @apply bg-elevation-04;
}
</style>
