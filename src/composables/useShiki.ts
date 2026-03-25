import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { type Ref, ref } from 'vue'

// Module-level singletons — shared across all component instances so the highlighter is only initialized once
const highlighter: Ref<HighlighterCore | null> = ref(null)
const loading = ref(false)

async function init() {
  if (highlighter.value || loading.value) {
    return
  }
  loading.value = true
  highlighter.value = await createHighlighterCore({
    themes: [import('shiki/themes/vitesse-dark.mjs')],
    langs: [
      import('shiki/langs/yaml.mjs'),
      import('shiki/langs/json.mjs'),
      import('shiki/langs/javascript.mjs'),
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/python.mjs'),
      import('shiki/langs/bibtex.mjs'),
      import('shiki/langs/bash.mjs'),
      import('shiki/langs/shell.mjs'),
      import('shiki/langs/dockerfile.mjs'),
      import('shiki/langs/html.mjs'),
      import('shiki/langs/css.mjs'),
      import('shiki/langs/markdown.mjs'),
      import('shiki/langs/go.mjs'),
      import('shiki/langs/rust.mjs'),
      import('shiki/langs/java.mjs'),
    ],
    engine: createJavaScriptRegexEngine(),
  })
  loading.value = false
}

function highlightCode(code: string, lang: string): string {
  if (!highlighter.value) {
    return ''
  }
  return highlighter.value.codeToHtml(code, { lang, theme: 'vitesse-dark' })
}

export function useShiki() {
  init()
  return { highlighter, highlightCode }
}
