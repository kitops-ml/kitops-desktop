<script setup lang="ts">
import Combobox from './Combobox.vue'

const FRAMEWORKS = [
  'pytorch',
  'tensorflow',
  'transformers',
  'onnx',
  'jax',
  'keras',
  'scikit-learn',
  'xgboost',
  'lightgbm',
  'mlx',
  'llamacpp',
  'coreml',
  'tensorrt',
  'gguf',
]

defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <Combobox
    :model-value="modelValue"
    :options="FRAMEWORKS"
    placeholder="pytorch"
    @update:model-value="$emit('update:modelValue', $event)" />
</template>
