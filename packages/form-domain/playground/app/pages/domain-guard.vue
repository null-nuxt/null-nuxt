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

/**
 * Camada declarada ANTES de `withFields` não tem como checar chave: sem campos
 * concretos, `keyof F` é `string` e o `OnlyKnownKeys` aceitaria qualquer coisa.
 *
 * O perigoso não era aceitar — era aceitar CALADO, parecendo que checou. A
 * guarda transforma isso em erro que nomeia a causa. Se ela regredir, estes
 * dois `@ts-expect-error` ficam sem uso e o typecheck falha.
 */
createFormDomain('domain-guard-ordem-rules')
  // @ts-expect-error rules antes de fields: não há chave que possa ser checada
  .withRules({ campoQueNaoExiste: { canShow: () => true } })
  .withFields({ cpf: field({ label: 'CPF', value: '' }) })
  .build()

createFormDomain('domain-guard-ordem-schema')
  // @ts-expect-error schema antes de fields, mesmo motivo
  .withSchema({ campoQueNaoExiste: string().required() })
  .withFields({ cpf: field({ label: 'CPF', value: '' }) })
  .build()

/**
 * O payload é uma PROJEÇÃO: o texto da escolha entra nele sem campo fantasma,
 * e o contexto oferece `values` e `visible` para o projeto escolher qual dos
 * dois vai pro backend.
 */
const projetado = createFormDomain('domain-guard-payload')
  .withFields({
    tipo: field<'PF' | 'PJ' | ''>({ label: 'Tipo', value: '' }),
    regiao: field({ label: 'Região', value: '', options: [{ label: '1ª Região', value: 'primeira' }] }),
  })
  .withFacts(ctx => ({ isPF: ctx.values.tipo === 'PF' }))
  .withOutcome(ctx => ({ price: ctx.facts.isPF ? 100 : 250 }))
  .withPayload(ctx => ({
    ...ctx.visible,
    regiao_descricao: ctx.selected.regiao?.label ?? '',
    price: ctx.outcome.price,
  }))
  .use()

// a projeção é tipada a partir da função, não colapsada em Record<string, unknown>
const descricao: string = projetado.payload.value.regiao_descricao
const preco: number = projetado.payload.value.price

// @ts-expect-error o payload não declara essa chave
const semChave = projetado.payload.value.naoExiste

/** Sem `withPayload`, o payload continua sendo `values`. */
const semProjecao = createFormDomain('domain-guard-payload-ausente')
  .withFields({ nome: field({ label: 'Nome', value: '' }) })
  .use()

const nome: string = semProjecao.payload.value.nome

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
  <div>{{ price }} {{ tipo }} {{ semMeta }} {{ semCampo }} {{ descricao }} {{ preco }} {{ semChave }} {{ nome }}</div>
</template>
