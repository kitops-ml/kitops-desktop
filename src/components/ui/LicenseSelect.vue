<script setup lang="ts">
import Combobox from './Combobox.vue'

const SPDX_LICENSES = [
  'MIT',
  'Apache-2.0',
  'GPL-2.0',
  'GPL-3.0',
  'LGPL-2.1',
  'LGPL-3.0',
  'AGPL-3.0',
  'MPL-2.0',
  'EPL-1.0',
  'EPL-2.0',
  'EUPL-1.2',
  'CDDL-1.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BSD-4-Clause',
  'ISC',
  'Artistic-2.0',
  'OSL-3.0',
  'OFL-1.1',
  'PSF-2.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'CC-BY-NC-4.0',
  'CC-BY-NC-SA-4.0',
  'CC-BY-ND-4.0',
  'CC0-1.0',
  'Unlicense',
  'WTFPL',
]

const sortedLicenses = SPDX_LICENSES.sort((a, z) => a.localeCompare(z))

defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <Combobox
    :model-value="modelValue"
    :options="sortedLicenses"
    placeholder="Apache-2.0"
    @update:model-value="$emit('update:modelValue', $event)" />
</template>
