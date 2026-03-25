<script setup lang="ts">
import { marked } from 'marked'
import { computed, nextTick, ref, watch } from 'vue'

import IconSpinner from '~icons/custom-icons/spinner'
import IconChevron from '~icons/ri/arrow-right-s-line'
import IconFolder from '~icons/ri/folder-2-line'
import IconPrompt from '~icons/ri/terminal-box-line'

import { useShiki } from '../../composables/useShiki'
import { useUnpackCache } from '../../composables/useUnpackCache'
import { isBinaryContent, isPathFolder } from '../../utils'
import CopyButton from '../CopyButton.vue'

const props = defineProps<{
  items: Array<{ path: string; description?: string }>
  repository: string
  tag: string
}>()

const { highlighter } = useShiki()
const { unpackRepository } = useUnpackCache()

const selected = ref<{ path: string; description?: string } | null>(props.items[0] ?? null)
const content = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const baseHtml = ref('')
const templateVars = ref<string[]>([])
const varValues = ref<Record<string, string>>({})
const editingVar = ref<string | null>(null)
const editingVarWidth = ref<number | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const expandedFolders = ref<Set<string>>(new Set())
const folderContents = ref<Record<string, string[]>>({})

const estimatedTokens = computed(() =>
  content.value ? Math.ceil(content.value.length / 4) : 0,
)

const resolvedContent = computed(() => {
  if (!content.value) {
    return ''
  }
  return content.value.replace(
    /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
    (_, varName) => varValues.value[varName]?.trim() || `{{${varName}}}`,
  )
})

const html = computed(() => {
  if (!baseHtml.value) {
    return ''
  }
  return baseHtml.value.replace(
    /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
    (_, varName: string) => {
      if (editingVar.value === varName) {
        const escapedVal = (varValues.value[varName] ?? '')
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        const widthStyle = editingVarWidth.value ? ` style="width:${editingVarWidth.value}px"` : ''
        return `<input class="template-var-input" data-var="${varName}"${widthStyle} value="${escapedVal}" />`
      }
      const val = varValues.value[varName]?.trim()
      if (val) {
        const escaped = val.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        return `<span class="template-var-filled" data-var="${varName}" title="Click to edit">${escaped}</span>`
      }
      return `<span class="template-var" data-var="${varName}" title="Click to fill">{{${varName}}}</span>`
    },
  )
})

const renderer = {
  code({ text, lang }: { text: string; lang?: string }) {
    const safeLang = lang && /^[a-zA-Z0-9_+#-]+$/.test(lang) ? lang : 'text'
    if (highlighter.value) {
      return highlighter.value.codeToHtml(text, { lang: safeLang, theme: 'vitesse-dark' })
    }
    return `<pre><code>${text}</code></pre>`
  },
}
marked.use({ renderer })

function extractVariables(text: string): string[] {
  const matches = [...text.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)]
  return [...new Set(matches.map((m) => m[1]))]
}

watch([content, highlighter], () => {
  if (content.value) {
    templateVars.value = extractVariables(content.value)
    baseHtml.value = marked(content.value) as string
  } else {
    templateVars.value = []
    baseHtml.value = ''
  }
}, { immediate: true })

