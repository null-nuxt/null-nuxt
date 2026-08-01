import type { RulesOf } from '#forms'
import type { Base } from './domain'
import { regioesDe } from './regioes'

/**
 * `RulesOf<Base>` traz o contexto tipado do builder parcial — é isto que faz a
 * separação em arquivos funcionar sem reconstruir os tipos à mão.
 *
 * Os três mecanismos aparecem aqui fazendo trabalhos diferentes:
 */
export const rules: RulesOf<Base> = {
  tipo_pessoa: {
    /**
     * `onChange` porque `regiao` NÃO some ao trocar de tipo — ela continua
     * visível, mas o conjunto de valores válidos mudou, e o que estava
     * escolhido deixou de valer. Visibilidade não pega esse caso.
     */
    onChange: (_value, ctx) => ctx.patch({ regiao: '' }),
  },

  /**
   * `clearWhenHidden` porque estes campos somem de fato: a condição já está no
   * `canShow` e repeti-la numa limpeza manual erraria o estado vazio.
   */
  cpf: { canShow: ctx => ctx.facts.isPF, clearWhenHidden: true },
  cnpj: { canShow: ctx => ctx.facts.isPJ, clearWhenHidden: true },

  regiao: {
    // sem tipo escolhido não há região que faça sentido
    canShow: ctx => ctx.facts.isPF || ctx.facts.isPJ,
    options: regioesDe,

    /**
     * O campo guarda `'primeira'`; o backend também precisa de `'1ª Região'`.
     * `data.regiao.label` não serve pra isso — ele é o rótulo do campo.
     */
    storeLabelIn: 'regiao_descricao',
  },

  // preenchido pelo engine a partir da escolha; não é digitado
  regiao_descricao: { canShow: () => false },
}
