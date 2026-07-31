import { string } from 'yup'
import type { SchemaOf } from '#forms'
import type { Base } from './domain'
import { valoresDeRegiao } from './regioes'

/**
 * Um validador por campo — sem `object()` em volta. Isso dá três coisas:
 * chave fora de `fields` não compila, campo escondido é pulado sem `.omit()`,
 * e qualquer lib com Standard Schema serve (aqui é yup; podia ser Zod).
 *
 * Repare no que NÃO está aqui: nenhum `.when()`. Quando o tipo não bate, o
 * `canShow` esconde e o campo sai da validação — a condição foi dita uma vez.
 *
 * `regiao` é o caso que a visibilidade não cobre: o campo continua visível, mas
 * o conjunto de valores aceitos muda com o contexto.
 */
export const schema: SchemaOf<Base> = ctx => ctx.shape({
  tipo_pessoa: string().required('Selecione o tipo de pessoa'),

  cpf: string().required('Informe o CPF').length(11, 'CPF tem 11 dígitos'),
  cnpj: string().required('Informe o CNPJ').length(14, 'CNPJ tem 14 dígitos'),

  regiao: string()
    .required('Selecione a região')
    .oneOf(valoresDeRegiao(ctx), 'Região inválida para este tipo de pessoa'),
})