async function loadContent(relativePath: string) {
  loading.value = true
  error.value = null
  content.value = null
  varValues.value = {}
  editingVar.value = null

  try {
    const unpackDir = await unpackRepository(props.repository, props.tag, 'prompts')
    const filePath = window.kitops.fs.pathJoin(unpackDir, relativePath.replace(/^\.\//, ''))

    if (!await window.kitops.fs.fileExists(filePath)) {
      content.value = null
      return
    }

    const result = await window.kitops.fs.readFile(filePath)
    content.value = result.success ? result.content : null
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function selectPrompt(prompt: { path: string; description?: string }) {
  selected.value = prompt
  await loadContent(prompt.path)
}

async function toggleFolder(folder: { path: string; description?: string }) {
  const folderPath = folder.path
  const next = new Set(expandedFolders.value)

  if (next.has(folderPath)) {
    next.delete(folderPath)
    expandedFolders.value = next
    return
  }

  next.add(folderPath)
  expandedFolders.value = next

  if (!(folderPath in folderContents.value)) {
    try {
      const unpackDir = await unpackRepository(props.repository, props.tag, 'prompts')
      const dirPath = window.kitops.fs.pathJoin(unpackDir, folderPath.replace(/^\.\//, '').replace(/\/$/, ''))
      const result = await window.kitops.fs.listDir(dirPath)

      if (result.success) {
        const files: string[] = result.files
          .filter((f: { name: string; isDirectory: boolean }) => !f.isDirectory)
          .map((f: { name: string }) => f.name)
          .sort()
        folderContents.value = { ...folderContents.value, [folderPath]: files }

        if (files.length > 0) {
          await selectFolderFile(folderPath, files[0])
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  } else {
    const files = folderContents.value[folderPath] ?? []
    if (files.length > 0) {
      await selectFolderFile(folderPath, files[0])
    }
  }
}

async function selectFolderFile(folderPath: string, fileName: string) {
  const relativePath = `${folderPath.replace(/\/$/, '')}/${fileName}`
  selected.value = { path: relativePath }
  await loadContent(relativePath)
}

function startEditing(varName: string, triggerEl?: HTMLElement | null) {
  editingVarWidth.value = triggerEl?.offsetWidth ?? null
  editingVar.value = varName
  nextTick(() => {
    const input = contentRef.value?.querySelector<HTMLInputElement>(`.template-var-input[data-var="${varName}"]`)
    input?.focus()
    input?.select()
  })
}

function commitEditing(input: HTMLInputElement) {
  const varName = input.getAttribute('data-var')
  if (!varName) {
    return
  }
  const val = input.value.trim()
  if (val) {
    varValues.value = { ...varValues.value, [varName]: val }
  } else {
    const next = { ...varValues.value }
    delete next[varName]
    varValues.value = next
  }
  editingVar.value = null
}

function handleContentClick(e: MouseEvent) {
  const target = e.target as Element

  const varSpan = target.closest<HTMLElement>('.template-var, .template-var-filled')
  if (varSpan) {
    const varName = varSpan.getAttribute('data-var')
    if (varName) {
      startEditing(varName, varSpan)
    }
    return
  }

  const anchor = target.closest('a')
  if (!anchor) {
    return
  }
  const href = anchor.getAttribute('href')
  if (!href || href.startsWith('#')) {
    return
  }
  e.preventDefault()
  window.kitops.shell.openExternal(href)
}

function handleContentBlur(e: FocusEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('template-var-input')) {
    commitEditing(target as HTMLInputElement)
  }
}

function handleContentKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (!target.classList.contains('template-var-input')) {
    return
  }
  const input = target as HTMLInputElement
  if (e.key === 'Escape') {
    editingVar.value = null
    return
  }
  if (e.key === 'Enter') {
    commitEditing(input)
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    const varName = input.getAttribute('data-var')
    if (!varName) {
      return
    }
    const idx = templateVars.value.indexOf(varName)
    const nextVar = templateVars.value[e.shiftKey ? idx - 1 : idx + 1]
    commitEditing(input)
    if (nextVar) {
      nextTick(() => {
        const nextEl = contentRef.value?.querySelector<HTMLElement>(
          `.template-var[data-var="${nextVar}"], .template-var-filled[data-var="${nextVar}"]`,
        )
        startEditing(nextVar, nextEl)
      })
    }
  }
}

if (props.items.length > 0) {
  const first = props.items[0]
  if (isPathFolder(first.path)) {
    toggleFolder(first)
  } else {
    selectPrompt(first)
  }
}
</script>

<template>
  <div class="animate-in fade-in duration-200 flex min-h-75">
    <!-- File sidebar -->
    <div>
      <div class="w-60 shrink-0 flex flex-col pr-0 sticky top-12">
        <template v-for="prompt in items" :key="prompt.path">
          <button
            class="flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-150 border-l-2 hover:bg-elevation-03"
            :class="selected?.path === prompt.path ? 'bg-elevation-03 border-gold' : 'border-transparent'"
            @click="isPathFolder(prompt.path) ? toggleFolder(prompt) : selectPrompt(prompt)">
            <div class="text-layer-prompt shrink-0">
              <Component
                :is="isPathFolder(prompt.path) ? IconFolder : IconPrompt"
                class="size-5" />
            </div>
            <div class="flex flex-col gap-0.5 min-w-0 flex-1">
              <span
                class="text-sm font-medium truncate"
                :class="selected?.path === prompt.path ? 'text-off-white' : 'text-gray-01'">
                {{ prompt.path }}
              </span>
              <span v-if="prompt.description" class="text-xs text-gray-02 leading-snug line-clamp-2">{{ prompt.description }}</span>
            </div>
            <IconChevron
              v-if="isPathFolder(prompt.path)"
              class="size-4 shrink-0 text-gray-02 transition-transform duration-150"
              :class="expandedFolders.has(prompt.path) ? 'rotate-90' : ''" />
          </button>

          <template v-if="isPathFolder(prompt.path) && expandedFolders.has(prompt.path)">
            <button
              v-for="fileName in folderContents[prompt.path] ?? []"
              :key="fileName"
              class="flex items-center gap-2 pl-9 pr-3 py-2 text-left transition-all duration-150 border-l-2 hover:bg-elevation-03"
              :class="selected?.path === `${prompt.path.replace(/\/$/, '')}/${fileName}` ? 'bg-elevation-03 border-gold' : 'border-transparent'"
              @click="selectFolderFile(prompt.path, fileName)">
              <IconPrompt class="size-4 shrink-0 text-layer-prompt" />
              <span
                class="text-sm truncate"
                :class="selected?.path === `${prompt.path.replace(/\/$/, '')}/${fileName}` ? 'text-off-white' : 'text-gray-01'">
                {{ fileName }}
              </span>
            </button>
          </template>
        </template>
      </div>
    </div>

    <!-- Content area -->
    <div class="flex-1 min-w-0">
      <div v-if="loading" class="flex items-center gap-3 text-gray-01 justify-center py-10">
        <IconSpinner class="size-5 animate-spin" />
        <span class="text-sm">Loading...</span>
      </div>

      <div v-else-if="error" class="text-red-400 text-sm text-center py-10">{{ error }}</div>

      <div v-else-if="content && isBinaryContent(content)" class="text-gray-02 text-sm italic text-center py-10">
        Preview not available
      </div>

      <div
        v-else-if="content"
        class="animate-in fade-in duration-200 bg-surface border border-gray-03 overflow-hidden">
        <div class="flex justify-between items-center py-3 px-4 bg-elevation-03 border-b border-gray-03">
          <span class="text-xs text-gray-02" title="Rough estimation based on ~4 characters per token">~{{ estimatedTokens.toLocaleString() }} tokens (est.)</span>
          <div class="flex items-center">
            <CopyButton
              v-if="templateVars.length > 0"
              :content="resolvedContent"
              label="Copy resolved" />
            <CopyButton :content="content" />
          </div>
        </div>
        <div
          ref="contentRef"
          class="prompt-content prose prose-invert max-w-none bg-elevation-01 p-5"
          @click="handleContentClick"
          @blur.capture="handleContentBlur"
          @keydown.capture="handleContentKeydown"
          v-html="html" />
      </div>

      <div v-else class="text-gray-02 text-sm italic text-center py-10">
        No content available for this prompt.
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.prompt-content {
  @apply text-off-white leading-relaxed;
}

.prompt-content :deep(h1) {
  @apply text-2xl font-bold text-off-white mt-0 mb-4 pb-2 border-b border-gray-03;
}

.prompt-content :deep(h2) {
  @apply text-xl font-bold text-off-white mt-6 mb-3 pb-2 border-b border-gray-03;
}

.prompt-content :deep(h3) {
  @apply text-lg font-semibold text-off-white mt-5 mb-2;
}

.prompt-content :deep(p) {
  @apply my-3 text-off-white;
}

.prompt-content :deep(a) {
  @apply text-gold hover:text-gold underline;
}

.prompt-content :deep(ul),
.prompt-content :deep(ol) {
  @apply my-3 pl-6;
}

.prompt-content :deep(ul) {
  @apply list-disc;
}

.prompt-content :deep(ol) {
  @apply list-decimal;
}

.prompt-content :deep(li) {
  @apply my-1 text-off-white;
}

.prompt-content :deep(code) {
  @apply font-mono text-sm bg-elevation-03 px-1.5 py-0.5 text-gold;
}

.prompt-content :deep(pre) {
  @apply my-4 p-4 bg-elevation-01 overflow-x-auto border border-gray-03;
}

.prompt-content :deep(pre code) {
  @apply bg-transparent p-0;
}

.prompt-content :deep(blockquote) {
  @apply my-4 pl-4 border-l-4 border-gray-03 text-gray-01 italic;
}

.prompt-content :deep(hr) {
  @apply my-6 border-gray-03;
}

.prompt-content :deep(table) {
  @apply my-4 w-full border-collapse;
}

.prompt-content :deep(th),
.prompt-content :deep(td) {
  @apply border border-gray-03 px-3 py-2 text-left;
}

.prompt-content :deep(th) {
  @apply bg-elevation-03 font-semibold text-off-white;
}

.prompt-content :deep(strong) {
  @apply font-semibold text-off-white;
}

.prompt-content :deep(em) {
  @apply italic;
}

.prompt-content :deep(.shiki) {
  background-color: transparent !important;
}

/* Unfilled variable — gold highlight, pointer cursor */
.prompt-content :deep(.template-var) {
  @apply inline font-mono text-sm bg-gold/10 text-gold px-1.5 py-0.5 border border-gold/20 cursor-pointer transition-all duration-150;
}

.prompt-content :deep(.template-var:hover) {
  @apply bg-gold/25 border-gold/50 shadow-[0_0_0_2px_--theme(--color-gold/15%)];
}

/* Filled variable — subtle, still clickable to re-edit */
.prompt-content :deep(.template-var-filled) {
  @apply inline font-mono text-sm text-off-white bg-elevation-03 border border-gray-03 px-1.5 py-0.5 cursor-pointer transition-all duration-150;
}

.prompt-content :deep(.template-var-filled:hover) {
  @apply bg-elevation-02 border-gray-02 shadow-[0_0_0_2px_--theme(--color-gray-600/30%)];
}

/* Inline input that replaces the span during editing */
.prompt-content :deep(.template-var-input) {
  @apply inline font-mono text-sm text-off-white bg-elevation-01 px-1.5 py-0.5 border border-gold outline-none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-gold) 15%, transparent);
  min-width: 6ch;
}
</style>
