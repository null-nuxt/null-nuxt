<script setup lang="ts">
/**
 * Fixture do catálogo: `useFormDomain('slug')` tem que devolver AQUELE domínio,
 * com meta e campos tipados — não uma união de todos os domínios registrados.
 */
const domain = useFormDomain('justica-federal')

// outcome específico deste domínio
const sku: string = domain.outcome.value.sku
const price: number = domain.outcome.value.price

// fact específico deste domínio
const isPF: boolean = domain.facts.value.isPF

// @ts-expect-error slug que não existe entre os domínios descobertos
useFormDomain('nao-existe')

// @ts-expect-error o outcome deste domínio não tem essa chave
const semOutcome = domain.outcome.value.naoExiste

const todos = useFormDomains()
const quantos: number = todos.length

/**
 * O catálogo lê metadata SEM instanciar: o `title` sai da factory, não de uma
 * instância. Se isso regredir para uma leitura de instância, a listagem volta a
 * criar um effect scope por domínio.
 */
const catalogo = useFormDomainsMetadata()
const titulo: string | undefined = catalogo[0]?.metadata.title
const ordem: number | undefined = catalogo[0]?.metadata.order

// @ts-expect-error metadata não declara essa chave
const semMetadata = catalogo[0]?.metadata.naoExiste
</script>

<template>
  <div>{{ sku }} {{ price }} {{ isPF }} {{ semOutcome }} {{ quantos }} {{ titulo }} {{ ordem }} {{ semMetadata }}</div>
</template>
