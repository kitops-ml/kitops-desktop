import { type Ref,ref } from 'vue'
import { parse as parseYaml, stringify } from 'yaml'

import type { KitfileFormData } from '../services/kitfile'
import { useNotification } from './useNotification'

export function useKitfileLoader(formData: Ref<KitfileFormData>, showModelSection: Ref<boolean>) {
  const notification = useNotification()
  const loadingKitfile = ref(false)
  const kitfilePath = ref<string | null>(null)
  const isNew = ref(true)

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

  return { loadingKitfile, kitfilePath, isNew, loadKitfileFromPath, loadTemplate }
}
