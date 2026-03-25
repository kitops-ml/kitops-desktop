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
  <input
    v-bind="$attrs"
    :value="modelValue"
    class="form-input w-full"
    @input="emit('update:modelValue', $event.target.value)" />
</template>
