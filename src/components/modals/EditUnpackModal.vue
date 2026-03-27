<script setup lang="ts">
import { computed, ref } from 'vue'
import { stringify } from 'yaml'

import IconSpinner from '~icons/custom-icons/spinner'
import IconArrowRight from '~icons/ri/arrow-right-line'

import { useUnpackCache } from '../../composables/useUnpackCache'
import { useLogStore } from '../../stores/logStore'
import Modal from '../Modal.vue'

const props = defineProps<{
  open: boolean
  repository: string
  tag: string
  size?: string
}>()

const emit = defineEmits<{
  close: []
  complete: [tempDir: string]
}>()

const { getUnpackDir } = useUnpackCache()
const logStore = useLogStore()
const unpacking = ref(false)
const error = ref<string | null>(null)

const path = computed(() => `${props.repository}:${props.tag}`)

async function startUnpack() {
  const dir = getUnpackDir(props.repository, props.tag)

  unpacking.value = true
  error.value = null

  try {
    const hasKitfile = await window.kitops.fs.fileExists(window.kitops.fs.pathJoin(dir, 'Kitfile'))
    if (hasKitfile) {
      logStore.logInfo(`Reusing existing unpack directory for ${path.value}`, { dir })
      emit('complete', dir)
      return
    }

    logStore.logInfo(`Unpacking ${path.value} to temporary directory`, { dir })
    await window.kitops.kit.unpack(path.value, { dir, overwrite: true })
    const kitfile = await window.kitops.kit.info(path.value)
    await window.kitops.fs.writeFile(window.kitops.fs.pathJoin(dir, 'Kitfile'), stringify(kitfile))
    logStore.logInfo(`Unpack complete for ${path.value}`, { dir })
    emit('complete', dir)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    unpacking.value = false
  }
}

function handleClose() {
  if (unpacking.value) {
    return
  }
  error.value = null
  emit('close')
}
</script>

<template>
  <Modal
    :open="open"
    class="max-w-xl"
    @close="handleClose">
    <h3 class="text-xl font-bold mb-2">Edit ModelKit</h3>

    <div v-if="error" class="mb-4 px-4 py-3 bg-error/10 border border-error text-error text-sm">
      {{ error }}
    </div>

    <!-- Unpacking progress -->
    <template v-if="unpacking">
      <p class="text-gray-01 text-sm mb-6">Unpacking to a temporary directory...</p>
      <div class="flex items-center gap-3 py-2 text-gray-01">
        <IconSpinner class="w-5 h-5 animate-spin shrink-0" />
        <span class="font-mono text-sm text-off-white">{{ path }}</span>
      </div>
    </template>

    <!-- Confirmation -->
    <template v-else>
      <p class="text-gray-01 text-sm mb-4">
        The ModelKit will be unpacked to a temporary directory so you can edit its Kitfile and repack it as a new revision.
      </p>
      <div class="mb-6 p-3 bg-elevation-03 border border-gray-03 flex items-center justify-between gap-3">
        <span class="font-mono text-sm text-off-white truncate" style="direction:rtl">{{ path }}</span>
        <span v-if="size" class="text-gray-02 text-sm shrink-0">{{ size }}</span>
      </div>
      <div class="flex gap-3">
        <button class="flex-1 button-secondary" @click="handleClose">Cancel</button>
        <button class="flex-1 flex justify-center items-center gap-1 button-submit" @click="startUnpack">
          Unpack & Continue
          <IconArrowRight class="size-4" />
        </button>
      </div>
    </template>
  </Modal>
</template>
