<script setup lang="ts">
import { string } from 'yup'

/**
 * Formulário simples, declarado no próprio componente. `use()` em vez de
 * `build()`: instância local, não entra no catálogo, e o estado não é
 * compartilhado com outra montagem do mesmo componente.
 */
/**
 * Desestruturar é o uso recomendado: `canShow` e `values` chegam como refs e o
 * template desembrulha sozinho. Guardar o objeto inteiro obrigaria a escrever
 * `form.canShow.value.cpf` até no `v-if`.
 */
const { register, canShow, values, validate } = createFormDomain('dados-do-solicitante')
  .withFields({
    name: field({ label: 'Nome Completo*', value: '', placeholder: 'Digite seu nome completo' }),
    email: field({ label: 'E-mail*', value: '', placeholder: 'voce@exemplo.com.br' }),
    type: field({
      label: 'Perfil*',
      value: '',
      options: [
        { label: 'Pessoa Física', value: 'PF' },
        { label: 'Pessoa Jurídica', value: 'PJ' },
      ],
    }),
    cpf: field({ label: 'CPF*', value: '', mask: 'cpf' }),
    cnpj: field({ label: 'CNPJ*', value: '', mask: 'cnpj' }),
  })
  .withComputed(ctx => ({ isPF: ctx.values.type === 'PF' }))
  .withRules({
    cpf: { canShow: ctx => ctx.computed.isPF, clearWhenHidden: true },
    cnpj: { canShow: ctx => ctx.values.type === 'PJ', clearWhenHidden: true },
  })
  .withSchema({
    name: string().required('O nome é obrigatório').min(3, 'Nome muito curto'),
    email: string().required('O e-mail é obrigatório').email('E-mail inválido'),
    type: string().required('O perfil é obrigatório'),
    cpf: string().required('Informe o CPF'),
    cnpj: string().required('Informe o CNPJ'),
  })
  .use()

/**
 * O submit é da lib de formulário do projeto (vee-validate, FormKit...), não
 * deste módulo: ele entrega `schema` e estado, quem roda a validação é você.
 */
const erros = ref<string[]>([])
const enviar = async () => {
  const resultado = await validate()
  erros.value = Object.values(resultado.errors).flat()
}
</script>

<template>
  <main style="font-family: system-ui; padding: 2rem; display: grid; gap: 1rem; max-width: 40rem">
    <h1>Formulário simples</h1>
    <p style="color:#52525b; font-size:.9rem">
      Declarado inline no componente, sem arquivo em <code>forms/</code>.
    </p>

    <form
      style="display:grid; gap:.8rem"
      @submit.prevent="enviar"
    >
      <!-- register() entrega name, label, placeholder e o vínculo de v-model -->
      <SimpleInput v-bind="register('name')" />
      <SimpleInput v-bind="register('email')" />
      <SimpleSelect v-bind="register('type')" />

      <SimpleInput
        v-if="canShow.cpf"
        v-bind="register('cpf')"
      />
      <SimpleInput
        v-if="canShow.cnpj"
        v-bind="register('cnpj')"
      />

      <button
        type="submit"
        style="justify-self:start; padding:.5rem 1rem"
      >
        validar
      </button>
    </form>

    <ul
      v-if="erros.length"
      style="color:#b91c1c; font-size:.85rem"
    >
      <li
        v-for="erro in erros"
        :key="erro"
      >
        {{ erro }}
      </li>
    </ul>

    <pre style="background:#f4f4f5; padding:1rem; font-size:.75rem; overflow:auto">{{ values }}</pre>
  </main>
</template>
