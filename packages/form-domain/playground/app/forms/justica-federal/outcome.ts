import type { OutcomeOf } from '#forms'
import type { Base } from './domain'

export interface CertidaoOutcome {
  titulo: string
  sku: string
  /** Dado variável: muda com o formulário, não é constante do domínio. */
  price: number
  /** Linha pronta pro carrinho, com o texto que o usuário reconhece. */
  resumo: string
}

/**
 * Outcome é função do contexto, então dado variável (preço por tipo de pessoa)
 * fica reativo — sem um lugar separado pra "outcome dinâmico".
 *
 * `ctx.selected` resolve o texto amigável a partir do valor guardado: o campo
 * continua com `'primeira'`, e o carrinho mostra `'1ª Região'`.
 */
export const outcome: OutcomeOf<Base, CertidaoOutcome> = ctx => ({
  titulo: 'Certidão Negativa Criminal — Justiça Federal',
  sku: ctx.facts.isPF ? 'CNC-JF-PF' : 'CNC-JF-PJ',
  price: ctx.facts.isPF ? 59.9 : 89.9,
  resumo: ctx.selected.regiao
    ? `Região: ${ctx.selected.regiao.label}`
    : 'Região não selecionada',
})
