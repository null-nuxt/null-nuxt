<script setup lang="ts">
/**
 * Fixture de tipos: todo erro marcado aqui DEVE continuar acontecendo. Tudo é
 * inferido do `app/tracking.ts` — se a geração de tipos regredir, os slugs
 * viram `string`, os `@ts-expect-error` ficam sem uso e o typecheck falha.
 */

// @ts-expect-error slug fora da definição do projeto
definePageMeta({ track: 'nao_existe' })

const { track } = useTracking()

// page_view → alvo PROIBIDO
track('landing_page')

// @ts-expect-error page_view não aceita alvo
track('landing_page', { target: 'x' })

// click → alvo OBRIGATÓRIO
track('add_to_cart', { target: 'plano-anual' })

// @ts-expect-error click exige alvo
track('add_to_cart')

// @ts-expect-error click exige alvo, não só opções
track('add_to_cart', { once: false })

// hover → alvo obrigatório (o limiar de 400ms é aplicado em runtime)
track('plano_destacado', { target: 'plano-anual' })

// tipo personalizado com alvo opcional: as duas formas valem
track('payment_tried')
track('payment_tried', { target: 'pix' })

// @ts-expect-error slug que não existe na definição
track('slug_inexistente')
</script>

<template>
  <!-- @vue-expect-error slug fora da definição do projeto -->
  <button v-track="{ name: 'nao_existe' }">
    inválido
  </button>

  <button v-track="{ name: 'add_to_cart', target: 'plano-anual' }">
    válido
  </button>
</template>
