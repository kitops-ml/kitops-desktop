import type { FilterFlag } from '@kitops/kitops-ts'
import { ref } from 'vue'

import { useKitStore } from '../stores/kitStore'
import { cleanIpcError } from '../utils'
import { useNotification } from './useNotification'

export function useLayerExport() {
  const notification = useNotification()
  const kitStore = useKitStore()
  const exportingFilter = ref<string | null>(null)

  async function exportLayer(reference: string, filter: FilterFlag) {
    const result = await window.kitops.dialog.selectDirectory({
      title: 'Export to folder',
      buttonLabel: 'Export here',
    })
    if (!result.success || !result.path) {
      return
    }

    const dir = result.path
    const [repo, tag] = reference.split(':')
    const digest = kitStore.modelKits.find(k => k.repository === repo && k.tag === tag)?.digest

    exportingFilter.value = filter

    try {
      await window.kitops.kit.unpack(reference, { dir, filter, overwrite: true }, digest)
      notification.success(`Exported to ${dir}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      notification.error(`Export failed: ${cleanIpcError(message)}`)
    } finally {
      exportingFilter.value = null
    }
  }

  return { exportingFilter, exportLayer }
}
