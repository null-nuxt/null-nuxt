<script setup lang="ts">
/**
 * Fixture do catálogo: `useFormDomain('slug')` tem que devolver AQUELE domínio,
 * com os campos e o que o setup expôs tipados — não uma união de todos.
 */
const domain = useFormDomain('justica-federal')

// o que o setup expôs, tipado
const sku: string = domain.sku.value
const price: number = domain.price.value
const isPF: boolean = domain.isPF.value

// os campos daquele domínio
const tipo: 'PF' | 'PJ' | '' = domain.values.value.tipoPessoa

// @ts-expect-error slug que não existe entre os domínios descobertos
useFormDomain('nao-existe')

// @ts-expect-error este domínio não expôs essa chave
const semChave = domain.naoExiste

/**
 * O catálogo lê metadata SEM instanciar: sai da factory, não de uma instância.
 * Se isso regredir para leitura de instância, a listagem volta a rodar um setup
 * por domínio só pra renderizar um link.
 */
const catalogo = useFormDomainsMetadata()
const titulo: string | undefined = catalogo[0]?.metadata.title
const ordem: number | undefined = catalogo[0]?.metadata.order

// @ts-expect-error metadata não declara essa chave
const semMetadata = catalogo[0]?.metadata.naoExiste

const todos = useFormDomains()
const quantos: number = todos.length
</script>

<template>
  <div>
    {{ sku }} {{ price }} {{ isPF }} {{ tipo }} {{ semChave }}
    {{ titulo }} {{ ordem }} {{ semMetadata }} {{ quantos }}
  </div>
</template>
