import type { PayloadContextOf } from '#forms'
import type { Base } from './domain'
import type { CertidaoOutcome } from './outcome'

/**
 * O que sai pro backend. Antes disto, mandar o texto da região exigia três
 * declarações em dois arquivos: um campo `regiao_descricao` que ninguém
 * preenche, um `storeLabelIn` espelhando o label nele, e uma regra
 * `canShow: () => false` só pra esconder o fantasma da tela.
 *
 * Aqui é uma linha, calculada na leitura — então uma lista de opções que muda
 * com o tipo de pessoa não deixa o texto velho pra trás.
 *
 * `ctx.visible` em vez de `ctx.values`: o documento do grupo oposto está
 * escondido e não tem por que viajar.
 */
export const payload = (ctx: PayloadContextOf<Base, CertidaoOutcome>) => ({
  ...ctx.visible,
  regiao_descricao: ctx.selected.regiao?.label ?? '',
  price: ctx.outcome.price,
  sku: ctx.outcome.sku,
})
