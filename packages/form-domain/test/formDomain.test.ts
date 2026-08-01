import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { string } from 'yup'
import { addRule, addRules, addSchemas } from '../src/runtime/register'
import { defineFormDomain, toForm } from '../src/runtime/define'
import { refField, refFields } from '../src/runtime/field'
import { getFormRegistry } from '../src/runtime/registry'

type Pessoa = 'PF' | 'PJ' | ''

const montar = () => {
  const f = refFields({
    tipoPessoa: { label: 'Tipo de Pessoa', value: '' as Pessoa },
    cpf: { label: 'CPF', value: '' },
    cnpj: { label: 'CNPJ', value: '' },
    regiao: { label: 'Região', value: '' },
  })

  addRules(f, {
    cpf: { canShow: () => f.tipoPessoa.value === 'PF', clearWhenHidden: true },
    cnpj: { canShow: () => f.tipoPessoa.value === 'PJ', clearWhenHidden: true },
    regiao: {
      options: () => f.tipoPessoa.value === 'PF'
        ? [{ label: '1ª Região', value: 'primeira' }]
        : [{ label: 'Única', value: 'unica' }],
    },
  })

  addSchemas(f, {
    cpf: string().required('CPF obrigatório'),
    cnpj: string().required('CNPJ obrigatório'),
  })

  return f
}

describe('setup: montagem em componente', () => {
  it('deriva values e canShow das regras anexadas ao campo', async () => {
    const form = toForm(montar())

    expect(form.canShow.value.cpf).toBe(false)

    form.set({ tipoPessoa: 'PF' })
    await nextTick()

    expect(form.canShow.value.cpf).toBe(true)
    expect(form.canShow.value.cnpj).toBe(false)
  })

  /** A promessa de "sem `.when()`": campo escondido nem entra na validação. */
  it('PF valida com o CNPJ vazio, mesmo o CNPJ sendo required', async () => {
    const form = toForm(montar())
    form.set({ tipoPessoa: 'PF', cpf: '11111111111' })
    await nextTick()

    expect((await form.validate()).valid).toBe(true)
  })

  it('limpa o campo que deixou de aparecer', async () => {
    const form = toForm(montar())
    form.set({ tipoPessoa: 'PF', cpf: '111' })
    await nextTick()

    form.set({ tipoPessoa: 'PJ' })
    await nextTick()

    expect(form.values.value.cpf).toBe('')
  })

  it('visible deixa de fora o que a regra escondeu; values não', async () => {
    const form = toForm(montar())
    form.set({ tipoPessoa: 'PJ', cnpj: '222' })
    await nextTick()

    expect(form.visible.value).not.toHaveProperty('cpf')
    expect(form.values.value).toHaveProperty('cpf')
  })

  it('options da regra vencem, e selected resolve o texto', async () => {
    const f = montar()
    const form = toForm(f)

    form.set({ tipoPessoa: 'PF', regiao: 'primeira' })
    await nextTick()

    expect(form.options.value.regiao.map(o => o.value)).toEqual(['primeira'])
    expect(f.regiao.selected?.label).toBe('1ª Região')
  })

  /** Derivado, não guardado: muda a lista e o texto acompanha em vez de envelhecer. */
  it('selected esvazia quando a escolha sai da lista', async () => {
    const f = montar()
    toForm(f)

    f.tipoPessoa.value = 'PF'
    f.regiao.value = 'primeira'
    await nextTick()
    expect(f.regiao.selected?.label).toBe('1ª Região')

    f.tipoPessoa.value = 'PJ'
    await nextTick()

    expect(f.regiao.selected).toBeUndefined()
  })

  it('register manda só o que o campo tem', () => {
    const f = refFields({
      nome: { label: 'Nome', value: 'Ana', placeholder: 'Digite' },
      perfil: { label: 'Perfil', value: '', options: [{ label: 'Advogado', value: 'adv' }] },
    })
    const form = toForm(f)

    expect(form.register('nome')).not.toHaveProperty('options')
    expect(form.register('nome').placeholder).toBe('Digite')
    expect(form.register('perfil').options?.map(o => o.value)).toEqual(['adv'])
  })

  it('o handler escreve o que o componente emitir', () => {
    const form = toForm(refFields({ nome: { label: 'Nome', value: '' } }))

    form.register('nome')['onUpdate:modelValue']('Ana')
    expect(form.values.value.nome).toBe('Ana')
  })

  it('onChange descarta resposta obsoleta', async () => {
    const spy = vi.fn()
    const f = refFields({
      gatilho: { label: 'Gatilho', value: '' },
      alvo: { label: 'Alvo', value: '' },
    })

    addRule(f.gatilho, {
      onChange: (value, ctx) => {
        spy(value)
        ctx.patch({ alvo: `de-${value}` })
      },
    })

    const form = toForm(f)
    f.gatilho.value = 'x'
    await nextTick()

    expect(spy).toHaveBeenCalledWith('x')
    expect(form.values.value.alvo).toBe('de-x')
  })
})

