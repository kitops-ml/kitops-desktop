<script setup lang="ts">
import { useVModel } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'

import { useKitStore } from '../../stores/kitStore'
import { useSettingsStore } from '../../stores/settingsStore'
import Select from '../ui/Select.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  required?: boolean
}>(), {
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const vModel = useVModel(props, 'modelValue', emit)
const kitStore = useKitStore()
const settingsStore = useSettingsStore()

const { registries } = storeToRefs(kitStore)
const { lastUsedRegistry } = storeToRefs(settingsStore)

const defaultRegistry = computed(() =>
  registries.value.find(r => r.url === lastUsedRegistry.value)
  || registries.value.find(({ authenticated }) => Boolean(authenticated)),
)

// Initialize vModel from persisted setting (or first authenticated registry)
watch(defaultRegistry, (val) => {
  if (val?.url && val.url !== vModel.value) {
    vModel.value = val.url
  }
}, { immediate: true })

// Persist selection changes to settings
watch(vModel, (val) => {
  if (val) {
    settingsStore.updateSetting('lastUsedRegistry', val)
  }
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="font-semibold text-sm text-gray-01">Registry</label>
    <Select v-model="vModel" :required="props.required">
      <option value="" disabled>Select a registry</option>
      <slot name="options" />
      <option
        v-for="reg in registries"
        :key="reg.url"
        :value="reg.url"
        :disabled="!reg.authenticated">
        {{ reg.name }} ({{ reg.url }}){{ !reg.authenticated ? ' — Login required' : '' }}
      </option>
    </Select>
  </div>
</template>