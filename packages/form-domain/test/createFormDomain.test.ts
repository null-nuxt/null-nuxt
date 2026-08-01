import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { string } from 'yup'
import { createFormDomain } from '../src/runtime/domain/createFormDomain'
import { field } from '../src/runtime/field'
import { getFormRegistry } from '../src/runtime/registry'

type Pessoa = 'PF' | 'PJ' | ''

const build = (id: string, onChangeSpy = vi.fn()) =>
  createFormDomain(id)
    .withFields({
      tipo_pessoa: field<Pessoa>({ label: 'Tipo de Pessoa', value: '' }),
      cpf: field({ label: 'CPF', value: '' }),
      cnpj: field({ label: 'CNPJ', value: '' }),
      regiao: field({ label: 'Região', value: '', options: [{ label: 'Sul', value: 'sul' }] }),
    })
    .withFacts(ctx => ({
      isPF: ctx.values.tipo_pessoa === 'PF',
      isPJ: ctx.values.tipo_pessoa === 'PJ',
    }))
    .withRules({
      tipo_pessoa: {
        onChange: (value, ctx) => {
          onChangeSpy(value)
          ctx.patch(value === 'PF' ? { cnpj: '' } : { cpf: '' })
        },
      },
      cpf: { canShow: ctx => ctx.facts.isPF },
      cnpj: { canShow: ctx => ctx.facts.isPJ },
      regiao: {
        options: ctx => ctx.facts.isPF
          ? [{ label: 'Sul', value: 'sul' }, { label: 'Norte', value: 'norte' }]
          : [{ label: 'Único', value: 'unico' }],
      },
    })
    .withSchema({
      cpf: string().required('CPF obrigatório'),
      cnpj: string().required('CNPJ obrigatório'),
    })
    .withOutcome(ctx => ({ price: ctx.facts.isPF ? 100 : 250 }))
    .build()

describe('facts compartilhado', () => {
  /**
   * O ponto da camada `facts`: a condição de negócio existe uma vez e é
   * consumida por rules, schema e meta. Antes ela vivia duplicada entre o
   * `canShow` e o `.when()` do schema.
   */
  it('alimenta canShow, options e meta da mesma fonte', async () => {
    const form = build('compartilhado')()

    expect(form.facts.value.isPF).toBe(false)
    expect(form.canShow.value.cpf).toBe(false)
    expect(form.outcome.value.price).toBe(250)

    form.data.tipo_pessoa.value = 'PF'
    await nextTick()

    expect(form.facts.value.isPF).toBe(true)
    expect(form.canShow.value.cpf).toBe(true)
    expect(form.canShow.value.cnpj).toBe(false)
    expect(form.outcome.value.price).toBe(100)
  })
})

describe('options declarativas', () => {
  it('regra vence a lista estática de fields', () => {
    const form = build('options-regra')()
    expect(form.options.value.regiao.map(o => o.value)).toEqual(['unico'])
  })

  it('muda com o contexto sem precisar de reset manual', async () => {
    const form = build('options-contexto')()
    form.data.tipo_pessoa.value = 'PF'
    await nextTick()

    expect(form.options.value.regiao.map(o => o.value)).toEqual(['sul', 'norte'])
  })

  it('campo sem regra usa a lista declarada em fields', () => {
    const form = createFormDomain('options-estatico')
      .withFields({ uf: field({ label: 'UF', value: '', options: [{ label: 'DF', value: 'df' }] }) })
      .build()()

    expect(form.options.value.uf.map(o => o.value)).toEqual(['df'])
  })
})

