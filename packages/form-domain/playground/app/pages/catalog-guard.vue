<script setup lang="ts">
/**
 * Fixture do catálogo: `useFormDomain('slug')` tem que devolver AQUELE domínio,
 * com meta e campos tipados — não uma união de todos os domínios registrados.
 */
const domain = useFormDomain('justica-federal')

// meta específica deste domínio
const sku: string = domain.outcome.value.sku
const price: number = domain.outcome.value.price

// fact específico deste domínio
const isPF: boolean = domain.facts.value.isPF

// @ts-expect-error slug que não existe entre os domínios descobertos
useFormDomain('nao-existe')

// @ts-expect-error meta deste domínio não tem essa chave
const semMeta = domain.outcome.value.naoExiste

const todos = useFormDomains()
const quantos: number = todos.length
</script>

<template>
  <div>{{ sku }} {{ price }} {{ isPF }} {{ semMeta }} {{ quantos }}</div>
</template>
