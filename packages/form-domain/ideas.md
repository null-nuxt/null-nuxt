
---

# Reprojeto da montagem: formato setup

Anotado depois de umas seis rodadas de desenho. O que está aqui é o formato
que fechou e, principalmente, **por que** cada decisão — pra não refazer a
discussão daqui a três meses.

## O que não fechava no builder

O builder existe por uma limitação só: num objeto literal o TypeScript infere
tudo de uma vez, então `facts` não vê `fields` e `rules` não vê `facts`.

Toda a maquinaria em volta é contorno dessa frase — `withX` encadeado, os tipos
`RulesOf`/`SchemaOf`/`OutcomeOf`/`PayloadContextOf`, o `ctx.shape()`. Cada
tentativa de arrumar movia a feiura de lugar em vez de tirar:

- os `*Of` obrigam o consumidor a importar encanamento interno pra dividir em
  arquivos;
- helpers de identidade no builder (`base.defineRules`) melhoram, mas dependem
  de o builder mutar uma definição compartilhada;
- três factories (`Base`/`Core`/`Payload`) tornam a dependência explícita, mas
  encarecem o formulário inline, que é metade da razão do `use()` existir.

Em setup não existe objeto literal: cada linha é uma declaração e a inferência
corre de cima pra baixo. A limitação some, não é contornada.

## Os dois formatos

Não são dois jeitos de fazer a mesma coisa — são duas escalas, e a linha é a
mesma que já separa `use()` de `build()`.

### Componente: o `<script setup>` já é o escopo

```ts
const form = fields({
  username: { label: 'Username', value: '' },
  personType: { label: 'Person Type', value: '' as 'individual' | 'company' | '' },
  businessMail: { label: 'Business Email', value: '' },
})

const isCompanyUser = computed(() => form.personType.value === 'company')

addRule(form.businessMail, {
  canShow: () => isCompanyUser.value,
  clearWhenHidden: true,
})

addSchemas(form, { username: string().required() })

const { register, canShow, composeSchema } = useForm(form)
```

### Domínio compartilhado: não tem componente onde morar

```ts
export const metadata = { title: '...', slug: 'certidao-jf', order: 120 }

export default defineFormDomain('federal-court', metadata, () => {
  const form = createFields()

  const isPF = computed(() => form.tipoPessoa.value === 'PF')

  regrasDe(form, isPF)     // outro arquivo
  schemaDe(form, isPF)     // outro arquivo

  return {
    fields: form,
    price: computed(() => isPF.value ? 59.9 : 89.9),
  }
})
  .payload(ctx => ({
    ...ctx.visible,
    regiao_descricao: ctx.fields.regiao.selected?.label ?? '',
    price: ctx.price.value,
    produto: metadata.slug,
  }))
```

## Decisões, com o motivo

**`add*` mira sempre um campo ou o form explicitamente.** Nada de contexto
ambiente tipo `onMounted`. Se a regra se anexa ao objeto do campo, `addRule` não
precisa saber a que formulário pertence — e some a armadilha do "chamou fora do
setup" e do "chamou depois de um await".

**Regra anexada não é regra encadeada.** `field().canShow().validate()` foi
recusado: co-loca tudo por entidade e mata a separação por contexto, que é a
filosofia da lib. `addRule(form.cpf, {...})` chamado à parte preserva a
separação — as chamadas podem estar agrupadas ou em outro arquivo.

**Camadas como argumento direto, não como retorno.** Medido: com as camadas
vindo do retorno de uma arrow, a checagem de chave desconhecida funciona mas o
erro aterrissa na função inteira, não na chave. Como argumento direto
(`addRules(form, {...})`) a squiggle fica no lugar certo.

**`metadata` fora do setup.** Setup só produz valor se rodar, e rodar é
instanciar. Metadata precisa ser legível sem instância pro catálogo listar 300
certidões sem criar 300 effect scopes. É a única camada que não depende de
preenchimento — por isso é a única que fica de fora.

**`payload` fora do setup, como passo único.** Vira função pura da superfície
que o setup expõe: testável sem instanciar, incapaz de alcançar o que o setup
não expôs, e define pra que serve o `return` do setup (é o contrato público).
Encadeamento de um passo só não tem ordem pra errar.

**`facts` e `outcome` deixam de ser API.** São `computed` do Vue, expostos pelo
return. A camada continua existindo como conceito; a lib não precisa mais
sustentá-la. Sobram `field`/`fields`, `addRule(s)`, `addSchema(s)` e `payload`.