describe('campo escondido não é validado', () => {
  /**
   * A condição foi dita uma vez, no canShow. O schema não precisa repetir num
   * `.when()` — o engine remove do schema o que a regra escondeu.
   */
  it('remove do schema o campo que canShow escondeu', () => {
    const form = build('hidden-schema')()
    expect(Object.keys(form.shape.value)).not.toContain('cpf')
  })

  it('devolve o campo ao schema quando ele volta a aparecer', async () => {
    const form = build('hidden-volta')()
    form.data.tipo_pessoa.value = 'PF'
    await nextTick()

    expect(Object.keys(form.shape.value)).toContain('cpf')
  })

  /**
   * O teste que realmente sustenta a promessa de "sem `.when()`": não basta o
   * campo sumir da forma do schema, a VALIDAÇÃO precisa passar sem ele. Ambos
   * os documentos são `required()` no arquivo, e mesmo assim uma PF valida com
   * o CNPJ vazio.
   */
  it('PF valida com o CNPJ vazio, mesmo o CNPJ sendo required', async () => {
    const form = build('hidden-valida-pf')()
    form.set({ tipo_pessoa: 'PF', cpf: '11111111111' })
    await nextTick()

    expect((await form.validate()).valid).toBe(true)
  })

  it('PJ continua sendo cobrada pelo CNPJ', async () => {
    const form = build('hidden-valida-pj')()
    form.set({ tipo_pessoa: 'PJ' })
    await nextTick()

    expect((await form.validate()).firstErrors.cnpj).toBe('CNPJ obrigatório')
  })

  it('o documento do grupo oposto não é cobrado nem quando está sujo', async () => {
    const form = build('hidden-valida-sujo')()
    form.set({ tipo_pessoa: 'PJ', cnpj: '22222222222222' })
    await nextTick()

    // cpf está escondido: nem valida nem bloqueia
    expect((await form.validate()).valid).toBe(true)
  })

  /**
   * A razão de `composeSchema` existir: quem compõe na mão fora de um
   * `computed` congela o schema no primeiro valor, e aí o campo que o
   * `canShow` escondeu depois continua exigido.
   */
  it('composeSchema recompõe quando a visibilidade muda', async () => {
    const form = build('hidden-compose')()
    const composto = form.composeSchema(shape => Object.keys(shape))

    expect(composto.value).not.toContain('cpf')

    form.data.tipo_pessoa.value = 'PF'
    await nextTick()

    expect(composto.value).toContain('cpf')
  })

  it('composeSchema entrega os validadores declarados, não uma cópia vazia', () => {
    const form = build('hidden-compose-conteudo')()
    const composto = form.composeSchema(shape => shape)

    expect(composto.value).toBe(form.shape.value)
  })
})

describe('limpeza do campo escondido', () => {
  const buildComClear = (id: string) =>
    createFormDomain(id)
      .withFields({
        tipo: field<Pessoa>({ label: 'Tipo', value: '' }),
        cpf: field({ label: 'CPF', value: '' }),
        cnpj: field({ label: 'CNPJ', value: '' }),
        obs: field({ label: 'Observação', value: '' }),
      })
      .withFacts(ctx => ({ isPF: ctx.values.tipo === 'PF', isPJ: ctx.values.tipo === 'PJ' }))
      .withRules({
        cpf: { canShow: ctx => ctx.facts.isPF, clearWhenHidden: true },
        cnpj: { canShow: ctx => ctx.facts.isPJ, clearWhenHidden: true },
        obs: { canShow: ctx => ctx.facts.isPF },
      })
      .build()

  it('limpa o campo quando ele deixa de aparecer', async () => {
    const form = buildComClear('clear-basico')()
    form.set({ tipo: 'PF', cpf: '111' })
    await nextTick()

    form.data.tipo.value = 'PJ'
    await nextTick()

    expect(form.values.value.cpf).toBe('')
  })

  /**
   * O caso que o `onChange` escrito à mão errava: voltar pra vazio esconde os
   * DOIS grupos, e a versão manual só limpava um.
   */
  it('voltar ao valor vazio limpa os dois grupos', async () => {
    const form = buildComClear('clear-vazio')()
    form.set({ tipo: 'PF', cpf: '111' })
    await nextTick()

    form.data.tipo.value = 'PJ'
    await nextTick()
    form.set({ cnpj: '222' })

    form.data.tipo.value = ''
    await nextTick()

    expect(form.values.value.cpf).toBe('')
    expect(form.values.value.cnpj).toBe('')
  })

  it('campo sem a marca mantém o valor mesmo escondido', async () => {
    const form = buildComClear('clear-optin')()
    form.set({ tipo: 'PF', obs: 'anotação' })
    await nextTick()

    form.data.tipo.value = 'PJ'
    await nextTick()

    expect(form.values.value.obs).toBe('anotação')
  })

  it('não limpa enquanto o campo continua visível', async () => {
    const form = buildComClear('clear-visivel')()
    form.set({ tipo: 'PF', cpf: '111' })
    await nextTick()

    form.set({ obs: 'x' })
    await nextTick()

    expect(form.values.value.cpf).toBe('111')
  })
})

