<script setup lang="ts">
import { computed } from 'vue'

import IconExternalLink from '~icons/ri/external-link-line'
import IconFile from '~icons/ri/file-2-line'

import { useShiki } from '../../composables/useShiki'
import { useFileExplorerStore } from '../../stores/fileExplorerStore'

const store = useFileExplorerStore()
const { highlightCode, highlighter } = useShiki()

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'py', 'js', 'ts', 'jsx', 'tsx', 'json', 'yaml', 'yml',
  'toml', 'sh', 'bash', 'zsh', 'html', 'css', 'scss', 'sass', 'less',
  'vue', 'svelte', 'xml', 'csv', 'conf', 'cfg', 'ini', 'log', 'rs',
  'go', 'java', 'c', 'cpp', 'h', 'hpp', 'sql', 'graphql', 'gql',
  'proto', 'tf', 'hcl', 'dockerfile', 'makefile', 'kitfile',
  'gitignore', 'dockerignore', 'env', 'lock',
])

const SHIKI_LANG: Record<string, string> = {
  py: 'python',
  js: 'javascript',
  ts: 'typescript',
  jsx: 'javascript',
  tsx: 'typescript',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  json: 'json',
  html: 'html',
  css: 'css',
  md: 'markdown',
  rs: 'rust',
  go: 'go',
  java: 'java',
  dockerfile: 'dockerfile',
  kitfile: 'yaml',
}

function getExt(name: string): string {
  const lower = name.toLowerCase()
  if (['dockerfile', 'kitfile', 'makefile'].includes(lower)) {
    return lower
  }
  const parts = lower.split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

const ext = computed(() => {
  if (!store.selectedFile) {
    return ''
  }
  return getExt(store.selectedFile.node.name)
})

const isTextFile = computed(() => {
  if (!store.selectedFile) {
    return false
  }
  if (!ext.value) {
    return false
  }
  const name = store.selectedFile.node.name.toLowerCase()
  if (name.startsWith('.') && TEXT_EXTENSIONS.has(name.slice(1))) {
    return true
  }
  return TEXT_EXTENSIONS.has(ext.value)
})

const fileContent = computed(() => {
  if (!store.selectedFile) {
    return null
  }
  return store.getFileContent(store.selectedFile.node.fullPath)
})

const highlighted = computed(() => {
  if (!fileContent.value || !highlighter.value || !store.selectedFile) {
    return null
  }
  const lang = SHIKI_LANG[ext.value] ?? 'text'
  try {
    return highlightCode(fileContent.value, lang)
  } catch {
    return null
  }
})

function openWithSystem() {
  if (!store.selectedFile) {
    return
  }
  store.openWithSystemApp(store.selectedFile.node.fullPath)
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Empty state -->
    <div v-if="!store.selectedFile" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <IconFile class="size-14 mx-auto mb-3 text-gray-03" />
        <p class="text-sm text-gray-02">Select a file to preview</p>
      </div>
    </div>

    <template v-else>
      <!-- File header bar -->
      <div class="flex items-center gap-3 px-5 py-2.5 border-b border-gray-03 bg-elevation-02 shrink-0">
        <IconFile class="size-4 text-gray-02 shrink-0" />
        <span class="font-mono text-xs text-gray-01 truncate flex-1">
          {{ store.selectedFile.node.relativePath }}
        </span>
        <button
          v-if="!isTextFile"
          class="flex items-center gap-1.5 text-xs text-gray-01 hover:text-gold transition-colors border border-gray-03 hover:border-gray-02 px-2 py-1 shrink-0"
          @click="openWithSystem">
          <IconExternalLink class="size-3" />
          Open with system app
        </button>
      </div>

      <!-- Text file: syntax-highlighted or plain -->
      <div v-if="isTextFile && fileContent !== null" class="flex-1 overflow-auto">
        <!-- Waiting for Shiki to load -->
        <pre
          v-if="!highlighter"
          class="text-xs font-mono text-off-white p-4 whitespace-pre-wrap break-all leading-relaxed">{{ fileContent }}</pre>
        <!-- Highlighted -->
        <div
          v-else-if="highlighted"
          class="shiki-wrap"
          v-html="highlighted" />
        <!-- Fallback plain text -->
        <pre
          v-else
          class="text-xs font-mono text-off-white p-4 whitespace-pre-wrap break-all leading-relaxed">{{ fileContent }}</pre>
      </div>

      <!-- Binary / non-text file -->
      <div v-else-if="!isTextFile" class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <IconFile class="size-14 mx-auto mb-3 text-gray-03" />
          <p class="text-sm text-gray-02 mb-1">Binary file</p>
          <p class="text-xs text-gray-03 font-mono mb-4">{{ store.selectedFile.node.name }}</p>
          <button
            class="flex items-center gap-1.5 text-xs text-gray-01 hover:text-gold transition-colors border border-gray-03 hover:border-gray-02 px-3 py-1.5 mx-auto"
            @click="openWithSystem">
            <IconExternalLink class="size-3.5" />
            Open with system app
          </button>
        </div>
      </div>

      <!-- Loading content -->
      <div v-else class="flex-1 flex items-center justify-center">
        <span class="text-sm text-gray-02">Loading…</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
@reference "../../style.css";

/* Let Shiki render its own background; just make it fill the container */
.shiki-wrap :deep(pre) {
  padding: 1rem;
  overflow: auto;
  font-size: 0.75rem;
  line-height: 1.6;
  background: transparent !important;
  min-height: 100%;
}

.shiki-wrap :deep(code) {
  background: transparent;
  font-size: inherit;
}
</style>
