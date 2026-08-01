<script setup lang="ts">
import { string } from 'yup'

/**
 * Fixture de tipos do builder. O motivo de o builder existir é a acumulação de
 * tipos: `rules`, `schema` e `meta` precisam enxergar o que `withFacts`
 * devolveu. Se essa acumulação regredir, `ctx.facts` vira `unknown`/`any`,
 * os `@ts-expect-error` ficam sem uso e o typecheck falha aqui.
 */
const useDomain = createFormDomain('domain-guard')
  .withFields({
    tipo: field<'PF' | 'PJ' | ''>({ label: 'Tipo', value: '' }),
    cpf: field({ label: 'CPF', value: '' }),
  })
  .withFacts(ctx => ({
    isPF: ctx.values.tipo === 'PF',
  }))
  .withRules({
    // os facts do passo anterior chegam tipados aqui
    cpf: { canShow: ctx => ctx.facts.isPF, clearWhenHidden: true },

    // @ts-expect-error fact que não foi declarado
    tipo: { canShow: ctx => ctx.facts.naoExiste },

    // @ts-expect-error campo que não existe em fields
    sobrenome: { canShow: () => true },
  })
  .withSchema(ctx => ctx.shape({
    cpf: ctx.facts.isPF ? string().required() : string().nullable(),

    // @ts-expect-error validar campo que não existe em fields não faz sentido
    sobrenome: string().required(),
  }))
  .withOutcome(ctx => ({ price: ctx.facts.isPF ? 100 : 250 }))
  .build()

/** `storeLabelIn` só aceita outro campo do próprio domínio. */
createFormDomain('domain-guard-label')
  .withFields({
    regiao: field({ label: 'Região', value: '' }),
    regiao_descricao: field({ label: 'Descrição', value: '' }),
  })
  .withRules({
    regiao: { storeLabelIn: 'regiao_descricao' },
  })
  .build()

createFormDomain('domain-guard-label-invalido')
  .withFields({
    regiao: field({ label: 'Região', value: '' }),
    regiao_descricao: field({ label: 'Descrição', value: '' }),
  })
  .withRules({
    // @ts-expect-error destino que não existe em fields
    regiao: { storeLabelIn: 'nao_existe' },
  })
  .build()

createFormDomain('domain-guard-label-proprio')
  .withFields({
    regiao: field({ label: 'Região', value: '' }),
    regiao_descricao: field({ label: 'Descrição', value: '' }),
  })
  .withRules({
    // @ts-expect-error guardar o label no próprio campo apagaria o valor
    regiao: { storeLabelIn: 'regiao' },
  })
  .build()

const form = useDomain()

// o tipo de `meta` vem do withOutcome
const price: number = form.outcome.value.price

// o valor do campo mantém o tipo declarado em fields
const tipo: 'PF' | 'PJ' | '' = form.values.value.tipo

// @ts-expect-error meta não tem essa chave
const semMeta = form.outcome.value.naoExiste

// @ts-expect-error campo fora de fields
const semCampo = form.data.sobrenome

form.set({ cpf: 'ok' })

// @ts-expect-error valor com tipo errado pro campo
form.set({ tipo: 42 })

// @ts-expect-error campo inexistente no patch
form.set({ sobrenome: 'x' })
</script>

<template>
  <!-- referenciados só pra manter vivas as checagens do script -->
  <div>{{ price }} {{ tipo }} {{ semMeta }} {{ semCampo }}</div>
</template>