describe('option escolhida', () => {
  const buildComLabel = (id: string) =>
    createFormDomain(id)
      .withFields({
        tipo: field<Pessoa>({ label: 'Tipo', value: '' }),
        regiao: field({ label: 'Região', value: '' }),
      })
      .withFacts(ctx => ({ isPF: ctx.values.tipo === 'PF' }))
      .withRules({
        regiao: {
          options: ctx => ctx.facts.isPF
            ? [{ label: '1ª Região', value: 'primeira' }]
            : [{ label: 'Nacional', value: 'primeira' }],
        },
      })
      .withOutcome(ctx => ({
        // resumo de carrinho quer o texto amigável, não o código
        resumo: `Região: ${ctx.selected.regiao?.label ?? '—'}`,
      }))
      .build()

  it('resolve o label a partir do valor guardado', async () => {
    const form = buildComLabel('label-basico')()
    form.set({ tipo: 'PF', regiao: 'primeira' })
    await nextTick()

    expect(form.selected.value.regiao?.label).toBe('1ª Região')
    expect(form.values.value.regiao).toBe('primeira')
  })

  /**
   * O motivo de derivar em vez de gravar o objeto: se a lista mudar, o texto
   * acompanha. Um label gravado no campo ficaria velho e ninguém perceberia.
   */
  it('o label acompanha quando a lista de options muda', async () => {
    const form = buildComLabel('label-acompanha')()
    form.set({ tipo: 'PF', regiao: 'primeira' })
    await nextTick()
    expect(form.selected.value.regiao?.label).toBe('1ª Região')

    form.data.tipo.value = 'PJ'
    await nextTick()

    expect(form.selected.value.regiao?.label).toBe('Nacional')
    // o valor guardado não mudou: quem mudou foi só o texto
    expect(form.values.value.regiao).toBe('primeira')
  })

  it('valor fora da lista não resolve nenhuma option', async () => {
    const form = buildComLabel('label-orfao')()
    form.set({ regiao: 'inexistente' })
    await nextTick()

    expect(form.selected.value.regiao).toBeUndefined()
  })

  it('meta consegue montar resumo com o texto amigável', async () => {
    const form = buildComLabel('label-meta')()
    form.set({ tipo: 'PF', regiao: 'primeira' })
    await nextTick()

    expect(form.outcome.value.resumo).toBe('Região: 1ª Região')
  })
})

