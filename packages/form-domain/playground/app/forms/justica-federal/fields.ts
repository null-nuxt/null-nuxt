import type { BuiltFields } from '#forms'

export type Pessoa = 'PF' | 'PJ' | ''

/**
 * A DECLARAÇÃO dos campos — dado puro, não estado.
 *
 * É por isso que ela pode viver no topo do módulo: `refFields()` aqui criaria
 * estado reativo compartilhado entre requests, e sob SSR a segunda request
 * dirigiria o que a primeira preencheu. Um objeto inerte não tem o que vazar,
 * então o modo de falha não existe em vez de ser avisado.
 *
 * A construção acontece dentro do setup, em `index.ts`. A garantia continua no
 * construtor: `refFields` recusa option cujo valor não bate com o do campo.
 */
export const declaracao = {
  tipoPessoa: { label: 'Tipo de Pessoa', value: '' as Pessoa },
  cpf: { label: 'CPF', value: '', mask: 'cpf' },
  cnpj: { label: 'CNPJ', value: '', mask: 'cnpj' },
  regiao: { label: 'Região', value: '' },
  observacao: { label: 'Observação', value: '' },
}

/** O tipo que as seções recebem, derivado da declaração. */
export type Campos = BuiltFields<typeof declaracao>
