import { string } from 'yup'
import { addRules, addSchemas } from '#forms'
import type { Campos } from '../fields'
import { regioesDe, valoresDeRegiao } from '../regioes'

export function regiao(campos: Campos) {
  addRules(campos, {
    /**
     * `onChange` porque `regiao` NÃO some ao trocar de tipo — ela continua
     * visível, mas o conjunto de valores válidos mudou e o que estava escolhido
     * deixou de valer. Visibilidade não pega esse caso.
     */
    tipoPessoa: { onChange: (_valor, ctx) => ctx.patch({ regiao: '' }) },

    regiao: {
      // sem tipo escolhido não há região que faça sentido
      canShow: () => campos.tipoPessoa.value !== '',
      options: () => regioesDe(campos),
    },
  })

  addSchemas(campos, {
    tipoPessoa: string().required('Selecione o tipo de pessoa'),

    /**
     * Getter, não valor: a lista aceita muda com o tipo de pessoa. Validador
     * puro é lido uma vez, o que é certo pro que não muda e errado pro que muda.
     */
    regiao: () => string()
      .required('Selecione a região')
      .oneOf(valoresDeRegiao(campos), 'Região inválida para este tipo de pessoa'),
  })
}