describe('payload: o label da escolha no que sai pro backend', () => {
  /**
   * `data.regiao.label` é o rótulo do CAMPO ("Região") e não pode virar o texto
   * da option ("1ª Região") — são coisas diferentes com o mesmo nome. O texto
   * da escolha entra no payload pela projeção, sem campo fantasma no meio.
   */
  const buildComPayload = (id: string, inicial = '') =>
    createFormDomain(id)
      .withFields({
        regiao: field({ label: 'Região', value: inicial }),
      })
      .withRules({
        regiao: {
          options: () => [
            { label: '1ª Região', value: 'primeira' },
            { label: '2ª Região', value: 'segunda' },
          ],
        },
      })
      .withPayload(ctx => ({
        ...ctx.values,
        regiao_descricao: ctx.selected.regiao?.label ?? '',
      }))
      .build()

  it('o rótulo do campo não é tocado', async () => {
    const form = buildComPayload('payload-rotulo')()
    form.set({ regiao: 'primeira' })
    await nextTick()

    expect(form.data.regiao.label).toBe('Região')
    expect(form.payload.value.regiao_descricao).toBe('1ª Região')
  })

  it('o texto da escolha viaja junto do valor', async () => {
    const form = buildComPayload('payload-texto')()
    form.set({ regiao: 'segunda' })
    await nextTick()

    expect(form.payload.value).toMatchObject({
      regiao: 'segunda',
      regiao_descricao: '2ª Região',
    })
  })

  /**
   * Sem watcher e sem `immediate`: sendo calculado na leitura, um valor
   * restaurado já sai resolvido na primeira leitura.
   */
  it('resolve o valor restaurado sem precisar de uma primeira mudança', () => {
    const form = buildComPayload('payload-restaurado', 'primeira')()
    expect(form.payload.value.regiao_descricao).toBe('1ª Região')
  })

  it('esvazia quando a escolha deixa de existir na lista', async () => {
    const form = buildComPayload('payload-limpa')()
    form.set({ regiao: 'primeira' })
    await nextTick()
    expect(form.payload.value.regiao_descricao).toBe('1ª Região')

    form.set({ regiao: '' })
    await nextTick()

    expect(form.payload.value.regiao_descricao).toBe('')
  })

  /** Sem projeção declarada o payload é `values`, como sempre foi. */
  it('sem withPayload o payload é values', () => {
    const form = createFormDomain('payload-ausente')
      .withFields({ nome: field({ label: 'Nome', value: 'Ana' }) })
      .use()

    expect(form.payload.value).toEqual({ nome: 'Ana' })
  })

  /**
   * `visible` existe pro caso oposto ao de `values`: o documento do grupo
   * escondido não tem por que viajar, e essa decisão é do projeto, não do
   * engine — por isso os dois chegam no contexto.
   */
  it('visible deixa de fora o que o canShow escondeu, values não', async () => {
    const form = createFormDomain('payload-visible')
      .withFields({
        tipo: field<Pessoa>({ label: 'Tipo', value: '' }),
        cpf: field({ label: 'CPF', value: '' }),
      })
      .withFacts(ctx => ({ isPF: ctx.values.tipo === 'PF' }))
      .withRules({ cpf: { canShow: ctx => ctx.facts.isPF } })
      .withPayload(ctx => ({ visible: ctx.visible, todos: ctx.values }))
      .use()

    form.set({ tipo: 'PJ', cpf: '111' })
    await nextTick()

    expect(form.payload.value.visible).not.toHaveProperty('cpf')
    expect(form.payload.value.todos).toHaveProperty('cpf', '111')
  })

  /** O outcome chega no payload, pra um preço não ser recalculado aqui. */
  it('o payload lê o outcome em vez de repetir a conta', () => {
    const form = createFormDomain('payload-outcome')
      .withFields({ tipo: field<Pessoa>({ label: 'Tipo', value: 'PF' }) })
      .withFacts(ctx => ({ isPF: ctx.values.tipo === 'PF' }))
      .withOutcome(ctx => ({ price: ctx.facts.isPF ? 59.9 : 89.9 }))
      .withPayload(ctx => ({ ...ctx.values, price: ctx.outcome.price }))
      .use()

    expect(form.payload.value.price).toBe(59.9)
  })
})

describe('escrita explícita', () => {
  /**
   * O motivo de a escrita ser `ctx.patch()` e não o retorno: um helper que
   * devolve objeto por acaso alterava o formulário sem ninguém pedir, e nada no
   * código do usuário indicava que aquilo escrevia.
   */
  it('retorno da regra não altera o formulário', async () => {
    const form = createFormDomain('retorno-inerte')
      .withFields({
        gatilho: field({ label: 'Gatilho', value: '' }),
        alvo: field({ label: 'Alvo', value: 'intacto' }),
      })
      .withRules({
        // devolve um objeto que ANTES teria sido aplicado
        gatilho: { onChange: () => ({ alvo: 'invadido' }) as never },
      })
      .build()()

    form.data.gatilho.value = 'muda'
    await nextTick()

    expect(form.values.value.alvo).toBe('intacto')
  })
})

