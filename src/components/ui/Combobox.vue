<script setup lang="ts">
import { computed, ref } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue: string
  options: string[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const highlighted = ref(-1)

const filtered = computed(() => {
  if (!props.modelValue.trim()) {
    return props.options
  }
  const q = props.modelValue.toLowerCase()
  return props.options.filter(o => o.toLowerCase().includes(q))
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
  isOpen.value = true
  highlighted.value = -1
}

function onFocus() {
  isOpen.value = true
}

function onBlur() {
  setTimeout(() => {
    isOpen.value = false
    highlighted.value = -1
  }, 100)
}

function select(option: string) {
  emit('update:modelValue', option)
  isOpen.value = false
  highlighted.value = -1
}

function onKeydown(e: KeyboardEvent) {
  if (!isOpen.value) {
    if (e.key === 'ArrowDown') {
      isOpen.value = true
      e.preventDefault()
    }
    return
  }

  if (e.key === 'ArrowDown') {
    highlighted.value = Math.min(highlighted.value + 1, filtered.value.length - 1)
    e.preventDefault()
  } else if (e.key === 'ArrowUp') {
    highlighted.value = Math.max(highlighted.value - 1, 0)
    e.preventDefault()
  } else if (e.key === 'Enter' && highlighted.value >= 0) {
    select(filtered.value[highlighted.value])
    e.preventDefault()
  } else if (e.key === 'Escape') {
    isOpen.value = false
    highlighted.value = -1
  }
}
</script>

<template>
  <div class="relative">
    <input
      v-bind="$attrs"
      :value="modelValue"
      :placeholder="placeholder"
      class="form-input w-full"
      autocomplete="off"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown" />
    <ul
      v-if="isOpen && filtered.length"
      class="absolute z-50 w-full mt-0.5 bg-elevation-03 border border-gray-03 max-h-52 overflow-y-auto shadow-lg">
      <li
        v-for="(option, i) in filtered"
        :key="option"
        class="px-4 py-2 text-sm cursor-pointer"
        :class="i === highlighted ? 'bg-gold/20 text-gold' : 'text-off-white hover:bg-elevation-02'"
        @mousedown.prevent="select(option)">
        {{ option }}
      </li>
    </ul>
  </div>
</template>
