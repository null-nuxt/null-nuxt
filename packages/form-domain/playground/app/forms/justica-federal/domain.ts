import { createFormDomain, field } from '#forms'

export type Pessoa = 'PF' | 'PJ' | ''

/**
 * Só `fields` + `facts` ficam aqui: eles são a FONTE dos tipos. Rules, schema e
 * outcome saem para arquivos próprios e importam o tipo deste builder parcial —
 * sem isso haveria import circular.
 *
 * `metadata` é a entrada de catálogo: nada aqui depende de alguém preencher o
 * formulário, e é por isso que `useFormDomainsMetadata()` lê tudo isto sem
 * instanciar domínio nenhum.
 */
export const base = createFormDomain('justica-federal')
  .withMetadata({
    title: 'Certidão Negativa Criminal — Justiça Federal',
    description: 'Certidão de distribuição criminal emitida pela Justiça Federal.',
    to: '/servicos/certidao/justica-federal',
    category: 'certidoes',
    keywords: ['justiça federal', 'certidão criminal', 'distribuição'],
    order: 120,
  })
  .withFields({
    tipo_pessoa: field<Pessoa>({ label: 'Tipo de Pessoa', value: '' }),
    cpf: field({ label: 'CPF', value: '' }),
    cnpj: field({ label: 'CNPJ', value: '' }),
    regiao: field({ label: 'Região', value: '' }),
  })
  .withFacts(ctx => ({
    isPF: ctx.values.tipo_pessoa === 'PF',
    isPJ: ctx.values.tipo_pessoa === 'PJ',
  }))

export type Base = typeof base
