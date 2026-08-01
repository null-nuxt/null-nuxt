# @null-nuxt/form-domain

A form declared in **separate layers** — fields, business rules, schema and
metadata — consumed through composables, in the style of `defineStore`.

Schema-library agnostic: anything implementing
[Standard Schema](https://standardschema.dev) works — Zod, Valibot, ArkType,
yup 1.7+.

## Installation

```bash
pnpm add "github:null-nuxt/null-nuxt#path:/packages/form-domain"
```

Not published to npm — installed straight from the repository. The consuming
project must allow the package to build on install:

```yaml
# pnpm-workspace.yaml
allowBuilds:
  "@null-nuxt/form-domain": true
```

```ts
export default defineNuxtConfig({
  modules: ['@null-nuxt/form-domain'],
})
```

Bring your own schema library — anything implementing Standard Schema.

## Two terminals: `use()` and `build()`

A simple form, declared inside the component itself:

```ts
const form = createFormDomain('applicant-details')
  .withFields({ name: field({ label: 'Full name', value: '' }) })
  .use()          // local instance, right here
```

A shared domain, in a file under `<srcDir>/forms`:

```ts
export default createFormDomain('federal-court')
  .withFields({ /* ... */ })
  .build()        // composable; every caller gets the SAME instance
```

| | `use()` | `build()` |
|---|---|---|
| returns | the instance | the composable |
| state | local, one per call | shared by slug |
| catalog | not registered | registered |
| watchers | die with the component | live with the domain |

The split exists for a practical reason: an inline definition usually closes
over `props`. If the instance were shared by id, a second component would
silently inherit the first one's props.

### `register()` builds the input props

```vue
<MyInput v-bind="form.register('name')" />
```

It provides `name`, `label`, `modelValue` and the `update:modelValue` handler,
plus `options`, `placeholder` and `mask` **only when the field has them** — a
key the component doesn't declare would end up as a stray DOM attribute.

"Only when the field has them" is a statement about the **type**, not just the
runtime object. A field declared without options has no `options` key at all in
its bindings, so reading it is a compile error rather than `undefined`:

```ts
.withFields({
  username: field({ label: 'Username', value: '' }),
  profile: field({ label: 'Profile', value: '', options: [/* ... */] }),
})

form.register('profile').options   // ok
form.register('username').options  // ✗ this field declares no options
```

Derived options count as declaring them: a field whose `options` come from
`rules` gets the key too.

The handler accepts `TValue | undefined`, not just `TValue`. That's not
sloppiness — a component written the ordinary way emits the wider type:

```ts
const model = defineModel<string>()  // emits string | undefined
```

Under `strictFunctionTypes` a handler taking only `string` is **not** assignable
to that, and `v-bind="form.register('name')"` would fail to compile on the most
common way to write an input. Whatever the component emits is what the field
stores, `undefined` included — declare `field({ value: '' as string | undefined })`
if your component really clears the model that way.

Each field also knows its own key (`form.data.email.key === 'email'`), so the
template doesn't repeat the field name next to the field itself.

### Submitting is not this module's job

There is deliberately no `onSubmit` or `onSchemaError` here. The module
provides **schema and state**; running validation and submission belongs to
your form library — vee-validate, FormKit, or your own wrapper. Owning the
submit lifecycle would duplicate what those libraries already do and tie the
module to one of them.

## Form domain

When the form **is** a domain object (a certificate, an order) and carries more
than fields — business rules, price, sku — use `createFormDomain`:

```ts
createFormDomain('federal-court')
  .withFields({ person_type: field<PersonType>({ label: 'Type', value: '' }), ssn: ... })
  .withFacts(ctx => ({ isIndividual: ctx.values.person_type === 'individual' }))
  .withRules({
    ssn: { canShow: ctx => ctx.facts.isIndividual },
    region: { options: ctx => ctx.facts.isIndividual ? REGIONS_A : REGIONS_B },
    person_type: { onChange: (_value, ctx) => ctx.patch({ region: '' }) },
  })
  .withSchema(ctx => ctx.shape({ /* ... */ }))
  .withMeta(ctx => ({ sku: ctx.facts.isIndividual ? 'A' : 'B' }))
  .build()
```

### Why a builder and not a plain object

Not aesthetics. In a single object literal TypeScript infers every property at
once, and `rules` **could not see** the inferred type of `facts`. Each
`.withX()` returns a new type carrying what has accumulated so far — the same
reason tRPC, Zod and Kysely use builders.

### `facts` is the center

The business rule exists once and is consumed by rules, schema and meta.
Without it, the same condition ends up written twice — once in the field's
visibility, once in a `.when()` in the schema — and changing one without the
other produces no error at all.

### Schema: one validator per field

You don't declare a composed schema; you declare **one validator per field**:

```ts
.withSchema({
  name: string().required('Name is required'),
  email: string().email('Invalid email'),
})
```

Three things fall out of that:

1. **A field that doesn't exist won't compile** — declaring `surname: string()`
   on a form without a `surname` field is a build error. Validating a field
   that doesn't exist makes no sense.
2. **Hidden fields are skipped**, with no need for `.omit()` — which was the
   only part tied to a specific library.
3. **Any library works**: the engine only touches `~standard.validate`. Zod,
   Valibot, ArkType and yup 1.7+ all work with no adapter, and none of them is
   a dependency of this package.

When you need the context, use `ctx.shape()`:

```ts
.withSchema(ctx => ctx.shape({
  region: ctx.facts.isBusiness ? string().required() : string().nullable(),
}))
```

`shape` is not decoration: when the object comes from the **return of an arrow
function**, TypeScript cannot check the keys (inference becomes circular).
Passed as a direct argument, the check works again.

### Validating

```ts
const { valid, errors, firstErrors } = await form.validate()
```

Validates **only the visible fields**. If your form library wants a composed
schema instead, hand it your library's combinator:

```ts
const schema = form.composeSchema(object)    // yup
const schema = form.composeSchema(z.object)  // zod
```

You get a `ComputedRef` of whatever the combinator returns — yup's own
`ObjectSchema`, zod's own `ZodObject` — ready for `useForm({ validationSchema: schema })`.

Which library composes stays your call; the module has no idea which one is
right. What isn't your call is the **reactivity**, and that's why this is a
method instead of a line in your component:

```ts
// ✗ frozen at the first value: a field canShow hides later stays required
const schema = object(form.shape.value)
```

That bug only shows up on the branch of the form that hides something — the
branch nobody tests first.

`form.shape` is still there when you want the parts. It hands back the
validator types **you declared**, not an erased `StandardSchemaV1` — that's what
makes `object()` and `z.object()` accept it, since both demand their own
library's schema type.

A key is optional in `shape` only when a `canShow` rule can hide it, which is
exactly when the runtime may drop it. Marking every key optional would be the
easy way out and would break the composition above: yup and zod both reject a
`Schema | undefined` value.

Splitting the schema into its own file through `SchemaOf` is the one case that
still erases the types — the annotation is what the compiler sees, so it can't
recover more than `SchemaOf` promises. Compose from `validate()` there, or
declare the schema inline.

### Hidden fields are not validated

`canShow` returning false removes the field from validation. That's what
erases most `.when()` calls: the condition was already stated once.

That covers "the field **doesn't exist** right now". What it does not cover is
"the field exists, but the **rule changes**" — and that's where `ctx` in the
schema earns its place:

```ts
.withSchema(ctx => ctx.shape({
  // no .when(): when the type doesn't match, canShow hides it and the engine drops it
  ssn: string().required().length(11),

  // always visible, required only for businesses — visibility can't express this
  region: ctx.facts.isBusiness ? string().required() : string().nullable(),
}))
```

If the schema does **not** depend on the context, pass the object directly
instead of a function — the function form is rebuilt on every form change:

```ts
.withSchema({ name: string().required() })
```

### Where each thing lives

The split isn't "UI vs business", it's **static vs derived**:

| | where | example |
|---|---|---|
| doesn't depend on state | `fields` | `label`, initial value, `mask`, a fixed list of states |
| depends on state | `rules` | `canShow`, options that change with another field, `onChange` |

That's why `options` can appear in both: a fixed list is structure, a list that
changes is a rule. When both exist, **the rule wins**.

This doesn't leak into consumption — `form.options.field` resolves both
origins, so the template never needs to know which layer declared it:

```vue
<option v-for="o in form.options.region" :key="o.value">{{ o.label }}</option>
```

Derived options are a function of the context, which is why they **don't need
the reset branch** the imperative version would require.

### The selected option's label

The field stores **only the `value`**. To show the human-readable text (in a
cart, in a summary), use `selected`:

```ts
form.values.region          // 'first'
form.selected.region?.label // 'First Region'
```

Storing the `{ label, value }` object in the field looks convenient and costs a
lot: `v-model` on a select starts comparing by identity (breaking when state is
restored), `oneOf` compares references, the payload carries an object where the
API expects a scalar, and the stored label **freezes** — change the list and
the text stays stale.

Derived, the text follows along on its own. `meta` also receives
`ctx.selected`, so the cart line can come straight from the domain:

```ts
.withMeta(ctx => ({ summary: `Region: ${ctx.selected.region?.label ?? '—'}` }))
```

`options` deliberately does **not** receive `selected`: an options rule that
depended on the selected option would recurse. Separate contexts make that
impossible by construction.

### Storing the label for the payload

`selected` solves the live read, but doesn't put anything in what gets sent. If
your backend needs the text — a persisted cart, an invoice, history — point at
a destination field:

```ts
fields: {
  region: field({ label: 'Region', value: '' }),
  region_description: field({ label: 'Region (description)', value: '' }),
},
rules: {
  region: { options: regionsFor, storeLabelIn: 'region_description' },
},
```

`data.region.label` is **not** for this: it's the field's label ("Region"), not
the choice's text ("First Region") — two meanings sharing a name.

The destination is an ordinary field, so it lands in `values`, can be validated
and is sent with no special handling. It follows the selection (including on a
restored form, filled in at creation time) and empties when the choice no
longer exists in the list.

The compiler rejects a destination that isn't in `fields`, and rejects pointing
a field at itself — which would erase its own value.

### Reactive meta

`meta` is a function of the context, so variable data (a price that depends on
the person type) stays reactive — with no separate place for "dynamic meta".

## Clearing a field that disappeared

Switching from individual to business can't leave a filled SSN travelling to
the backend. Instead of repeating the condition in an `onChange`, mark the
field:

```ts
rules: {
  ssn: { canShow: ctx => ctx.facts.isIndividual, clearWhenHidden: true },
  ein: { canShow: ctx => ctx.facts.isBusiness, clearWhenHidden: true },
}
```

`canShow` already said when the field exists; `clearWhenHidden` reuses that
condition. Writing the clearing by hand gets two cases wrong easily: **the
empty value** (which hides both groups at once) and **new fields** added to the
group later.

It's opt-in because it erases data — in a multi-step form, a hidden field
usually needs to keep what the user typed.

For conditional clearing that doesn't follow visibility, `onChange` is still
available.

### `onChange` writes through `ctx.patch()`

```ts
rules: {
  ein: {
    onChange: async (ein, ctx) => {
      const company = await lookupCompany(ein)
      ctx.patch({ legal_name: company.name, city: company.city })
    },
  },
}
```

`patch` is a **request**, not a direct write: if the field changes again before
the response arrives, the engine discards it — a slow lookup never overwrites
newer data.

That's also why a rule cannot write to `ctx.data` directly: without the engine
in between, there would be nowhere to intercept the stale response.

And the rule's **return value is ignored**, on purpose. If writes came from the
return value, a helper that happens to return an object would change the form
with nobody asking — and nothing in the code would say so.

## Consuming

```vue
<script setup lang="ts">
import useFederalCourt from '~/forms/federal-court'

const { data, canShow, options, values, meta, validate } = useFederalCourt()
</script>

<template>
  <input v-if="canShow.ssn" v-model="data.ssn.value" :placeholder="data.ssn.label">
</template>
```

Destructuring is the recommended usage: derived state comes back as
`ComputedRef`, and templates unwrap top-level refs automatically. Keeping the
whole object instead would force `form.canShow.value.ssn` even inside a `v-if`.

## Shared instance

`useMyDomain()` always returns **the same instance** — like `defineStore`. That
solves the form split across sub-components: any child calls the composable and
gets the same state, with no prop drilling, and the `onChange` watchers are
registered **exactly once**.

Watchers live in a detached `effectScope`, so they belong to the domain rather
than to whichever component instantiated it first — if that component unmounts,
the effects keep working for the others.

Under SSR, instances live on the request's app, never in a module variable.

## Splitting into files

`fields` and `facts` stay together (they're the source of the types); the
rest moves out:

```
forms/federal-court/
├── domain.ts   → createFormDomain().withFields().withFacts()
├── rules.ts    → RulesOf<Base>
├── schema.ts   → SchemaOf<Base>
├── meta.ts     → MetaOf<Base, MyMeta>
└── index.ts    → base.withRules(rules).withSchema(schema).withMeta(meta).build()
```

`RulesOf`, `SchemaOf` and `MetaOf` extract the context from the partial
builder — without them each file would try to reconstruct the types and hit a
circular import.

## Catalog

Domains under `<srcDir>/forms` are discovered automatically:

```ts
const domain = useFormDomain('federal-court') // typed: that domain's meta and fields
const all = useFormDomains()                   // instantiates all — use for catalogs
const catalog = useFormDomainsMeta()           // metadata only
```

`useFormDomain` instantiates **only** the requested domain: the factory is
registered at `build()` time without creating reactive state. `useFormDomains`
instantiates all of them — the inherent cost of listing.

`x.ts` and `x/index.ts` are the same domain; if both exist, the directory wins.

## What the compiler guarantees

| Error | When it surfaces |
|---|---|
| `rules` referencing a field that doesn't exist | **compile time** |
| `schema` validating a field that doesn't exist | **compile time** |
| `ctx.facts` with an undeclared key | **compile time** |
| `set()` with a wrong field or type | **compile time** |
| `meta` with a key that doesn't exist | **compile time** |
| `useFormDomain('unknown-slug')` | **compile time** |
| `storeLabelIn` pointing at a missing field, or at itself | **compile time** |
| `register()` reading an extra the field never declared | **compile time** |
| an option whose value doesn't match the field's | **compile time** |
| `onChange` patching a field that doesn't exist | ignored at runtime |

The last one is a known limitation — the generic that validates `rules` keys
loosens the patch type. It's covered by a test rather than by contorting the
types to the point where the error message becomes unreadable.

## API

```ts
const form = useMyDomain()

form.id          // slug, as a literal type
form.data        // reactive: { field: { key, label, value, mask? } }
form.values      // plain values
form.facts    // derived business rules
form.canShow     // { field: boolean } — a field with no rule is visible
form.options     // effective options per field
form.selected    // the selected option — where the friendly label comes from
form.shape       // visible validators, with the types you declared
form.composeSchema(object) // the same, composed by your library, reactive
form.validate()  // validates visible fields only
form.meta        // metadata, reactive when declared as a function
form.register(k) // ready-made input props
form.set(patch)  // partial, typed patch
form.reset()     // back to initial values
form.dispose()   // stops the watchers
```

## Development

```bash
pnpm dev:prepare   # required before test/typecheck (generates the playground .nuxt)
pnpm test
pnpm typecheck
pnpm typecheck:playground
pnpm dev
```

`playground/app/pages/domain-guard.vue` and `catalog-guard.vue` hold the type
guarantees with `@ts-expect-error`: if one regresses, the directive becomes
unused and typecheck fails instead of silently passing.

## License

MIT
