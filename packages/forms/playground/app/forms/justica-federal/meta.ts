import type { MetaOf } from '#forms'
import type { Base } from './domain'

export interface CertidaoMeta {
  titulo: string
  sku: string
  /** Dado variável: muda com o formulário, não é constante do domínio. */
  price: number
  /** Linha pronta pro carrinho, com o texto que o usuário reconhece. */
  resumo: string
}

/**
 * Meta é função do contexto, então dado variável (preço por tipo de pessoa)
 * fica reativo — sem um lugar separado pra "meta dinâmica".
 *
 * `ctx.selected` resolve o texto amigável a partir do valor guardado: o campo
 * continua com `'primeira'`, e o carrinho mostra `'1ª Região'`.
 */
export const meta: MetaOf<Base, CertidaoMeta> = ctx => ({
  titulo: 'Certidão Negativa Criminal — Justiça Federal',
  sku: ctx.computed.isPF ? 'CNC-JF-PF' : 'CNC-JF-PJ',
  price: ctx.computed.isPF ? 59.9 : 89.9,
  resumo: ctx.selected.regiao
    ? `Região: ${ctx.selected.regiao.label}`
    : 'Região não selecionada',
})
