eu tava pensando nesse formulario tmb ser poder ser usado de forma simples pra algo simples por exemplo:

```vue
<script setup lang="ts">
import { useCustomerStore } from '../../stores/customer'

const props = withDefaults(defineProps<{
  collectCustomerData?: boolean
  submit: () => Promise<void>
}>(), {
  collectCustomerData: true,
})

const { storeOrUpdateLead } = useCustomer()

const { data, onSubmit, schema, canShow } = createFormDomain('customer-data-form')
  .withFields({
    name: field({ label: 'Nome Completo*', value: '' }),
    email: field({ label: 'Email*', value: '' }),
    phone: field({ label: 'Telfone*', value: '' }),
    type: field({ label: 'Selecione seu perfil', value: '' }),
    cpf: field({ label: 'CPF*', value: '' }),
    cnpj: field({ label: 'CNPJ*', value: '' }),
  })
  .withComputed(ctx => ({
    isPF: ctx.values.tipo === 'PF',
  }))
  .withRules({
    cpf: { canShow: ctx => ctx.computed.isPF, clearWhenHidden: true },
    cnpj: { canShow: ctx => !ctx.computed.isPF, clearWhenHidden: true },
  })
  .withSchema(ctx => object({
    name: string()
      .required('O nome é obrigatório')
      .min(3, 'Nome deve ter pelo menos 3 caracteres')
      .max(100, 'Nome deve ter no máximo 100 caracteres'),
    email: string()
      .required('O e-mail é obrigatório')
      .email('Digite um e-mail válido'),
    phone: string()
      .required('O telefone é obrigatório'),
    type: string().required('O campo perfil é obrigatório').typeError('O campo perfil é obrigatório'),
    cpf: string().cpf().required(),
    cnpj: string().cnpj().required()
  }))
  .withEvents({
    onSubmit(values) {
      await storeOrUpdateLead(value)
      return await props.submit()
    },
    onSchemaError(err) {
      console.log(err)
    }
  })
  .build()
</script>

<template>
  <div class="bg-white rounded-lg border border-line shadow-[0_1px_3px_rgba(11,37,69,0.04),0_4px_16px_rgba(11,37,69,0.03)] p-8 md:px-12 md:py-10">
    <!-- Header -->
    <div class="flex items-center gap-4 pb-6 mb-8 border-b border-line">
      <div class="w-11 h-11 rounded-full bg-navy-900 grid place-items-center text-gold text-lg shrink-0">
        ✉
      </div>
      <div>
        <h2 class="font-serif font-bold text-[1.375rem] text-navy-900 leading-tight">
          Dados do Solicitante
        </h2>
        <p class="text-sm text-navy-600 mt-1">
          {{ collectCustomerData ? 'Informe seus dados para receber a certidão' : 'Os dados da sua conta serão usados nesta solicitação' }}
        </p>
      </div>
    </div>

    <FormDefault
      :submit="onSubmit"
      :schema="schema"
      :scroll-to-error="true"
    >
      <div class="flex flex-col gap-10">
        <div
          v-if="!collectCustomerData"
          class="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
        >
          <span
            class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white"
            aria-hidden="true"
          >✓</span>
          <p>
            Você está logado. Não é necessário informar novamente seus dados pessoais e de contato.
          </p>
        </div>

        <!-- IDENTIFICAÇÃO -->

        <section>
          <h3 class="font-serif font-bold text-[1.0625rem] text-navy-900 flex items-center gap-2 mb-5 pb-2 border-b-2 border-gold">
            <span class="text-gold text-lg leading-none">▸</span>
            Identificação
          </h3>
          <div class="flex flex-col gap-5">
            <FederalFormInput
              v-if="canShow('name')"
              v-model="data.name.value"
              :name="data.name.key"
              :label="data.name.label"
              placeholder="Digite seu nome completo"
            />

            ou usar algo como:
            <FederalFormInput
              v-bind="data.name.registerFormField()"
              placeholder="Digite seu nome completo"
            />

            <FederalFormSelect
              v-model="customer.type"
              name="type"
              label="Perfil*"
              placeholder="Selecione seu perfil"
              :options="profileOptions"
            />

            ....demais campos
          </div>
        </section>
      </div>

      <!-- Botões de Ação -->
      <template #button="{ isLoading }">
        <div class="pt-6 border-t border-line mt-10 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            class="sm:w-auto w-full text-center border border-line text-navy-700 hover:bg-surface font-semibold py-3.5 px-6 text-sm rounded-lg transition-all duration-200"
            @click="emit('prev')"
          >
            ← Voltar
          </button>
          <button
            type="submit"
            :disabled="isLoading"
            class="flex-1 text-center bg-navy-900 hover:bg-navy-950 text-gold font-bold py-4 px-8 uppercase tracking-[0.06em] text-sm rounded-lg transition-all duration-250 shadow-[0_2px_8px_rgba(11,37,69,0.2)] hover:shadow-[0_4px_16px_rgba(11,37,69,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isLoading ? 'PROCESSANDO...' : 'CONTINUAR' }}
          </button>
        </div>
      </template>
    </FormDefault>
  </div>
</template>
```

eu queria tmb puder usar pra algo simples mas acho melhor a parte de submit ou onSchemaError pra lib que o cara ta usando que pode ser o vee-validate ou nuxtformkit e etc.
mas as outras ideias acho que pode ser boa
