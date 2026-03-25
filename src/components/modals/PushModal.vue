<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

import Modal from '../Modal.vue'
import RepositoryNameInput from '../ui/RepositoryNameInput.vue'

const props = defineProps<{
  open: boolean
  initialRepository?: string
  initialTag?: string
  error: string | null
}>()

const emit = defineEmits<{
  close: []
  submit: [form: { repository: string; tag: string }]
}>()

const form = reactive({
  repository: '',
  tag: 'latest',
})

const repositoryError = ref('')

watch(
  () => props.open,
  (val) => {
    if (val) {
      form.repository = props.initialRepository ?? ''
      form.tag = props.initialTag ?? 'latest'
    }
  },
)
</script>

<template>
  <Modal :open="open" @close="$emit('close')">
    <h3 class="text-xl font-bold mb-2">Push ModelKit</h3>
    <p class="text-gray-01 text-sm mb-6">Push this ModelKit to a remote registry</p>
    <form class="flex flex-col gap-4" @submit.prevent="emit('submit', { ...form })">
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-sm text-gray-01">Repository</label>
        <RepositoryNameInput
          v-model="form.repository"
          v-model:error="repositoryError"
          placeholder="my-model"
          required />
      </div>
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-sm text-gray-01">Tag</label>
        <input
          v-model="form.tag"
          type="text"
          required
          placeholder="latest"
          class="py-3 px-4 bg-elevation-03 border border-gray-03 text-off-white text-[0.95rem] font-mono transition-all duration-200 focus:outline-none focus:border-gold focus:bg-elevation-02" />
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
          :disabled="!form.repository || Boolean(repositoryError) || !form.tag">
          Continue
        </button>
      </div>
    </form>
  </Modal>
</template>
