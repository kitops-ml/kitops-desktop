<script setup lang="ts">
import { computed } from 'vue'

import IconAdd from '~icons/ri/add-line'
import IconChevronRight from '~icons/ri/arrow-right-s-line'
import IconExternalLink from '~icons/ri/external-link-line'
import IconFile from '~icons/ri/file-line'
import IconFolder from '~icons/ri/folder-line'
import IconFolderOpen from '~icons/ri/folder-open-line'
import IconSpinner from '~icons/ri/loader-4-line'

import type { FileNode } from '../../stores/fileExplorerStore'
import { useFileExplorerStore } from '../../stores/fileExplorerStore'
// Self-reference for recursion — Vue 3 resolves this automatically in <script setup>
import FileTreeNode from './FileTreeNode.vue'

const props = defineProps<{
  repository: string
  tag: string
  digest?: string
  node: FileNode
  depth: number
}>()

const store = useFileExplorerStore()

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'py', 'js', 'ts', 'jsx', 'tsx', 'json', 'yaml', 'yml',
  'toml', 'sh', 'bash', 'zsh', 'html', 'css', 'scss', 'sass', 'less',
  'vue', 'svelte', 'xml', 'csv', 'conf', 'cfg', 'ini', 'log', 'rs',
  'go', 'java', 'c', 'cpp', 'h', 'hpp', 'sql', 'graphql', 'gql',
  'proto', 'tf', 'hcl', 'dockerfile', 'makefile', 'kitfile',
  'gitignore', 'dockerignore', 'env', 'lock',
])

const key = computed(() =>
  store.nodeKey(props.repository, props.tag, props.node.relativePath, props.digest),
)
const isExpanded = computed(() => store.isExpanded(key.value))
const isLoading = computed(() => store.isLoading(key.value))
const isSelected = computed(() =>
  store.selectedFile?.node.fullPath === props.node.fullPath,
)
const children = computed(() => store.getChildren(key.value))

const ext = computed(() => {
  const lower = props.node.name.toLowerCase()
  if (['dockerfile', 'kitfile', 'makefile'].includes(lower)) {
    return lower
  }
  const parts = lower.split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
})

const isTextFile = computed(() => {
  if (!ext.value) {
    return false
  }
  const name = props.node.name.toLowerCase()
  // dot-files like .gitignore, .env
  if (name.startsWith('.') && TEXT_EXTENSIONS.has(name.slice(1))) {
    return true
  }
  return TEXT_EXTENSIONS.has(ext.value)
})

function handleClick() {
  if (props.node.isDirectory) {
    store.toggleFolder(props.repository, props.tag, props.node, props.digest)
  } else {
    store.selectFile(props.repository, props.tag, props.node)
  }
}

function handleAddFiles(e: MouseEvent) {
  e.stopPropagation()
  store.addFiles(props.repository, props.tag, props.digest, props.node)
}

function handleOpenExternal(e: MouseEvent) {
  e.stopPropagation()
  store.openWithSystemApp(props.node.fullPath)
}
</script>

<template>
  <div>
    <button
      class="file-row group"
      :class="{ 'is-selected': isSelected }"
      :style="{ paddingLeft: `${depth * 14 + 6}px` }"
      @click="handleClick">
      <!-- Expand arrow (directories only) -->
      <span class="size-4 shrink-0 flex items-center justify-center">
        <IconSpinner v-if="node.isDirectory && isLoading" class="size-3.5 animate-spin text-gray-02" />
        <IconChevronRight
          v-else-if="node.isDirectory"
          class="size-4 text-gray-03 transition-transform duration-150"
          :class="{ 'rotate-90': isExpanded }" />
      </span>

      <!-- Icon -->
      <IconFolderOpen v-if="node.isDirectory && isExpanded" class="size-4 shrink-0 text-gold" />
      <IconFolder v-else-if="node.isDirectory" class="size-4 shrink-0 text-gray-02 group-hover:text-gold transition-colors" />
      <IconFile v-else class="size-4 shrink-0" :class="isSelected ? 'text-gold' : 'text-gray-02'" />

      <!-- Name -->
      <span class="flex-1 truncate font-mono text-xs" :class="isSelected ? 'text-gold' : 'text-gray-01 group-hover:text-off-white'">
        {{ node.name }}
      </span>

      <!-- Hover actions -->
      <span class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          v-if="node.isDirectory"
          class="p-0.5 text-gray-02 hover:text-gold transition-colors"
          title="Add files or folders here"
          @click="handleAddFiles">
          <IconAdd class="size-3" />
        </button>
        <button
          v-else-if="!isTextFile"
          class="p-0.5 text-gray-02 hover:text-gold transition-colors"
          title="Open with system application"
          @click="handleOpenExternal">
          <IconExternalLink class="size-3" />
        </button>
      </span>
    </button>

    <!-- Recursive children -->
    <template v-if="node.isDirectory && isExpanded">
      <FileTreeNode
        v-for="child in children"
        :key="child.relativePath"
        :repository="repository"
        :tag="tag"
        :digest="digest"
        :node="child"
        :depth="depth + 1" />
      <div
        v-if="children.length === 0 && !isLoading"
        class="text-xs text-gray-03 py-0.5 italic"
        :style="{ paddingLeft: `${(depth + 1) * 14 + 24}px` }">
        Empty folder
      </div>
    </template>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.file-row {
  @apply w-full flex items-center gap-1.5 py-0.5 pr-2 text-left transition-colors;
}

.file-row:hover {
  @apply bg-elevation-04;
}

.file-row.is-selected {
  @apply bg-elevation-04;
}
</style>
