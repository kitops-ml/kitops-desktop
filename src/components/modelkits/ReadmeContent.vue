<script setup lang="ts">
import { type Doc } from '@kitops/kitops-ts'
import { marked } from 'marked'
import { onMounted, ref, watch } from 'vue'

import IconSpinner from '~icons/custom-icons/spinner'

import { useShiki } from '../../composables/useShiki'
import { useUnpackCache } from '../../composables/useUnpackCache'
import { isBinaryContent } from '../../utils'

const props = defineProps<{
  repository: string
  tag: string
  docs: Doc[]
}>()

const { highlighter } = useShiki()
const { unpackRepository } = useUnpackCache()

const content = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const html = ref('')

marked.setOptions({ gfm: true, breaks: true })

const renderer = {
  code({ text, lang }: { text: string; lang?: string }) {
    if (highlighter.value) {
      return highlighter.value.codeToHtml(text, { lang: lang || 'text', theme: 'vitesse-dark' })
    }
    return `<pre><code>${text}</code></pre>`
  },
}
marked.use({ renderer })

function stripFrontmatter(md: string): string {
  return md.replace(/^---[\r\n][\s\S]*?[\r\n]---[\r\n]?/, '')
}

watch([content, highlighter], () => {
  html.value = content.value ? marked(stripFrontmatter(content.value)) as string : ''
}, { immediate: true })

async function tryReadFile(filePath: string): Promise<string | null> {
  if (!await window.kitops.fs.fileExists(filePath)) {
    return null
  }
  const result = await window.kitops.fs.readFile(filePath)
  return result.success ? result.content : null
}

async function fetchReadme() {
  loading.value = true
  error.value = null

  try {
    const unpackDir = await unpackRepository(props.repository, props.tag, 'docs')

    const readmeNames = ['README.md', 'readme.md', 'Readme.md', 'README', 'readme', 'README.txt', 'readme.txt']

    for (const doc of props.docs) {
      const docPath = doc.path.replace(/^\.\//, '')
      if (docPath.toLowerCase().includes('readme')) {
        const found = await tryReadFile(window.kitops.fs.pathJoin(unpackDir, docPath))
        if (found) {
          content.value = found
          return
        }
      }
      // If the doc entry points to a directory, search for README inside it
      if (docPath.endsWith('/')) {
        for (const name of readmeNames) {
          const found = await tryReadFile(window.kitops.fs.pathJoin(unpackDir, docPath, name))
          if (found) {
            content.value = found
            return
          }
        }
      }
    }

    for (const name of readmeNames) {
      const found = await tryReadFile(window.kitops.fs.pathJoin(unpackDir, name))
      if (found) {
        content.value = found
        return
      }
    }

    content.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function handleLinkClick(e: MouseEvent) {
  const anchor = (e.target as Element).closest('a')
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

onMounted(fetchReadme)
</script>

<template>
  <div v-if="loading" class="flex items-center gap-3 text-gray-01">
    <IconSpinner class="size-5 animate-spin" />
    <span class="text-sm">Loading README...</span>
  </div>

  <div v-else-if="error" class="text-red-400 text-sm">
    Failed to load README: {{ error }}
  </div>

  <div v-else-if="content && isBinaryContent(content)" class="text-gray-02 text-sm italic">
    Preview not available
  </div>

  <div v-else-if="content" class="readme-content prose prose-invert max-w-none" @click="handleLinkClick" v-html="html"></div>

  <div v-else class="text-gray-02 text-sm italic">
    No README file found in this ModelKit.
  </div>
</template>

<style scoped>
@reference "../../style.css";

.readme-content {
  @apply text-off-white leading-relaxed;
}

.readme-content :deep(h1) {
  @apply text-2xl font-bold text-off-white mt-0 mb-4 pb-2 border-b border-gray-03;
}

.readme-content :deep(h2) {
  @apply text-xl font-bold text-off-white mt-6 mb-3 pb-2 border-b border-gray-03;
}

.readme-content :deep(h3) {
  @apply text-lg font-semibold text-off-white mt-5 mb-2;
}

.readme-content :deep(h4) {
  @apply text-base font-semibold text-off-white mt-4 mb-2;
}

.readme-content :deep(p) {
  @apply my-3 text-off-white;
}

.readme-content :deep(a) {
  @apply text-gold hover:text-gold underline;
}

.readme-content :deep(ul),
.readme-content :deep(ol) {
  @apply my-3 pl-6;
}

.readme-content :deep(ul) {
  @apply list-disc;
}

.readme-content :deep(ol) {
  @apply list-decimal;
}

.readme-content :deep(li) {
  @apply my-1 text-off-white;
}

.readme-content :deep(code) {
  @apply font-mono text-sm bg-elevation-03 px-1.5 py-0.5 text-gold;
}

.readme-content :deep(pre) {
  @apply my-4 p-4 bg-elevation-01 overflow-x-auto border border-gray-03;
}

.readme-content :deep(pre code) {
  @apply bg-transparent p-0;
}

.readme-content :deep(blockquote) {
  @apply my-4 pl-4 border-l-4 border-gray-03 text-gray-01 italic;
}

.readme-content :deep(hr) {
  @apply my-6 border-gray-03;
}

.readme-content :deep(table) {
  @apply my-4 w-full border-collapse;
}

.readme-content :deep(th),
.readme-content :deep(td) {
  @apply border border-gray-03 px-3 py-2 text-left;
}

.readme-content :deep(th) {
  @apply bg-elevation-03 font-semibold text-off-white;
}

.readme-content :deep(td) {
  @apply text-off-white;
}

.readme-content :deep(img) {
  @apply max-w-full h-auto my-4;
}

.readme-content :deep(strong) {
  @apply font-semibold text-off-white;
}

.readme-content :deep(em) {
  @apply italic;
}

.readme-content :deep(.shiki) {
  background-color: transparent !important;
  ;
}
</style>