describe('setup: campo avulso reutilizável', () => {
  /** O caso que justifica `refField()` singular: um campo com máscara compartilhado. */
  it('aceita um refField() pronto ao lado das declarações', () => {
    const cpf = refField({ label: 'CPF', value: '', mask: 'cpf' })

    const form = toForm(refFields({ cpf, nome: { label: 'Nome', value: '' } }))

    expect(form.register('cpf').mask).toBe('cpf')
    // a chave só é aprendida na montagem
    expect(form.fields.cpf.key).toBe('cpf')
  })
})

describe('setup: domínio compartilhado', () => {
  const definir = (id: string) => defineFormDomain(id, { title: 'Certidão', order: 10 }, () => {
    const f = montar()
    return { fields: f, isPF: { value: f.tipoPessoa.value === 'PF' } }
  })

  it('lê metadata da factory sem instanciar', () => {
    const domain = definir('setup-metadata')

    expect(domain.metadata.title).toBe('Certidão')
    expect(getFormRegistry().has('setup-metadata')).toBe(false)

    domain()
    expect(getFormRegistry().has('setup-metadata')).toBe(true)
  })

  it('compartilha a instância, como defineStore', () => {
    const domain = definir('setup-compartilhado')
    expect(domain()).toBe(domain())
  })

  it('expõe o que o setup devolveu além dos campos', () => {
    const domain = definir('setup-exposto')
    expect(domain().isPF).toEqual({ value: false })
  })

  it('sem projeção, o payload é values', () => {
    const domain = defineFormDomain('setup-sem-payload', () => ({
      fields: refFields({ nome: { label: 'Nome', value: 'Ana' } }),
    }))

    expect(domain().payload.value).toEqual({ nome: 'Ana' })
  })

  it('a projeção recebe visible e o que o setup expôs', async () => {
    const domain = defineFormDomain('setup-payload', () => {
      const f = montar()
      return { fields: f, price: { value: 59.9 } }
    }).payload(ctx => ({
      ...ctx.visible,
      regiao_descricao: ctx.fields.regiao.selected?.label ?? '',
      price: ctx.price.value,
    }))

    const form = domain()
    form.set({ tipoPessoa: 'PF', regiao: 'primeira' })
    await nextTick()

    expect(form.payload.value).not.toHaveProperty('cnpj')
    expect(form.payload.value.regiao_descricao).toBe('1ª Região')
    expect(form.payload.value.price).toBe(59.9)
  })

  it('metadata é opcional', () => {
    const domain = defineFormDomain('setup-sem-metadata', () => ({
      fields: refFields({ nome: { label: 'Nome', value: '' } }),
    }))

    expect(domain.metadata).toEqual({})
    expect(domain().values.value.nome).toBe('')
  })
})

describe('setup: guarda de estado compartilhado entre requests', () => {
  /**
   * O furo que os tipos não pegam: `refFields()` no topo de um módulo roda uma vez
   * por processo, então sob SSR a segunda request dirige os mesmos objetos que a
   * primeira preencheu. A guarda não checa "tinha escopo quando criou" — isso
   * dispararia em teste e em qualquer helper — e sim a condição que É o bug:
   * uma fields object dirigindo dois formulários.
   */
  it('avisa quando a mesma fields object vira um segundo formulário', () => {
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const compartilhados = refFields({ nome: { label: 'Nome', value: '' } })

    toForm(compartilhados)
    expect(avisos).not.toHaveBeenCalled()

    toForm(compartilhados)
    expect(avisos).toHaveBeenCalledOnce()
    expect(avisos.mock.calls[0]?.[0]).toContain('module scope')

    avisos.mockRestore()
  })

  it('não avisa quando cada formulário monta os seus', () => {
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const criar = () => refFields({ nome: { label: 'Nome', value: '' } })

    toForm(criar())
    toForm(criar())

    expect(avisos).not.toHaveBeenCalled()
    avisos.mockRestore()
  })

  /** Descartar devolve os campos, senão remontar o mesmo form acusaria à toa. */
  it('não avisa ao remontar depois de descartar', () => {
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const campos = refFields({ nome: { label: 'Nome', value: '' } })

    toForm(campos).dispose()
    toForm(campos)

    expect(avisos).not.toHaveBeenCalled()
    avisos.mockRestore()
  })

  /**
   * O caso real sob SSR: o setup devolve campos de módulo, e a segunda request
   * roda o setup de novo recebendo os MESMOS objetos.
   */
  it('pega o domínio cujo setup devolve campos de módulo', () => {
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deModulo = refFields({ nome: { label: 'Nome', value: '' } })

    const domain = defineFormDomain('setup-vazamento', () => ({ fields: deModulo }))

    domain()
    getFormRegistry().delete('setup-vazamento') // simula a request seguinte
    domain()

    expect(avisos).toHaveBeenCalledOnce()
    avisos.mockRestore()
  })
})

