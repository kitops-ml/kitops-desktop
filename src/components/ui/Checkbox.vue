<script setup>
defineOptions({ inheritAttrs: false })

defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <label class="flex items-center gap-2 cursor-pointer">
    <input
      v-bind="$attrs"
      type="checkbox"
      :checked="modelValue"
      class="form-checkbox"
      @change="emit('update:modelValue', $event.target.checked)" />
    <span class="text-sm text-gray-01"><slot /></span>
  </label>
</template>
