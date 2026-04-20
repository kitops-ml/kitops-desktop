<script setup>
defineOptions({ inheritAttrs: false })

defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <select
    v-bind="$attrs"
    :value="modelValue"
    class="form-select"
    @change="emit('update:modelValue', $event.target.value)">
    <slot />
  </select>
</template>