**Vocabulário igual nos dois formatos.** `canShow` e `schema`, não `when` e
`validate` — dois nomes pra mesma coisa é atrito que não some nunca. E
`.validate()` colidiria com `form.validate()`, que faz outra coisa.

## Fatos medidos

Dois probes, não opinião:

1. **Ordem errada no builder atual**: `rules` antes de `facts` e `payload` antes
   de `outcome` já falham alto (`'ctx.facts' is of type 'unknown'`). O único
   buraco é qualquer coisa **antes de `withFields`**, onde `F` ainda é genérico,
   `FormValues<F>` vira `Record<string, any>` e `OnlyKnownKeys` desliga em
   silêncio.
2. **Diagnóstico no retorno de arrow**: a checagem fira (`never`), mas o erro
   sai na função inteira. É o que justifica `add*` por argumento direto.

## O ctx deixa de ser de graça

A objeção mais forte ao formato setup. O `ctx` do builder era injeção de
dependência dada pela lib: `ctx.facts.isPF` funcionava em rules, schema e
outcome sem ligar nada. **A maquinaria que a gente quer deletar é a que pagava
por isso.** Sem ela, a fiação é do projeto.

Na forma ingênua escala mal — cada fact novo entra na assinatura de todo arquivo
que o usa, o que é pior que `RulesOf<Base>`, não melhor:

```ts
export function regrasDe(
  form: FederalCourtFields,
  isPF: ComputedRef<boolean>,
  isPJ: ComputedRef<boolean>,
  isUrgente: ComputedRef<boolean>,
) { /* ... */ }
```

A saída é agrupar, com o mesmo idioma usado nos campos:

```ts
// context.ts
export const createContext = () => {
  const fields = createFields()

  // reactive() desembrulha os refs: lê-se `facts.isPF`, não `facts.isPF.value`
  const facts = reactive({
    isPF: computed(() => fields.tipoPessoa.value === 'PF'),
    isUrgente: computed(() => fields.prazo.value === 'urgente'),
  })

  return { fields, facts }
}

export type FederalCourtContext = ReturnType<typeof createContext>

// rules.ts — um parâmetro, um tipo, e fact novo não mexe em assinatura
export function regrasDe({ fields, facts }: FederalCourtContext) {
  addRules(fields, { cpf: { canShow: () => facts.isPF, clearWhenHidden: true } })
}
```

Isso é o `ctx` do builder reinventado à mão, e não adianta fingir que não é.

Custa: duas fábricas e uma linha de `ReturnType` por domínio.
Deixa de custar: oito parâmetros de tipo, os cinco `*Of`, o `OnlyKnownKeys`, o
`ctx.shape()`, a armadilha de ordem e a mutação de definição compartilhada.

A diferença que decide: `FederalCourtContext` é derivado de uma fábrica **do
projeto**; `RulesOf<typeof base>` é tipo da lib que só existe porque a lib tem
um problema interno de inferência. Vocabulário contra vazamento.

**Efeito colateral:** contexto montado pelo projeto deixa de ser fechado. Cabe
`useCustomer()`, store, `route.params` — o que é liberdade e é corda. Nada
impede pendurar chamada de API ali e tornar o domínio intestável sem mock. Se
isso virar problema, é convenção no README, não tipo.

## Em aberto

- **`field()` no topo do módulo vaza estado entre requests em SSR.** É o mesmo
  footgun do `ref()` no topo do módulo — modelo mental que o público já tem —
  mas precisa de erro alto em dev, não de nota no README.
- **Forma do return.** `{ fields: form, price }` aninhado é correto e feio;
  plano é bonito e um campo chamado `price` colide em silêncio. Aninhado ganha,
  mas revisar depois de uns cinco domínios escritos.
- **Nome de `fields()`.** O objeto é o formulário em construção, não uma lista
  de campos — `addPayload(form, ...)` lia estranho, e foi parte do que empurrou
  o payload pra fora.
- **`field()` singular ainda não tem caso de uso escrito.** O mais valioso é
  campo reutilizável entre domínios (um CPF com máscara e validação que hoje é
  copiado), com `fields({ cpf, cnpj })` aceitando campo pronto. Vale desenhar
  junto, não depois.
- **Degrau da migração** do formato de componente pro de domínio: se
  `defineFormDomain` aceitar campos que já vieram com regra anexada, a migração
  é gradual — ao custo de regra poder morar em dois lugares.
