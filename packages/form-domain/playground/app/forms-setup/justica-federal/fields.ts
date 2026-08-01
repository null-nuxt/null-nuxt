import { fields } from '#forms'

export type Pessoa = 'PF' | 'PJ' | ''

/**
 * Os campos, num lugar só: é deles que sai o tipo que as seções importam.
 *
 * Uma fábrica, não um valor de módulo — chamar `fields()` no topo do módulo
 * criaria estado compartilhado entre requests, que é o mesmo furo de um `ref()`
 * solto no topo de um arquivo.
 */
export const createFields = () => fields({
  tipoPessoa: { label: 'Tipo de Pessoa', value: '' as Pessoa },
  cpf: { label: 'CPF', value: '', mask: 'cpf' },
  cnpj: { label: 'CNPJ', value: '', mask: 'cnpj' },
  regiao: { label: 'Região', value: '' },
  observacao: { label: 'Observação', value: '' },
})

export type Campos = ReturnType<typeof createFields>
