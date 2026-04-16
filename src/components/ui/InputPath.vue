<script setup lang="ts">
import IconFolder from '~icons/ri/folder-line'

import Input from './Input.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue: string
  placeholder?: string
  baseDir?: string
  pickerType?: 'path' | 'dir'
  // When set, files selected from outside this directory are copied into it.
  // The emitted value is then the path relative to copyToDir.
  // Intended for the edit-kitfile flow where the working dir is a temp folder.
  copyToDir?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

async function browse() {
  const result = props.pickerType === 'dir'
    ? await window.kitops.dialog.selectDirectory({ defaultPath: props.baseDir })
    : await window.kitops.dialog.selectPath({ defaultPath: props.baseDir })
  if (!result.success || !result.path) {
    return
  }

  if (props.copyToDir) {
    const relative = window.kitops.fs.pathRelative(props.copyToDir, result.path)
    const isInside = !relative.startsWith('..') && !window.kitops.fs.pathIsAbsolute(relative)
    if (isInside) {
      emit('update:modelValue', relative)
    } else {
      const name = window.kitops.fs.pathBasename(result.path)
      const dest = window.kitops.fs.pathJoin(props.copyToDir, name)
      await window.kitops.fs.copyPath(result.path, dest)
      emit('update:modelValue', name)
    }
    return
  }

  let selected = result.path
  if (props.baseDir && selected.startsWith(props.baseDir + '/')) {
    selected = selected.substring(props.baseDir.length + 1)
  }
  emit('update:modelValue', selected)
}
</script>

<template>
  <div class="flex gap-0">
    <Input
      v-bind="$attrs"
      :model-value="modelValue"
      :placeholder="placeholder"
      class="flex-1"
      @update:model-value="emit('update:modelValue', $event as string)" />
    <button
      class="px-2.5 border border-l-0 border-gray-03 text-gray-02 transition-all hover:text-off-white hover:border-gray-02 hover:bg-elevation-02 shrink-0"
      type="button"
      @click="browse">
      <IconFolder class="size-4" />
    </button>
  </div>
</template>
