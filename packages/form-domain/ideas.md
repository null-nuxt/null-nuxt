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

---

# Setup format: what was decided, and why

Kept as the record of a design that took several rounds. It is no longer a
proposal — the format shipped and the builder is gone — so what is useful here
is the reasoning, not the shape. The README describes the shape.

## What the builder could not fix

The chain existed for one reason: inside a single object literal TypeScript
infers every property at once, so `rules` could not see the inferred type of
`facts`. Everything around it — the `withX` chain, the `RulesOf`/`SchemaOf`
helpers a consuming project had to import, `ctx.shape()` — was a way around that
one sentence.

A setup has no literal. Each line is a declaration and inference runs top to
bottom, so the limitation is gone rather than worked around.

Three attempts that did NOT work, worth not repeating:

- **Identity helpers on the builder** (`base.defineRules`) removed the type
  imports but depended on the builder mutating a shared definition.
- **Three staged factories** made the dependency an argument, at the cost of
  turning the inline form into a nested call — and the inline form is half of
  why the local terminal exists.
- **Returning the layers from the setup** kept the key check working but moved
  the error onto the whole function instead of the offending key. Measured.

## Decisions that are load-bearing

- **`add*` takes its target explicitly.** No ambient "current form", so it is
  callable from any file and has none of the hazards of a registry keyed on call
  context. The rules stay a separable layer: grouping the calls elsewhere is
  still a rules file.
- **Rules attached, not chained onto the field.** `refField().canShow()` was
  rejected: it co-locates by entity and kills the separation by concern.
- **Keyed forms take a direct argument.** Measured: the same check from an
  arrow's return puts the error on the whole function.
- **`metadata` outside the setup.** Running a setup is instantiating, and a
  catalog has to read it without that.
- **`payload` outside the setup, one step.** Makes it a pure function of the
  exposed surface — testable without instantiating, unable to reach what the
  setup kept private, and it gives the return a job.
- **Facts and outcome are plain `computed`.** Nothing is classified: the engine
  only needs to know which returned values are the fields, and a reserved key
  answers that. Pinia inspects its return because it owes `$state` and devtools
  over arbitrary values; this owes neither.
- **Declaring `options` is what makes a field a choice.** A rule can be attached
  from anywhere at any time, so the declaration is the only fixed point from
  which the question is answerable.

## Naming, and the collision that decided it

Each prefix means what it means in Vue: `ref*` creates state, `to*` derives a
shape, `define*` declares, `use*` consumes. `add*` sits outside on purpose —
registration is neither, and borrowing a meaning it lacks is worse than none.

`useForm` and `useField` are vee-validate's, and most projects reaching for this
have vee-validate too. That ruled out `useFields` and forced `toForm`.
`createForm` was dropped because `create*` meant a builder here until recently.

## Still open

- **The return's shape.** `{ fields, price }` nested is correct and slightly
  awkward; flat is nicer and lets a field named `price` collide silently. Nested
  won. Worth revisiting after five domains are written.
- **The name `refFields`.** The object it returns is the form under
  construction, not a list of fields.
- **The migration step** from the component form to the domain form: if
  `defineFormDomain` accepted fields that already carry rules, migrating could be
  gradual — at the cost of a rule being able to live in two places.

Closed since: the SSR leak (a warning, on the condition that IS the bug), the
singular `refField` use case (a field reused across domains, which `refFields`
accepts alongside declarations), and the ordering hazard (a guard inside
`OnlyKnownKeys` rather than an API change).