describe('onChange assíncrono', () => {
  it('aplica atualização de autopreenchimento', async () => {
    const form = createFormDomain('async-fill')
      .withFields({
        cnpj: field({ label: 'CNPJ', value: '' }),
        cidade: field({ label: 'Cidade', value: '' }),
      })
      .withRules({
        cnpj: {
          onChange: async (_value, ctx) => {
            await Promise.resolve()
            ctx.patch({ cidade: 'Brasília' })
          },
        },
      })
      .build()()

    form.data.cnpj.value = '123'
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(form.values.value.cidade).toBe('Brasília')
  })

  it('descarta resposta obsoleta', async () => {
    const delays: Record<string, number> = { primeiro: 30, segundo: 0 }

    const form = createFormDomain('async-obsoleto')
      .withFields({
        gatilho: field({ label: 'Gatilho', value: '' }),
        resultado: field({ label: 'Resultado', value: '' }),
      })
      .withRules({
        gatilho: {
          onChange: async (value, ctx) => {
            await new Promise(resolve => setTimeout(resolve, delays[value] ?? 0))
            ctx.patch({ resultado: value })
          },
        },
      })
      .build()()

    form.data.gatilho.value = 'primeiro'
    await nextTick()
    form.data.gatilho.value = 'segundo'
    await new Promise(resolve => setTimeout(resolve, 60))

    expect(form.values.value.resultado).toBe('segundo')
  })

  it('ignora chave desconhecida devolvida pela regra', async () => {
    const form = createFormDomain('retorno-invalido')
      .withFields({
        gatilho: field({ label: 'Gatilho', value: '' }),
        alvo: field({ label: 'Alvo', value: 'intacto' }),
      })
      .withRules({
        gatilho: { onChange: (_value, ctx) => ctx.patch({ inexistente: 'x' } as never) },
      })
      .build()()

    form.data.gatilho.value = 'muda'
    await nextTick()

    expect(form.values.value.alvo).toBe('intacto')
    expect(form.values.value).not.toHaveProperty('inexistente')
  })
})

describe('schema dependente do contexto', () => {
  /**
   * O caso que a remoção do campo escondido NÃO cobre: o campo continua
   * visível, só a regra muda. É aqui que o ctx no schema ganha função.
   */
  const buildComRegra = (id: string) =>
    createFormDomain(id)
      .withFields({
        tipo: field<Pessoa>({ label: 'Tipo', value: '' }),
        regiao: field({ label: 'Região', value: '' }),
      })
      .withFacts(ctx => ({ isPJ: ctx.values.tipo === 'PJ' }))
      .withSchema(ctx => ctx.shape({
        regiao: ctx.facts.isPJ
          ? string().required('PJ precisa informar a região')
          : string().nullable(),
      }))
      .build()

  it('aplica a regra permissiva quando o contexto não exige', async () => {
    const form = buildComRegra('schema-ctx-livre')()
    expect((await form.validate()).errors.regiao).toBeUndefined()
  })

  it('aperta a regra quando o contexto muda, com o campo ainda visível', async () => {
    const form = buildComRegra('schema-ctx-restrito')()
    form.data.tipo.value = 'PJ'
    await nextTick()

    expect(form.canShow.value.regiao).toBe(true)
    expect((await form.validate()).errors.regiao).toBeDefined()
  })
})

