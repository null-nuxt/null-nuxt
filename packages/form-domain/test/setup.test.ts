import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { string } from 'yup'
import { addRule, addRules, addSchemas } from '../src/runtime/setup/register'
import { defineFormDomain, useForm } from '../src/runtime/setup/define'
import { field, fields } from '../src/runtime/setup/field'
import { getFormRegistry } from '../src/runtime/registry'

type Pessoa = 'PF' | 'PJ' | ''

const montar = () => {
  const f = fields({
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
    const form = useForm(montar())

    expect(form.canShow.value.cpf).toBe(false)

    form.set({ tipoPessoa: 'PF' })
    await nextTick()

    expect(form.canShow.value.cpf).toBe(true)
    expect(form.canShow.value.cnpj).toBe(false)
  })

  /** A promessa de "sem `.when()`": campo escondido nem entra na validação. */
  it('PF valida com o CNPJ vazio, mesmo o CNPJ sendo required', async () => {
    const form = useForm(montar())
    form.set({ tipoPessoa: 'PF', cpf: '11111111111' })
    await nextTick()

    expect((await form.validate()).valid).toBe(true)
  })

  it('limpa o campo que deixou de aparecer', async () => {
    const form = useForm(montar())
    form.set({ tipoPessoa: 'PF', cpf: '111' })
    await nextTick()

    form.set({ tipoPessoa: 'PJ' })
    await nextTick()

    expect(form.values.value.cpf).toBe('')
  })

  it('visible deixa de fora o que a regra escondeu; values não', async () => {
    const form = useForm(montar())
    form.set({ tipoPessoa: 'PJ', cnpj: '222' })
    await nextTick()

    expect(form.visible.value).not.toHaveProperty('cpf')
    expect(form.values.value).toHaveProperty('cpf')
  })

  it('options da regra vencem, e selected resolve o texto', async () => {
    const f = montar()
    const form = useForm(f)

    form.set({ tipoPessoa: 'PF', regiao: 'primeira' })
    await nextTick()

    expect(form.options.value.regiao.map(o => o.value)).toEqual(['primeira'])
    expect(f.regiao.selected?.label).toBe('1ª Região')
  })

  /** Derivado, não guardado: muda a lista e o texto acompanha em vez de envelhecer. */
  it('selected esvazia quando a escolha sai da lista', async () => {
    const f = montar()
    useForm(f)

    f.tipoPessoa.value = 'PF'
    f.regiao.value = 'primeira'
    await nextTick()
    expect(f.regiao.selected?.label).toBe('1ª Região')

    f.tipoPessoa.value = 'PJ'
    await nextTick()

    expect(f.regiao.selected).toBeUndefined()
  })

  it('register manda só o que o campo tem', () => {
    const f = fields({
      nome: { label: 'Nome', value: 'Ana', placeholder: 'Digite' },
      perfil: { label: 'Perfil', value: '', options: [{ label: 'Advogado', value: 'adv' }] },
    })
    const form = useForm(f)

    expect(form.register('nome')).not.toHaveProperty('options')
    expect(form.register('nome').placeholder).toBe('Digite')
    expect(form.register('perfil').options?.map(o => o.value)).toEqual(['adv'])
  })

  it('o handler escreve o que o componente emitir', () => {
    const form = useForm(fields({ nome: { label: 'Nome', value: '' } }))

    form.register('nome')['onUpdate:modelValue']('Ana')
    expect(form.values.value.nome).toBe('Ana')
  })

  it('onChange descarta resposta obsoleta', async () => {
    const spy = vi.fn()
    const f = fields({
      gatilho: { label: 'Gatilho', value: '' },
      alvo: { label: 'Alvo', value: '' },
    })

    addRule(f.gatilho, {
      onChange: (value, ctx) => {
        spy(value)
        ctx.patch({ alvo: `de-${value}` })
      },
    })

    const form = useForm(f)
    f.gatilho.value = 'x'
    await nextTick()

    expect(spy).toHaveBeenCalledWith('x')
    expect(form.values.value.alvo).toBe('de-x')
  })
})

describe('setup: campo avulso reutilizável', () => {
  /** O caso que justifica `field()` singular: um campo com máscara compartilhado. */
  it('aceita um field() pronto ao lado das declarações', () => {
    const cpf = field({ label: 'CPF', value: '', mask: 'cpf' })

    const form = useForm(fields({ cpf, nome: { label: 'Nome', value: '' } }))

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
      fields: fields({ nome: { label: 'Nome', value: 'Ana' } }),
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
      fields: fields({ nome: { label: 'Nome', value: '' } }),
    }))

    expect(domain.metadata).toEqual({})
    expect(domain().values.value.nome).toBe('')
  })
})

describe('setup: guarda de estado compartilhado entre requests', () => {
  /**
   * O furo que os tipos não pegam: `fields()` no topo de um módulo roda uma vez
   * por processo, então sob SSR a segunda request dirige os mesmos objetos que a
   * primeira preencheu. A guarda não checa "tinha escopo quando criou" — isso
   * dispararia em teste e em qualquer helper — e sim a condição que É o bug:
   * uma fields object dirigindo dois formulários.
   */
  it('avisa quando a mesma fields object vira um segundo formulário', () => {
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const compartilhados = fields({ nome: { label: 'Nome', value: '' } })

    useForm(compartilhados)
    expect(avisos).not.toHaveBeenCalled()

    useForm(compartilhados)
    expect(avisos).toHaveBeenCalledOnce()
    expect(avisos.mock.calls[0]?.[0]).toContain('module scope')

    avisos.mockRestore()
  })

  it('não avisa quando cada formulário monta os seus', () => {
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const criar = () => fields({ nome: { label: 'Nome', value: '' } })

    useForm(criar())
    useForm(criar())

    expect(avisos).not.toHaveBeenCalled()
    avisos.mockRestore()
  })

  /** Descartar devolve os campos, senão remontar o mesmo form acusaria à toa. */
  it('não avisa ao remontar depois de descartar', () => {
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const campos = fields({ nome: { label: 'Nome', value: '' } })

    useForm(campos).dispose()
    useForm(campos)

    expect(avisos).not.toHaveBeenCalled()
    avisos.mockRestore()
  })

  /**
   * O caso real sob SSR: o setup devolve campos de módulo, e a segunda request
   * roda o setup de novo recebendo os MESMOS objetos.
   */
  it('pega o domínio cujo setup devolve campos de módulo', () => {
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deModulo = fields({ nome: { label: 'Nome', value: '' } })

    const domain = defineFormDomain('setup-vazamento', () => ({ fields: deModulo }))

    domain()
    getFormRegistry().delete('setup-vazamento') // simula a request seguinte
    domain()

    expect(avisos).toHaveBeenCalledOnce()
    avisos.mockRestore()
  })
})
