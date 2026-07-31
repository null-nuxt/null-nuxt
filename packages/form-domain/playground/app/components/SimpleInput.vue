<script setup lang="ts">
/**
 * Input genérico do projeto. Repare que ele declara só o que usa — o
 * `register()` manda `options`/`mask` apenas quando o campo tem, então nada
 * sobra pra cair como atributo solto no DOM.
 */
defineProps<{
  name: string
  label: string
  modelValue: string
  placeholder?: string
  mask?: string
}>()

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <label style="display:grid; gap:.2rem; font-size:.85rem">
    {{ label }}
    <input
      :name="name"
      :value="modelValue"
      :placeholder="placeholder"
      style="padding:.4rem; border:1px solid #d4d4d8; border-radius:.3rem"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <small
      v-if="mask"
      style="opacity:.5"
    >máscara: {{ mask }}</small>
  </label>
</template>