describe('coerência entre options e schema', () => {
  const REGIOES_PF = [{ label: '1ª', value: 'primeira' }]
  const REGIOES_PJ = [{ label: 'Nacional', value: 'nacional' }]

  const regioesDe = (ctx: { facts: { isPF: boolean, isPJ: boolean } }) => {
    if (ctx.facts.isPF) return REGIOES_PF
    if (ctx.facts.isPJ) return REGIOES_PJ
    return []
  }

  const buildCoerente = (id: string) =>
    createFormDomain(id)
      .withFields({
        tipo: field<Pessoa>({ label: 'Tipo', value: '' }),
        regiao: field({ label: 'Região', value: '' }),
      })
      .withFacts(ctx => ({ isPF: ctx.values.tipo === 'PF', isPJ: ctx.values.tipo === 'PJ' }))
      .withRules({
        // região continua VISÍVEL ao trocar de tipo, então canShow não resolve:
        // o que mudou foi o conjunto de valores aceitos
        tipo: { onChange: (_value, ctx) => ctx.patch({ regiao: '' }) },
        regiao: {
          canShow: ctx => ctx.facts.isPF || ctx.facts.isPJ,
          options: regioesDe,
        },
      })
      .withSchema(ctx => ctx.shape({
        regiao: string().oneOf(regioesDe(ctx).map(o => o.value), 'Região inválida'),
      }))
      .build()

  it('sem tipo escolhido as options ficam vazias, não as do outro tipo', () => {
    const form = buildCoerente('coerente-vazio')()
    expect(form.options.value.regiao).toEqual([])
  })

  it('trocar de tipo descarta a região que deixou de ser válida', async () => {
    const form = buildCoerente('coerente-troca')()
    form.set({ tipo: 'PF' })
    await nextTick()
    form.set({ regiao: 'primeira' })
    await nextTick()

    form.data.tipo.value = 'PJ'
    await nextTick()

    expect(form.values.value.regiao).toBe('')
  })

  /** A UI oferece uma lista; o schema tem que recusar o que está fora dela. */
  it('schema recusa valor que não está nas options do contexto', async () => {
    const form = buildCoerente('coerente-schema')()
    form.set({ tipo: 'PJ' })
    await nextTick()

    // 'primeira' vale pra PF, não pra PJ
    form.set({ regiao: 'primeira' })
    await nextTick()
    expect((await form.validate()).errors.regiao).toBeDefined()

    form.set({ regiao: 'nacional' })
    await nextTick()
    expect((await form.validate()).errors.regiao).toBeUndefined()
  })
})

describe('uso simples e inline', () => {
  const definir = (id: string) =>
    createFormDomain(id)
      .withFields({
        nome: field({ label: 'Nome Completo', value: '', placeholder: 'Digite seu nome' }),
        perfil: field({ label: 'Perfil', value: '', options: [{ label: 'Advogado', value: 'adv' }] }),
      })

  it('`use()` devolve a instância direto, sem chamar o composable', () => {
    const form = definir('inline-direto').use()
    expect(form.values.value.nome).toBe('')
  })

  /**
   * O motivo de `use()` existir separado de `build()`: definição declarada
   * dentro de um componente costuma capturar `props`. Se a instância fosse
   * compartilhada por id, o segundo componente herdaria as props do primeiro.
   */
  it('cada `use()` tem estado próprio', () => {
    const definicao = definir('inline-isolado')

    const primeiro = definicao.use()
    const segundo = definicao.use()

    primeiro.set({ nome: 'Ana' })

    expect(segundo.values.value.nome).toBe('')
    expect(primeiro).not.toBe(segundo)
  })

  it('`build()` continua compartilhando, como antes', () => {
    const useForm = definir('inline-compartilhado').build()
    expect(useForm()).toBe(useForm())
  })
})

