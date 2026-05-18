<script setup lang="ts">
import type { ModelKit } from '@kitops/kitops-ts'
import { computed } from 'vue'

import IconModelKit from '~icons/ri/box-2-line'
import IconDelete from '~icons/ri/delete-bin-7-line'
import IconTag from '~icons/ri/price-tag-3-line'
import IconPinned from '~icons/ri/pushpin-2-line'
import IconPin from '~icons/ri/pushpin-line'
import IconUser from '~icons/ri/user-3-line'
import IconSize from '~icons/ri/weight-line'

import { sizeToNumber } from '../utils'

const props = defineProps<{
  modelkit: ModelKit,
  pinned?: boolean
}>()

const emit = defineEmits<{
  (event: 'click', e: Event): void
  (event: 'remove', modelkit: ModelKit): void
  (event: 'tag', modelkit: ModelKit): void,
  (event: 'click:pin', modelkit: ModelKit): void
}>()

// Check if ModelKit can be individually deleted
// ModelKits with <none> repository can only be removed via Prune
const displayName = computed(() => {
  if (props.modelkit.name && props.modelkit.name !== '<none>') {
    return { value: props.modelkit.name, derived: false }
  }
  const segments = props.modelkit.repository?.split('/')
  const repoSegment = segments?.[segments.length - 1]
  return { value: repoSegment || props.modelkit.repository || '<none>', derived: Boolean(repoSegment) }
})

const canDelete = computed(() => {
  const hasValidRepository = props.modelkit.repository && props.modelkit.repository !== '<none>'
  const hasValidTagOrDigest = (props.modelkit.tag && props.modelkit.tag !== '<none>') || props.modelkit.digest
  return hasValidRepository && hasValidTagOrDigest
})

function formatDigest(digest: string): string {
  if (!digest) {
    return ''
  }
  // Remove 'sha256:' prefix if present and show first 7 chars
  return digest.replace('sha256:', '').slice(0, 7).toUpperCase()
}

function onDelete(modelkit: ModelKit) {
  emit('remove', modelkit)
}

function onTag(modelkit: ModelKit) {
  emit('tag', modelkit)
}
</script>

<template>
  <div
    class="group relative bg-surface border border-gray-03 p-6 cursor-pointer transition-all duration-200 flex flex-col gap-4 hover:bg-surface hover:border-gold hover:-translate-y-0.5 hover:shadow-md"
    @click="$emit('click')">
    <button
      class="absolute right-0 top-0 size-0 hover:border-r-amber-500 hover:border-t-amber-500 text-black border-25 border-transparent border-r-gold border-t-gold shrink-0 p-0 opacity-0 group-hover:opacity-100"
      :class="{ 'pinned opacity-100!': props.pinned }"
      @click.stop.prevent="emit('click:pin', modelkit)">
      <Component
        :is="props.pinned ? IconPinned : IconPin"
        class="size-5 opacity-50 hover:opacity-100 absolute left-1/2 top-1/2 -translate-y-full"
        :class="{ 'opacity-100': props.pinned }" />
    </button>
    <div class="flex items-start gap-3">
      <div class="flex items-center justify-center shrink-0 text-gold">
        <IconModelKit class="size-6" />
      </div>
      <div class="flex-1 min-w-0">
        <h3
          class="text-lg font-bold mb-1 truncate group-hover:text-gold leading-none"
          :class="displayName.derived ? 'italic text-gray-01' : ''"
          :title="displayName.derived ? 'No package name set — showing repository name' : undefined">
          {{ displayName.value }}
        </h3>
        <span
          class="inline-flex items-center gap-1 text-gray-01 text-xs font-mono"
          title="Tag">
          <IconTag class="size-3" /> {{ modelkit.tag || 'latest' }}
        </span>
      </div>
    </div>

    <div class="flex flex-wrap gap-4">
      <div class="flex items-center gap-2 text-gray-01 text-sm">
        <IconSize class="size-4 opacity-70" />
        <span
          class="modelkit-size-label" :data-size="sizeToNumber(modelkit.size)"
          title="Size">{{ modelkit.size }}</span>
      </div>
      <div
        v-if="modelkit.maintainer"
        class="flex items-center gap-2 text-gray-01 text-sm"
        title="Maintainer">
        <IconUser class="size-4 opacity-70" />
        <span>{{ modelkit.maintainer }}</span>
      </div>
    </div>

    <div class="text-xs text-gray-01 font-mono truncate">
      {{ modelkit.repository }}
    </div>

    <div class="flex items-center justify-between pt-3 border-t border-gray-03">
      <div class="flex items-center gap-3">
        <div class="text-xs text-gray-02 opacity-70 font-mono">
          {{ formatDigest(modelkit.digest) }}
        </div>
      </div>

      <div class="flex items-center gap-1 opacity-0 group-focus:opacity-100 group-hover:opacity-100">
        <button
          class="button-action"
          title="Add a new tag"
          @click.stop.prevent="onTag(modelkit)">
          <IconTag />
          Tag
        </button>
        <button
          v-if="canDelete"
          class="button-action-danger"
          title="Remove from local storage"
          @click.stop.prevent="onDelete(modelkit)">
          <IconDelete />
          Delete
        </button>
        <span
          v-else
          class="text-xs text-gray-02 italic"
          title="Use Prune to remove untagged ModelKits">
          Use Prune to remove
        </span>
      </div>
    </div>
  </div>
</template>
