import { createFormDomain, field } from '#forms'

export type Pessoa = 'PF' | 'PJ' | ''

/**
 * Só `fields` + `computed` ficam aqui: eles são a FONTE dos tipos. Rules,
 * schema e meta saem para arquivos próprios e importam o tipo deste builder
 * parcial — sem isso haveria import circular.
 */
export const base = createFormDomain('justica-federal')
  .withFields({
    tipo_pessoa: field<Pessoa>({ label: 'Tipo de Pessoa', value: '' }),
    cpf: field({ label: 'CPF', value: '' }),
    cnpj: field({ label: 'CNPJ', value: '' }),
    regiao: field({ label: 'Região', value: '' }),
    // guarda o texto da região escolhida pra ele viajar no payload
    regiao_descricao: field({ label: 'Região (descrição)', value: '' }),
  })
  .withComputed(ctx => ({
    isPF: ctx.values.tipo_pessoa === 'PF',
    isPJ: ctx.values.tipo_pessoa === 'PJ',
  }))

export type Base = typeof base