describe('register: props prontas pro input', () => {
  const form = createFormDomain('register')
    .withFields({
      nome: field({ label: 'Nome Completo', value: 'Ana', placeholder: 'Digite' }),
      cpf: field({ label: 'CPF', value: '', mask: 'cpf' }),
      perfil: field({ label: 'Perfil', value: '', options: [{ label: 'Advogado', value: 'adv' }] }),
    })
    .use()

  it('entrega name, label e o vínculo de v-model', () => {
    const bindings = form.register('nome')

    expect(bindings.name).toBe('nome')
    expect(bindings.label).toBe('Nome Completo')
    expect(bindings.modelValue).toBe('Ana')
  })

  it('o handler escreve no campo', () => {
    form.register('nome')['onUpdate:modelValue']('Bruno')
    expect(form.values.value.nome).toBe('Bruno')
  })

  /**
   * Chave que o componente não declara vira atributo solto no DOM, então só
   * mandamos o que existe.
   */
  it('não manda options nem mask quando o campo não tem', () => {
    const bindings = form.register('nome')

    expect(bindings).not.toHaveProperty('options')
    expect(bindings).not.toHaveProperty('mask')
    expect(bindings.placeholder).toBe('Digite')
  })

  it('manda options e mask quando existem', () => {
    expect(form.register('perfil').options?.map(o => o.value)).toEqual(['adv'])
    expect(form.register('cpf').mask).toBe('cpf')
  })

  /**
   * O handler aceita `undefined` porque um componente com `defineModel<string>()`
   * emite `string | undefined` — sem isso o `v-bind` nem compila. O que chega é
   * o que o campo passa a guardar: quem espera receber `undefined` de verdade
   * declara o campo como `value: '' as string | undefined`.
   */
  it('escreve o que o componente emitir, inclusive undefined', () => {
    form.register('nome')['onUpdate:modelValue'](undefined)
    expect(form.values.value.nome).toBeUndefined()

    form.register('nome')['onUpdate:modelValue']('Ana')
    expect(form.values.value.nome).toBe('Ana')
  })
})

describe('metadata: entrada de catálogo', () => {
  const definirComMetadata = (id: string) =>
    createFormDomain(id)
      .withMetadata({ title: 'Certidão X', to: '/x', order: 10 })
      .withFields({ nome: field({ label: 'Nome', value: '' }) })

  /**
   * A razão de `metadata` existir separado do `outcome`: uma listagem de
   * catálogo precisa de título e rota sem que exista formulário preenchido
   * nenhum. Se isto voltar a sair da instância, listar 300 certidões volta a
   * criar 300 effect scopes.
   */
  it('lê metadata da factory sem instanciar o domínio', () => {
    const useForm = definirComMetadata('metadata-sem-instancia').build()

    expect(useForm.metadata.title).toBe('Certidão X')
    expect(useForm.id).toBe('metadata-sem-instancia')
    expect(getFormRegistry().has('metadata-sem-instancia')).toBe(false)

    useForm()
    expect(getFormRegistry().has('metadata-sem-instancia')).toBe(true)
  })

  it('a instância também expõe metadata, com o mesmo conteúdo', () => {
    const useForm = definirComMetadata('metadata-na-instancia').build()
    expect(useForm().metadata).toEqual(useForm.metadata)
  })

  it('domínio sem metadata declarada recebe um objeto vazio', () => {
    const form = createFormDomain('metadata-ausente')
      .withFields({ nome: field({ label: 'Nome', value: '' }) })
      .use()

    expect(form.metadata).toEqual({})
  })
})

describe('key do campo', () => {
  it('cada campo conhece a própria chave', () => {
    const form = createFormDomain('field-key')
      .withFields({ email: field({ label: 'E-mail', value: '' }) })
      .use()

    expect(form.data.email.key).toBe('email')
  })
})

describe('identidade e efeitos', () => {
  it('devolve a mesma instância, como defineStore', () => {
    const useForm = build('identidade')
    expect(useForm()).toBe(useForm())
  })

  it('onChange roda uma vez só com vários consumidores', async () => {
    const spy = vi.fn()
    const useForm = build('varios', spy)

    const pai = useForm()
    useForm()
    useForm()

    pai.data.tipo_pessoa.value = 'PF'
    await nextTick()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('reset volta aos valores iniciais', async () => {
    const form = build('reset')()
    form.set({ cpf: '123' })
    form.reset()

    expect(form.values.value.cpf).toBe('')
  })

  it('não vaza mutação entre domínios que compartilham a definição', () => {
    const fields = { nome: field({ label: 'Nome', value: 'inicial' }) }

    const primeiro = createFormDomain('clone-1').withFields(fields).build()()
    primeiro.data.nome.value = 'alterado'

    const segundo = createFormDomain('clone-2').withFields(fields).build()()
    expect(segundo.data.nome.value).toBe('inicial')
  })
})