describe('campo escondido: validação', () => {
  it('PJ continua sendo cobrada pelo CNPJ', async () => {
    const form = toForm(montar())
    form.set({ tipoPessoa: 'PJ' })
    await nextTick()

    expect((await form.validate()).firstErrors.cnpj).toBe('CNPJ obrigatório')
  })

  it('o documento do grupo oposto não é cobrado nem quando está sujo', async () => {
    const f = montar()
    const form = toForm(f)

    // preenche o CPF enquanto ele ainda aparece, depois troca de grupo
    form.set({ tipoPessoa: 'PF', cpf: '11111111111' })
    await nextTick()
    form.set({ tipoPessoa: 'PJ', cnpj: '22222222222222' })
    await nextTick()

    expect((await form.validate()).valid).toBe(true)
  })

  it('devolve o campo à validação quando ele volta a aparecer', async () => {
    const form = toForm(montar())
    expect(Object.keys(form.shape.value)).not.toContain('cpf')

    form.set({ tipoPessoa: 'PF' })
    await nextTick()

    expect(Object.keys(form.shape.value)).toContain('cpf')
  })
})

describe('composeSchema', () => {
  /**
   * A razão de existir: quem compõe na mão fora de um `computed` congela o
   * schema no primeiro valor, e o campo que a regra escondeu depois continua
   * exigido.
   */
  it('recompõe quando a visibilidade muda', async () => {
    const form = toForm(montar())
    const composto = form.composeSchema(shape => Object.keys(shape))

    expect(composto.value).not.toContain('cpf')

    form.set({ tipoPessoa: 'PF' })
    await nextTick()

    expect(composto.value).toContain('cpf')
  })

  it('entrega os validadores declarados, não uma cópia vazia', () => {
    const form = toForm(montar())
    expect(form.composeSchema(shape => shape).value).toBe(form.shape.value)
  })
})

describe('limpeza do campo escondido', () => {
  const comObs = () => {
    const f = refFields({
      tipo: { label: 'Tipo', value: '' as Pessoa },
      cpf: { label: 'CPF', value: '' },
      cnpj: { label: 'CNPJ', value: '' },
      obs: { label: 'Observação', value: '' },
    })

    addRules(f, {
      cpf: { canShow: () => f.tipo.value === 'PF', clearWhenHidden: true },
      cnpj: { canShow: () => f.tipo.value === 'PJ', clearWhenHidden: true },
      obs: { canShow: () => f.tipo.value === 'PF' },
    })

    return f
  }

  /**
   * O caso que o `onChange` escrito à mão errava: voltar pra vazio esconde os
   * DOIS grupos, e a versão manual só limpava um.
   */
  it('voltar ao valor vazio limpa os dois grupos', async () => {
    const form = toForm(comObs())

    form.set({ tipo: 'PF', cpf: '111' })
    await nextTick()
    form.set({ tipo: 'PJ' })
    await nextTick()
    form.set({ cnpj: '222' })
    form.set({ tipo: '' })
    await nextTick()

    expect(form.values.value.cpf).toBe('')
    expect(form.values.value.cnpj).toBe('')
  })

  /** Opt-in porque apaga dado: num multi-etapa o escondido costuma guardar. */
  it('campo sem a marca mantém o valor mesmo escondido', async () => {
    const form = toForm(comObs())

    form.set({ tipo: 'PF', obs: 'anotação' })
    await nextTick()
    form.set({ tipo: 'PJ' })
    await nextTick()

    expect(form.values.value.obs).toBe('anotação')
  })

  it('não limpa enquanto o campo continua visível', async () => {
    const form = toForm(comObs())

    form.set({ tipo: 'PF', cpf: '111' })
    await nextTick()
    form.set({ cpf: '222' })
    await nextTick()

    expect(form.values.value.cpf).toBe('222')
  })
})

