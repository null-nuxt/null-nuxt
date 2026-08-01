import type { Campos } from './fields'

const REGIOES_PF = [
  { label: '1ª Região', value: 'primeira' },
  { label: '2ª Região', value: 'segunda' },
]

const REGIOES_PJ = [{ label: 'Nacional', value: 'nacional' }]

/**
 * Fonte única das regiões válidas. As rules usam pra montar o select e o schema
 * usa pra validar — sem isso, a lista da UI e a do backend divergem em silêncio.
 *
 * Sem tipo escolhido a lista é VAZIA, e não a de PJ: tratar "não é PF" como
 * "é PJ" é o mesmo erro do `else` que a limpeza manual cometia.
 *
 * Recebe os campos direto, sem `ContextOf<Base>`: o que atravessa a fronteira é
 * um tipo derivado da fábrica do próprio domínio.
 */
export const regioesDe = (campos: Campos) => {
  if (campos.tipoPessoa.value === 'PF') return REGIOES_PF
  if (campos.tipoPessoa.value === 'PJ') return REGIOES_PJ
  return []
}

export const valoresDeRegiao = (campos: Campos) => regioesDe(campos).map(opcao => opcao.value)
