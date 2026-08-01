import { computed } from 'vue'
import { defineFormDomain } from '#forms'
import { createFields } from './fields'
import { documento } from './secoes/documento'
import { regiao } from './secoes/regiao'

/**
 * Entrada de catálogo: nada aqui depende de alguém preencher o formulário, e é
 * por isso que fica FORA do setup — rodar o setup é instanciar, e a listagem
 * precisa disto sem instanciar nada.
 */
export const metadata = {
  title: 'Certidão Negativa Criminal — Justiça Federal',
  description: 'Certidão de distribuição criminal emitida pela Justiça Federal.',
  to: '/servicos/certidao/justica-federal',
  category: 'certidoes',
  order: 120,
}

/**
 * O índice do domínio: dá pra ler tudo em quinze linhas e saber onde está cada
 * coisa. As seções recebem os campos por argumento — a dependência é parâmetro,
 * não posição numa cadeia.
 */
export default defineFormDomain('justica-federal', metadata, () => {
  const campos = createFields()

  documento(campos)
  regiao(campos)

  const isPF = computed(() => campos.tipoPessoa.value === 'PF')

  return {
    fields: campos,
    isPF,
    sku: computed(() => isPF.value ? 'CNC-JF-PF' : 'CNC-JF-PJ'),
    price: computed(() => isPF.value ? 59.9 : 89.9),
    resumo: computed(() => campos.regiao.selected
      ? `Região: ${campos.regiao.selected.label}`
      : 'Região não selecionada'),
  }
})
  /**
   * A projeção pro backend. O texto da região entra aqui SEM campo fantasma —
   * era isso que custava três declarações em dois arquivos no formato anterior.
   *
   * `ctx.visible` em vez de `ctx.values`: o documento do grupo oposto está
   * escondido e não tem por que viajar.
   */
  .payload(ctx => ({
    ...ctx.visible,
    regiao_descricao: ctx.selected.regiao?.label ?? '',
    price: ctx.price.value,
    sku: ctx.sku.value,
    produto: metadata.category,
  }))
