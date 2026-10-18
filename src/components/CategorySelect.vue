<script setup>
// Las categorías que sirven para este tipo, con su icono, en un <select> nativo: en un
// teléfono es lo que mejor se usa con el pulgar.
import { computed } from 'vue'
import { lang } from '../i18n.js'
import { categories } from '../state.js'
import { categoryLabel } from '../lib/categories.js'

const props = defineProps({ modelValue: { type: String, default: '' }, type: { type: String, required: true } })
const emit = defineEmits(['update:modelValue'])

const options = computed(() => categories()
  .filter((c) => c.kind === props.type || c.kind === 'both')
  .map((c) => ({ key: c.key, text: `${c.icon || '•'} ${categoryLabel(c, lang.value)}` })))
</script>

<template>
  <select :value="modelValue" @change="emit('update:modelValue', $event.target.value)">
    <option value="" disabled>—</option>
    <option v-for="o in options" :key="o.key" :value="o.key">{{ o.text }}</option>
  </select>
</template>
