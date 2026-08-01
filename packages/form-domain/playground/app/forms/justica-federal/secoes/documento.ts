import { string } from 'yup'
import { addRules, addSchemas } from '#forms'
import type { Campos } from '../fields'

/**
 * O bloco do documento inteiro num arquivo: regra E validação de CPF/CNPJ.
 *
 * Isso é o que o formato novo permite e o builder não permitia — `withRules`
 * só podia ser chamado uma vez, com tudo dentro, então dividir só dava por
 * camada. Aqui a unidade é o bloco, que é o que se navega de verdade.
 */
export function documento(campos: Campos) {
  const isPF = () => campos.tipoPessoa.value === 'PF'
  const isPJ = () => campos.tipoPessoa.value === 'PJ'

  addRules(campos, {
    /**
     * `clearWhenHidden` porque estes somem de fato: a condição já está no
     * `canShow`, e repeti-la numa limpeza manual erraria o estado vazio.
     */
    cpf: { canShow: isPF, clearWhenHidden: true },
    cnpj: { canShow: isPJ, clearWhenHidden: true },
  })

  /** Nenhum `.when()`: escondido sai da validação, e a condição foi dita uma vez. */
  addSchemas(campos, {
    cpf: string().required('Informe o CPF').length(11, 'CPF tem 11 dígitos'),
    cnpj: string().required('Informe o CNPJ').length(14, 'CNPJ tem 14 dígitos'),
  })
}
