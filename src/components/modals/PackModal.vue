<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'

import type { Registry } from '../../stores/kitStore'
import Modal from '../Modal.vue'
import RegistriesSelect from '../ui/RegistriesSelect.vue'
import RepositoryNameInput from '../ui/RepositoryNameInput.vue'

const props = defineProps<{
  open: boolean
  draftName?: string
  initialTag?: string
  registries: Registry[]
  error: string | null
  loading: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [form: { registry: string; repository: string; tag: string }]
}>()

const form = reactive({
  registry: '',
  repository: '',
  tag: 'latest',
})

const repositoryError = ref('')
const formRef = ref<HTMLFormElement>()

const registryAuthenticated = computed(() => {
  if (!form.registry) {
    return true
  }
  return props.registries.find(r => r.url === form.registry)?.authenticated ?? false
})

watch(
  () => props.open,
  (val) => {
    if (val) {
      form.registry = ''
      form.repository = props.draftName ?? ''
      form.tag = props.initialTag ?? 'latest'
      nextTick(() => formRef.value?.querySelector<HTMLInputElement>('input')?.focus())
    }
  },
)

function onSubmit() {
  emit('submit', { ...form })
}
</script>

<template>
  <Modal :open="open" @close="$emit('close')">
    <h3 class="text-xl font-bold mb-2">Pack ModelKit</h3>
    <p class="text-gray-01 text-sm mb-6">
      Pack <span class="font-semibold text-off-white">"{{ draftName }}"</span> into a ModelKit
    </p>
    <form ref="formRef" class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <RegistriesSelect v-model="form.registry">
        <template #options>
          <option value="">Local Only (no registry)</option>
        </template>
      </RegistriesSelect>

      <p v-if="form.registry && !registryAuthenticated" class="text-xs text-amber-400">
        You must login to this registry in Settings before packing to it
      </p>
      <p v-else class="text-xs text-gray-02">Select a registry to pack directly to a remote location</p>

      <div class="flex flex-col gap-2">
        <label class="font-semibold text-sm text-gray-01">Repository <span class="text-error">*</span></label>
        <RepositoryNameInput
          v-model="form.repository"
          v-model:error="repositoryError"
          placeholder="my-model"
          required />
        <p class="text-xs text-gray-02">The name used to reference this ModelKit</p>
      </div>
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-sm text-gray-01">Tag <span class="text-error">*</span></label>
        <input
          v-model="form.tag"
          type="text"
          class="py-3 px-4 bg-elevation-03 border border-gray-03 text-off-white text-[0.95rem] font-mono transition-all duration-200 focus:outline-none focus:border-gold focus:bg-elevation-02"
          placeholder="latest"
          required />
        <p class="text-xs text-gray-02">Version tag for this ModelKit (e.g., latest, v1.0.0)</p>
      </div>
      <div class="p-3 bg-elevation-01 border border-gray-03">
        <span class="text-xs text-gray-02 block mb-1">Will be packed as:</span>
        <code class="text-sm font-mono text-gold break-all">
          {{ form.registry ? `${form.registry}/` : '' }}{{ form.repository || 'repository' }}:{{ form.tag || 'tag' }}
        </code>
      </div>
      <div v-if="error" class="p-3 bg-error/10 border border-error text-error text-sm">{{ error }}</div>
      <div class="flex gap-3 mt-2">
        <button
          type="button"
          class="flex-1 button-secondary"
          @click="$emit('close')">
          Cancel
        </button>
        <button
          type="submit"
          class="flex-1 button-submit"
          :disabled="loading || !form.repository || !form.tag || (Boolean(form.registry) && !registryAuthenticated) || Boolean(repositoryError)">
          {{ loading ? 'Packing...' : 'Pack' }}
        </button>
      </div>
    </form>
  </Modal>
</template>
