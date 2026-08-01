<script setup lang="ts">
import type { FieldObj } from '#forms'

/**
 * A segunda camada, em código: um componente que recebe O CAMPO em vez das
 * props que `register()` monta.
 *
 * `register()` serve um contrato específico de input — name, label, modelValue,
 * handler. Quando o componente quer o próprio objeto, ele lê `label`, `value` e
 * `selected` direto e escreve em `value`. Coleção indexada não expressa isso,
 * e é por isso que `fields` continua na instância.
 *
 * Fica no playground para a regra do README ser verificada pelo typecheck em
 * vez de viver só como parágrafo.
 *
 * O `v-model` no campo dispara `vue/no-mutating-props`, e a regra está certa no
 * caso geral. Aqui não: o campo é estado reativo compartilhado, como uma store
 * passada adiante, e escrever nele É o contrato. A regra não distingue os dois
 * casos, então a exceção fica marcada no template.
 */
defineProps<{ field: FieldObj<string> }>()
</script>

<template>
  <label style="display:grid; gap:.2rem">
    <span>{{ field.label }} <small style="opacity:.5">({{ field.key }})</small></span>
    <!-- eslint-disable-next-line vue/no-mutating-props -->
    <input v-model="field.value">
    <small v-if="field.selected" style="opacity:.6">
      escolhido: {{ field.selected.label }}
    </small>
  </label>
</template>
