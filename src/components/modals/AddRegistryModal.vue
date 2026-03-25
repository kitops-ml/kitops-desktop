<script setup lang="ts">
import { reactive, watch } from 'vue'

import Modal from '../Modal.vue'
import Checkbox from '../ui/Checkbox.vue'
import Input from '../ui/Input.vue'

type Form = {
  name: string,
  url: string,
  tlsVerify?: boolean
}

const props = defineProps<{
  open: boolean
  error: string | null
  loading: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [registry: Form]
}>()

const form = reactive<Form>({ name: '', url: '', tlsVerify: true })

watch(() => props.open, (val) => {
  if (val) {
    form.name = ''
    form.url = ''
    form.tlsVerify = true
  }
})
</script>

<template>
  <Modal :open="open" @close="$emit('close')">
    <h3 class="text-xl font-bold mb-2">Add Registry</h3>
    <p class="text-gray-01 text-sm mb-6">Add a custom container registry</p>
    <form class="flex flex-col gap-4" @submit.prevent="emit('submit', { ...form })">
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-sm text-gray-01">Name</label>
        <Input
          v-model="form.name"
          type="text"
          placeholder="My Registry"
          required
          autofocus />
      </div>
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-sm text-gray-01">URL</label>
        <Input
          v-model="form.url"
          type="text"
          class="font-mono"
          placeholder="registry.example.com"
          required />
        <p class="text-xs text-gray-02">Enter the registry hostname without protocol (e.g., registry.example.com)</p>
      </div>
      <div>
        <Checkbox v-model="form.tlsVerify">Require TLS and verify certificates</Checkbox>
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
          :disabled="loading || !form.name || !form.url">
          {{ loading ? 'Adding...' : 'Add Registry' }}
        </button>
      </div>
    </form>
  </Modal>
</template>
