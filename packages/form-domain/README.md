# @null-nuxt/form-domain

A form declared as a **setup function** — fields, rules, validation and the
payload — consumed through composables, in the style of `defineStore`.

Schema-library agnostic: anything implementing
[Standard Schema](https://standardschema.dev) works — Zod, Valibot, ArkType,
yup 1.7+.

## Installation

```bash
pnpm add "github:null-nuxt/null-nuxt#form-domain@0.4.0&path:/packages/form-domain"
```

Each package is tagged on its own, since they are versioned and pinned
separately. Dropping the tag resolves to whatever `main` points at.

Not published to npm — installed straight from the repository. The consuming
project must allow the package to build on install:

```yaml
# pnpm-workspace.yaml
allowBuilds:
  "@null-nuxt/form-domain": true
```

Approving a git package **by name** only works on pnpm 11.15 and up; before
that the key had to carry the resolved commit hash, which changes on every
update.

```ts
export default defineNuxtConfig({
  modules: ['@null-nuxt/form-domain'],
})
```

## A form inside a component

There is no wrapper to write. `<script setup>` is already the scope, so the
fields are consts, anything derived is a `computed`, and the form is assembled
at the end:

```vue
<script setup lang="ts">
import { object, string } from 'yup'

const campos = refFields({
  name: { label: 'Full name', value: '' },
  personType: {
    label: 'Type',
    value: '' as 'individual' | 'company' | '',
    options: [
      { label: 'Individual', value: 'individual' },
      { label: 'Company', value: 'company' },
    ],
  },
  ein: { label: 'Company number', value: '' },
})

const isCompany = computed(() => campos.personType.value === 'company')

addRule(campos.ein, { canShow: () => isCompany.value, clearWhenHidden: true })

addSchemas(campos, {
  name: string().required(),
  personType: string().required(),
  ein: string().required(),
})

const { register, canShow, values, composeSchema } = toForm(campos)
const schema = composeSchema(object)
</script>

<template>
  <MyInput v-bind="register('name')" />
  <MySelect v-bind="register('personType')" />
  <MyInput v-if="canShow.ein" v-bind="register('ein')" />
</template>
```

## A shared domain

A domain has no component to live in, so it gets a setup of its own. Put it
under `<srcDir>/forms` and it is discovered automatically:

```ts
// forms/federal-court/index.ts
export const metadata = {
  title: 'Criminal Record Certificate',
  to: '/services/certificates/federal-court',
  category: 'certificates',
  order: 120,
}

export default defineFormDomain('federal-court', metadata, () => {
  const campos = createFields()

  documento(campos)   // one file per block
  regiao(campos)

  const isPF = computed(() => campos.tipoPessoa.value === 'PF')

  return {
    fields: campos,
    isPF,
    price: computed(() => isPF.value ? 59.9 : 89.9),
  }
})
  .payload(ctx => ({
    ...ctx.visible,
    region_label: ctx.fields.regiao.selected?.label ?? '',
    price: ctx.price.value,
  }))
```

`metadata` is optional: `defineFormDomain(id, setup)` works too.

The setup returns its fields under the reserved `fields` key. **Everything else
it returns is exposed untouched** — nothing is classified, because the engine
only needs to know which of them are the fields.

## Why a setup and not a builder

This package used to be a `withFields().withFacts().withRules()` chain, and the
chain existed for one reason: inside a single object literal TypeScript infers
every property at once, so `rules` could not see the inferred type of `facts`.

A setup has no literal. Each line is a declaration and inference runs top to
bottom, so the limitation is gone rather than worked around — and with it the
eight type parameters, the `RulesOf`/`SchemaOf`/`OutcomeOf` helpers a consuming
project had to import, and a whole class of ordering mistakes.

## The names, and what each prefix promises

Every prefix already means something in Vue, so the name teaches rather than
labels:

| prefix | in Vue | here |
|---|---|---|
| `ref*` | creates reactive state | `refField`, `refFields` |
| `to*` | derives one shape from another | `toForm` |
| `define*` | declares a thing to use later | `defineFormDomain` |
| `use*` | consumes a declared thing, in a component | `useFormDomain`, `useFormDomains` |

`refFields` rather than `useFields` for two reasons. It creates reactive state
the way `ref()` does — which is exactly why calling it at module scope is
suspect — whereas `use` would claim it's a composable, which it isn't. And
`useField` is already vee-validate's, an import most projects using this will
also have.

`toForm` rather than `createForm` because `create*` in this package used to mean
a builder you had to terminate, and because `useForm` is vee-validate's too.

`add*` sits outside the table on purpose: registration is neither creation nor
derivation, and `add` says so without borrowing anyone's meaning.

## Registration takes its target

```ts
addRule(campos.ein, { canShow: () => isCompany.value })
addRules(campos, { ein: { canShow: () => isCompany.value } })
```

The field is the argument, so nothing needs to know which form is "current".
That is what keeps this callable from anywhere — including another file —
without the hazards an ambient registry brings, and it is why the rules stay a
separable layer: grouping the calls elsewhere is still a rules file.

The keyed form takes a **direct argument** rather than something returned. Both
reject a field that doesn't exist, but from an arrow's return the error lands on
the whole function instead of the offending key.

## Rules

| | what it does |
|---|---|
| `canShow` | hides the field, and drops it from validation |
| `clearWhenHidden` | resets it to its initial value once hidden |
| `options` | a derived list; wins over the one declared on the field |
| `onChange` | a side effect, writing through `ctx.patch()` |

`canShow` returning false removes the field from validation. That's what erases
most `.when()` calls: the condition was stated once.

`clearWhenHidden` is opt-in because it erases data — in a multi-step form a
hidden field usually needs to keep what the user typed.

`onChange` writes through `ctx.patch()`, which is a **request**: the engine only
applies it if that invocation is still the most recent one, so a slow lookup
can't overwrite newer input.

## Validation

One validator per field, not a composed schema:

```ts
addSchemas(campos, {
  name: string().required('Name is required'),
  // a getter when it depends on the form's state
  regiao: () => string().oneOf(valoresValidos(campos)).required(),
})
```

A plain validator is read once, which is right when it never changes and wrong
when it does — hence the getter form.

```ts
const { valid, errors, firstErrors } = await form.validate()
```

If your form library wants a composed schema, hand it your combinator:

```ts
const schema = form.composeSchema(object)    // yup
const schema = form.composeSchema(z.object)  // zod
```

Which library composes is your call. The **reactivity** isn't, and that's why
this is a method: composing outside a `computed` freezes the schema at its first
value, so a field a rule hides later stays required — a bug that only shows up
on the branch that hides something.

### Submitting is not this module's job

There is deliberately no `onSubmit` or `onSchemaError`. The module provides
schema and state; running validation and submission belongs to your form
library — vee-validate, FormKit, or your own wrapper.

## `register()` builds the input props

```vue
<MyInput v-bind="form.register('name')" />
```

It provides `name`, `label`, `modelValue` and the `update:modelValue` handler,
plus `options`, `placeholder` and `mask` **only when the field declares them** —
and that is a statement about the type, not just the runtime object:

```ts
form.register('perfil').options   // ok, this field declares a list
form.register('name').options     // ✗ this field declares none
```

The handler accepts `TValue | undefined`. A component written the ordinary way
emits the wider type:

```ts
const model = defineModel<string>()  // emits string | undefined
```

Under `strictFunctionTypes` a handler taking only `string` is **not** assignable
to that, and `v-bind` would fail to compile on the most common way to write an
input.

## The option's label

The field stores **only the value**. For the human-readable text, read it off
the field:

```ts
form.values.value.regiao        // 'first'
form.selected.value.regiao?.label // 'First Region'
```

Inside a setup you can read it off the field you declared —
`campos.regiao.selected` — since that's your own variable. From outside, go
through `selected`: reaching it was the only reason a consumer needed the raw
fields, and two ways to the same value is one too many.

Derived, never stored: change the list and the text follows instead of going
stale. Storing the `{ label, value }` object instead would break `v-model` by
identity, break `oneOf`, and send an object where the API expects a scalar.

## `payload`: what leaves for the backend

```ts
.payload(ctx => ({
  ...ctx.visible,
  region_label: ctx.fields.regiao.selected?.label ?? '',
  price: ctx.price.value,
}))
```

The payload is a **projection** of the form, not a set of fields. Without one it
is simply `values`.

It sits outside the setup on purpose: it becomes a pure function of what the
setup exposed, so it is testable without instantiating and cannot reach anything
the setup kept private. That also gives the setup's return a job — it is the
public surface.

**`values` or `visible`, your call.** `values` is every field; `visible` is only
what a rule is currently letting through. A backend that wants the key always
present spreads the first; one that must not receive the opposite group's
document spreads the second. Both reach the context because neither answer is
right for everyone.

## Catalog

```ts
const domain = useFormDomain('federal-court')  // typed to THAT domain
const catalog = useFormDomainsMetadata()       // no setup runs
const all = useFormDomains()                   // runs every setup
```

`useFormDomainsMetadata` instantiates **nothing** — `metadata` is static, so it
is read straight off the factory. That's the one for a listing: 300 certificates
cost 300 property reads, not 300 setups.

`x.ts` and `x/index.ts` are the same domain; if both exist, the directory wins.

## Scaling up

Up to around eight fields, one file. Above that, split by **section** rather
than by layer — the unit you navigate is "the address block", not "all the
rules". `addRules` and `addSchemas` are callable as many times as you like, so
one file owns its block's rule *and* its validation:

```ts
// sections/documento.ts
export function documento(campos: Campos) {
  addRules(campos, { cpf: { canShow: () => isPF(campos), clearWhenHidden: true } })
  addSchemas(campos, { cpf: string().required() })
}
```

`fields` and anything derived stay central, because they are what the sections
share. What crosses a file boundary is `Campos = ReturnType<typeof createFields>`
— a type from your own factory, not from this package.

## Fields at module scope leak under SSR

Fields are reactive state, and declared at module scope they are built once per
process — so the second request drives the objects the first one filled in.

Wrap them in a factory:

```ts
export const createFields = () => refFields({ /* ... */ })
export type Campos = ReturnType<typeof createFields>
```

The types can't see this, so it is caught at runtime: one fields object driving
two forms logs a warning naming the cause. It is a warning and not a throw
because by then the app is serving, and turning a data leak into a blank page
helps nobody.

## What the compiler guarantees

| Error | When it surfaces |
|---|---|
| `addRules`/`addSchemas` naming a field that doesn't exist | **compile time** |
| `register()` on a field that doesn't exist | **compile time** |
| `register()` reading an extra the field never declared | **compile time** |
| an option whose value doesn't match the field's | **compile time** |
| `useFormDomain('unknown-slug')` | **compile time** |
| the payload reading a key it doesn't project | **compile time** |
| `ctx.patch()` with a field that doesn't exist | ignored at runtime |
| fields shared across requests | runtime warning |

## API

```ts
refField({ label, value })        // one field, reusable across domains
refFields({ name: { ... } })      // the form's fields, named

addRule(field, rule)           // behaviour for one field
addRules(fields, { ... })      // for several, keyed
addSchema(field, validator)    // validation for one
addSchemas(fields, { ... })    // for several

toForm(fields)                       // assemble inside a component
defineFormDomain(id, meta?, setup)   // a shared domain
  .payload(ctx => ({ ... }))         // optional projection
```

```ts
const form = useFormDomain('federal-court')

form.id           // slug, as a literal type
form.fields       // the field objects: { label, value, key, selected }
form.values       // every value
form.visible      // only what a rule allows through
form.canShow      // { field: boolean }
form.selected     // the chosen option per field
form.options      // effective options per field
form.shape        // visible validators, with the types you declared
form.composeSchema(object)  // the same, composed by your library, reactive
form.validate()   // validates visible fields only
form.payload      // the projection, or `values` if none declared
form.register(k)  // ready-made input props
form.set(patch)   // partial, typed patch
form.reset()      // back to initial values
form.dispose()    // stops the effects
```

## Development

```bash
pnpm install
pnpm bootstrap   # generates the playground's .nuxt
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The playground has `domain-guard` and `catalog-guard` pages whose type errors
are **expected**, asserted with `@ts-expect-error`. If a guarantee regresses the
directive goes unused and typecheck fails, instead of the breakage reaching a
project.

## License

MIT
