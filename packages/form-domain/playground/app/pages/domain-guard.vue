<script setup lang="ts">
import { computed } from 'vue'
import { object, string } from 'yup'

/**
 * Fixture de tipos do domínio. Cada `@ts-expect-error` aqui é uma garantia: se
 * uma deixar de valer, a diretiva fica sem uso e o typecheck falha.
 */

const campos = refFields({
  username: { label: 'Username', value: '' },
  tipo: { label: 'Tipo', value: '' as 'PF' | 'PJ' | '' },
  perfil: {
    label: 'Perfil',
    value: '',
    placeholder: 'escolha um',
    options: [{ label: 'Advogado', value: 'adv' }],
  },
})

addRules(campos, {
  username: { canShow: () => campos.tipo.value === 'PF', clearWhenHidden: true },
})

// @ts-expect-error campo que não existe em fields
addRules(campos, { sobrenome: { canShow: () => true } })

addSchemas(campos, { username: string().required() })

// @ts-expect-error validar campo que não existe não faz sentido
addSchemas(campos, { sobrenome: string().required() })

const form = toForm(campos)

/** O valor mantém a união declarada, atravessando `values`. */
const tipo: 'PF' | 'PJ' | '' = form.values.value.tipo
void tipo

// @ts-expect-error campo fora de fields
form.register('sobrenome')

/** Um campo que declara extras recebe as chaves... */
void form.register('perfil').options
void form.register('perfil').placeholder

// @ts-expect-error ...e um que não declara nenhum não recebe nada
void form.register('username').options

// @ts-expect-error idem para placeholder
void form.register('username').placeholder

/** O handler tem que servir a um componente com `defineModel<string>()`. */
const handler: (value: string | undefined) => void = form.register('username')['onUpdate:modelValue']
void handler

/** `shape` mantém o tipo do yup, então compõe. */
const schema = form.composeSchema(object)
void schema.value.describe

/** `selected` sai do engine, sem precisar dos campos crus. */
const escolhido: string | undefined = form.selected.value.perfil?.label
void escolhido

// @ts-expect-error campo fora de fields
void form.selected.value.sobrenome

/** `visible` é parcial; `values` é completo. */
const parcial: string | undefined = form.visible.value.username
const completo: string = form.values.value.username
void parcial
void completo

/**
 * O valor de uma option tem que bater com o do campo que a carrega. Isso valia
 * pelo `refField()` singular e NÃO valia pelo `refFields()` — que é o caminho
 * comum — porque o record é chaveado com `any`. Sem esta garantia o select
 * renderiza escolhas que nunca casam: `selected` não resolve e um `oneOf`
 * recusa tudo que o usuário escolher.
 */
refFields({
  // @ts-expect-error o campo guarda string; esta option guarda number
  quantidade: { label: 'Qtd', value: '', options: [{ label: 'Um', value: 1 }] },
})

refFields({
  quantidade: {
    label: 'Qtd',
    value: '' as 'um' | 'dois' | '',
    // a união do campo aceita option da mesma união
    options: [{ label: 'Um', value: 'um' as const }],
  },
})

/** Campo avulso entra ao lado das declarações e mantém a precisão. */
const cpfCompartilhado = refField({ label: 'CPF', value: '', mask: 'cpf' })
const comAvulso = toForm(refFields({ cpf: cpfCompartilhado, nome: { label: 'Nome', value: '' } }))

void comAvulso.register('cpf').mask

// @ts-expect-error o campo avulso não declarou placeholder
void comAvulso.register('cpf').placeholder

/** Domínio: metadata sai da factory, sem instanciar. */
const domain = defineFormDomain('domain-guard', { title: 'Guarda', order: 1 }, () => {
  const f = refFields({ nome: { label: 'Nome', value: '' } })
  return { fields: f, gritado: computed(() => f.nome.value.toUpperCase()) }
}).payload(ctx => ({ ...ctx.visible, gritado: ctx.gritado.value }))

const titulo: string = domain.metadata.title
void titulo

const instancia = domain()

/** O que o setup expôs além dos campos chega tipado. */
const gritado: string = instancia.gritado.value
void gritado

/** E a projeção mantém o tipo do que foi projetado. */
const projetado: string = instancia.payload.value.gritado
void projetado

// @ts-expect-error o payload não declara essa chave
void instancia.payload.value.naoExiste

/** Metadata é opcional. */
const semMeta = defineFormDomain('domain-guard-sem-meta', () => ({
  fields: refFields({ nome: { label: 'Nome', value: '' } }),
}))

const nome: string = semMeta().values.value.nome
void nome
</script>

<template>
  <div>
    <!-- o caso que originou tudo: v-bind num componente com defineModel<string>() -->
    <ModelInput v-bind="form.register('username')" />
    <ModelInput v-bind="form.register('perfil')" />
    {{ tipo }} {{ parcial }} {{ completo }} {{ titulo }} {{ gritado }} {{ projetado }} {{ nome }}
  </div>
</template>