describe('coerência entre options e schema', () => {
  /**
   * Uma fonte só para as duas coisas. Sem isso, a lista da UI e a do backend
   * divergem em silêncio — o select oferece o que o schema recusa.
   */
  const REGIOES_PF = [{ label: '1ª', value: 'primeira' }]
  const REGIOES_PJ = [{ label: 'Nacional', value: 'nacional' }]

  const comRegiao = () => {
    const f = refFields({
      tipo: { label: 'Tipo', value: '' as Pessoa },
      regiao: { label: 'Região', value: '' },
    })

    const lista = () => {
      if (f.tipo.value === 'PF') return REGIOES_PF
      if (f.tipo.value === 'PJ') return REGIOES_PJ
      return []
    }

    addRules(f, { regiao: { options: lista } })
    addSchemas(f, {
      regiao: () => string().oneOf(lista().map(o => o.value), 'Região inválida').required(),
    })

    return f
  }

  it('sem tipo escolhido as options ficam vazias, não as do outro tipo', () => {
    const form = toForm(comRegiao())
    expect(form.options.value.regiao).toEqual([])
  })

  it('o schema recusa valor que não está nas options do contexto', async () => {
    const form = toForm(comRegiao())

    form.set({ tipo: 'PF', regiao: 'nacional' })
    await nextTick()
    expect((await form.validate()).errors.regiao).toBeDefined()

    form.set({ regiao: 'primeira' })
    await nextTick()
    expect((await form.validate()).errors.regiao).toBeUndefined()
  })
})

describe('onChange: escrita explícita', () => {
  const comAutofill = (responder: (valor: string) => Promise<string>) => {
    const f = refFields({
      cep: { label: 'CEP', value: '' },
      cidade: { label: 'Cidade', value: '' },
    })

    addRule(f.cep, {
      onChange: async (valor, ctx) => {
        const cidade = await responder(valor)
        ctx.patch({ cidade })
      },
    })

    return f
  }

  it('aplica atualização de autopreenchimento', async () => {
    const form = toForm(comAutofill(async () => 'Recife'))

    form.set({ cep: '50000000' })
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(form.values.value.cidade).toBe('Recife')
  })

  /**
   * O ponto do `patch` ser pedido e não escrita: uma consulta lenta não pode
   * sobrescrever o que o usuário digitou depois.
   */
  it('descarta resposta obsoleta', async () => {
    const atrasos: Record<string, number> = { primeiro: 20, segundo: 1 }

    const form = toForm(comAutofill(async (valor) => {
      await new Promise(resolve => setTimeout(resolve, atrasos[valor] ?? 0))
      return `cidade-${valor}`
    }))

    form.set({ cep: 'primeiro' })
    await nextTick()
    form.set({ cep: 'segundo' })
    await nextTick()

    await new Promise(resolve => setTimeout(resolve, 40))

    // o primeiro respondeu por último, e mesmo assim não venceu
    expect(form.values.value.cidade).toBe('cidade-segundo')
  })

  it('ignora chave desconhecida devolvida pela regra', async () => {
    const f = refFields({ gatilho: { label: 'Gatilho', value: '' } })
    addRule(f.gatilho, {
      onChange: (_valor, ctx) => ctx.patch({ naoExiste: 'x' } as never),
    })

    const form = toForm(f)
    f.gatilho.value = 'x'
    await nextTick()

    expect(form.values.value).toEqual({ gatilho: 'x' })
  })
})

describe('instância e efeitos', () => {
  it('reset volta aos valores iniciais', async () => {
    const form = toForm(montar())

    form.set({ tipoPessoa: 'PF', cpf: '111' })
    await nextTick()
    form.reset()

    expect(form.values.value.cpf).toBe('')
    expect(form.values.value.tipoPessoa).toBe('')
  })

  it('cada montagem tem estado próprio', () => {
    const primeiro = toForm(montar())
    const segundo = toForm(montar())

    primeiro.set({ cpf: '111' })

    expect(segundo.values.value.cpf).toBe('')
  })

  /** Sub-componente consome a mesma instância sem registrar os efeitos de novo. */
  it('onChange roda uma vez só com vários consumidores', async () => {
    const spy = vi.fn()

    const domain = defineFormDomain('efeitos-uma-vez', () => {
      const f = refFields({ gatilho: { label: 'Gatilho', value: '' } })
      addRule(f.gatilho, { onChange: valor => spy(valor) })
      return { fields: f }
    })

    const pai = domain()
    domain()
    domain()

    pai.set({ gatilho: 'x' })
    await nextTick()

    expect(spy).toHaveBeenCalledOnce()
  })
})
