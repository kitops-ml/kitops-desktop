<script setup lang="ts">
import { reactive, watch } from 'vue'

import Modal from '../Modal.vue'
import Input from '../ui/Input.vue'

const props = defineProps<{
  open: boolean
  registryName?: string
  registryUrl?: string
  error: string | null
  loading: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [credentials: { username: string; password: string }]
}>()

const form = reactive({ username: '', password: '' })

watch(() => props.open, (val) => {
  if (val) {
    form.username = ''
    form.password = ''
  }
})
</script>

<template>
  <Modal :open="open" @close="$emit('close')">
    <h3 class="text-xl font-bold mb-2">Login to {{ registryName }}</h3>
    <p class="text-gray-01 text-sm mb-6">Enter your credentials for {{ registryUrl }}</p>
    <form class="flex flex-col gap-4" @submit.prevent="emit('submit', { ...form })">
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-sm text-gray-01">Username</label>
        <Input
          v-model="form.username"
          type="text"
          placeholder="Enter username"
          required
          autofocus />
      </div>
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-sm text-gray-01">Password</label>
        <Input
          v-model="form.password"
          type="password"
          placeholder="Enter password"
          required />
      </div>
      <div v-if="error" class="p-3 bg-error/10 border border-error text-error text-sm">{{ error }}</div>
      <div class="flex gap-3 mt-2">
        <button
          type="button"
          class="flex-1 button-secondary"
          @click="emit('close')">
          Cancel
        </button>
        <button
          type="submit"
          class="flex-1 button-submit"
          :disabled="loading || !form.username || !form.password">
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>
      </div>
    </form>
  </Modal>
</template>
