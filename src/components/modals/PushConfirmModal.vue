<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'

import RegistriesSelect from '../ui/RegistriesSelect.vue'
import RepositoryNameInput from '../ui/RepositoryNameInput.vue'
import ConfirmModal from './ConfirmModal.vue'

const props = defineProps<{
  open: boolean
  source: string
  destinationPath: string
  loading?: boolean
}>()

const emit = defineEmits<{ close: []; confirm: [destination: string] }>()

const form = reactive({
  repository: '',
  tag: '',
})

const repositoryError = ref('')
const firstInputRef = ref<HTMLDivElement>()

const destinationRegistry = ref('')

const sourceParts = computed(() => {
  const [sourceRegistry, tag] = props.source.split(':')
  const [registry, ...rest] = sourceRegistry.split('/')
  return { registry, repository: rest.join('/'), tag }
})

const destination = computed(() => {
  const repository = (form.repository || sourceParts.value.repository)
  const tag = (form.tag || sourceParts.value.tag)

  return `${destinationRegistry.value}/${repository}:${tag}`
})

watch(() => props.open, (val) => {
  if (val) {
    form.repository = sourceParts.value.repository
    form.tag = sourceParts.value.tag
    nextTick(() => firstInputRef.value?.querySelector<HTMLInputElement>('input')?.focus())
  }
})
</script>

<template>
  <ConfirmModal
    :open="open"
    title="Confirm Push"
    confirm-label="Confirm Push"
    busy-label="Pushing..."
    :disabled="!destinationRegistry || !form.repository || Boolean(repositoryError) || !form.tag"
    class="max-w-2xl"
    @close="$emit('close')"
    @confirm="emit('confirm', destination)">
    <p class="text-gray-01 text-sm mb-4">Are you sure you want to push this ModelKit?</p>
    <RegistriesSelect v-model="destinationRegistry" class="mb-4" />
    <div>
      <span class="text-xs text-gray-02 block mb-1">Source</span>
      <div class="p-3 bg-elevation-01 border border-gray-03 mb-6">
        <code class="text-sm font-mono text-off-white">{{ source }}</code>
      </div>
    </div>
    <div>
      <span class="text-xs text-gray-02 block mb-1">Destination</span>
      <div class="p-3 bg-elevation-01 border border-gray-03 mb-6">
        <code class="text-sm font-mono text-gold">{{ destination }}</code>
      </div>
    </div>
    <hr class="mb-4 border-b border-gray-03">
    <div ref="firstInputRef" class="flex flex-col gap-2 mb-4">
      <label class="font-semibold text-sm text-gray-01">Repository <span class="text-error">*</span></label>
      <RepositoryNameInput
        v-model="form.repository"
        v-model:error="repositoryError"
        placeholder="my-model"
        required />
      <p class="text-xs text-gray-02">The name used to reference this ModelKit</p>
    </div>
    <div class="flex flex-col gap-2 mb-4">
      <label class="font-semibold text-sm text-gray-01">Tag <span class="text-error">*</span></label>
      <input
        v-model="form.tag"
        type="text"
        class="py-3 px-4 bg-elevation-03 border border-gray-03 text-off-white text-[0.95rem] font-mono transition-all duration-200 focus:outline-none focus:border-gold focus:bg-elevation-02"
        placeholder="latest"
        required />
      <p class="text-xs text-gray-02">Tag for this ModelKit (e.g., latest, v1.0.0)</p>
    </div>
    <div v-if="loading" class="h-1 bg-elevation-03 overflow-hidden relative mb-4">
      <div class="push-progress-bar absolute inset-y-0 w-1/3 bg-gold"></div>
    </div>
  </ConfirmModal>
</template>

<style scoped>
.push-progress-bar {
  animation: push-slide 1.4s ease-in-out infinite;
}

@keyframes push-slide {
  0% {
    left: -33%;
  }

  100% {
    left: 100%;
  }
}
</style>
