import type { ContextOf } from '#forms'
import type { Base } from './domain'

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
 */
export const regioesDe = (ctx: ContextOf<Base>) => {
  if (ctx.computed.isPF) return REGIOES_PF
  if (ctx.computed.isPJ) return REGIOES_PJ
  return []
}

export const valoresDeRegiao = (ctx: ContextOf<Base>) => regioesDe(ctx).map(opcao => opcao.value)
