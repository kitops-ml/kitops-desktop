import type { Kitfile } from '@kitops/kitops-ts'
import { type ComputedRef, type Ref,ref } from 'vue'
import type { Router } from 'vue-router'

import { kitfileToYaml } from '../services/kitfile'
import { useKitStore } from '../stores/kitStore'
import { useLogStore } from '../stores/logStore'
import { useUnpackedKitfileStore } from '../stores/unpackedKitfileStore'
import { toRelativePath as toRelativePathPure } from '../utils'
import { useNotification } from './useNotification'

interface SaveOptions {
  formData: Ref<Kitfile>
  showModelSection: Ref<boolean>
  kitfilePath: Ref<string | null>
  kitfileBaseDir: ComputedRef<string | undefined>
  allUsedPaths: ComputedRef<string[]>
  isEditing: ComputedRef<boolean>
  isPathOutsideDir: (path: string) => boolean
  editDir: string | undefined
  router: Router
}

export function useKitfileSave(options: SaveOptions) {
  const {
    formData,
    showModelSection,
    kitfilePath,
    kitfileBaseDir,
    allUsedPaths,
    isEditing,
    isPathOutsideDir,
    editDir,
    router,
  } = options

  const notification = useNotification()
  const kitStore = useKitStore()
  const logStore = useLogStore()
  const draftStore = useUnpackedKitfileStore()

  const saving = ref(false)
  const showPackModal = ref(false)
  const packError = ref<string | null>(null)
  const packing = ref(false)

  function toRelativePath(path: string, baseDir?: string): string {
    const kitfileBase = baseDir || kitfileBaseDir.value
    if (!kitfileBase) {
      return path
    }
    return toRelativePathPure(path, kitfileBase)
  }

  function makeAllPathsRelative(baseDir?: string) {
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

  async function saveKitfile(): Promise<void> {
    saving.value = true
    try {
      let savePath = kitfilePath.value

      if (isEditing.value) {
        makeAllPathsRelative()
        if (allUsedPaths.value.some(p => isPathOutsideDir(p))) {
          notification.error('Some paths are outside the kitfile directory. Fix them before saving.')
          return
        }
        await window.kitops.fs.writeFile(savePath, kitfileToYaml(formData.value, showModelSection.value))
      } else {
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
          await window.kitops.fs.writeFile(savePath, kitfileToYaml(formData.value, showModelSection.value))
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

  return { saving, showPackModal, packError, packing, saveKitfile, handlePackSubmit }
}
