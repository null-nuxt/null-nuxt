# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and both packages
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
independently.

Each package is tagged on its own — `form-domain@0.4.0`, `tracking@0.1.0` —
because they are installed and pinned separately. The repo-wide `v0.1.0` tag
predates that and is kept only so existing pins keep resolving.

## [Unreleased]

### `@null-nuxt/form-domain` — Changed

- **`options` and `selected` are keyed by the fields that declared options**,
  not by every field. They used to type a plain text input as though a choice
  might land in it — the same mistake `register()` had before its extras were
  made per-field.

  A field declares `options` to say it holds a choice; an empty list counts and
  reads as "the list comes later". That marker is now also what lets a rule
  derive the list: `addRules` rejects `options` on a field that never declared
  any, since deriving a list for something that never said it was a select is a
  mistake the types can catch.

  Breaking for a field that took its options only from a rule — add
  `options: []` to its declaration.

- **A rule derives a list with `deriveOptions`, not `options`.** The two shapes
  differ — an array in the declaration, a function returning one in the rule —
  and sharing the name invited writing the array form in a rule and learning
  otherwise from a type error. The verb also stops the key reading as a setting
  of `addRules` itself, which is what the other rule keys are not.

### `@null-nuxt/form-domain` — Fixed

- **`refFields` checks an option's value against its own field again.** The
  guarantee held through `refField()` and not through `refFields()`, which is
  the path almost everyone takes: the record is keyed with `any`, because its
  entries hold different value types from one another, and `any` switched the
  check off. A field holding a string accepted options holding numbers — the
  select would render choices that can never match, `selected` would never
  resolve, and a `oneOf` schema would reject everything the user picked.

  This regressed when the setup format was built. The builder forced every field
  through `field()`, so the check always ran; `refFields` accepting a bare
  declaration is what opened the gap — and the README kept claiming the
  guarantee in 0.3.0 and 0.4.0.

### `@null-nuxt/form-domain` — Added

- **Fields in their own file are now an inert declaration**, not a factory.
  What sits at module scope is plain data, so there is no reactive state to
  leak between requests — the mistake stops existing rather than being detected
  after the fact. `refFields(declaracao)` runs inside the setup, and the
  guarantees stay in the constructor. The factory still works and is documented
  as the older way.

- **The two ways in are documented.** The engine (`values`, `register`,
  `canShow`, `selected`, `options`) answers collection questions; `fields.cpf`
  is the unit you hand to a component with its own contract. They are not
  redundant, and the confusion was never that both exist — it was that nothing
  said which was for what. A playground component takes a field, so the second
  contract is typechecked rather than only described.

- **`form.selected`**, the chosen option per field, back on the engine.
  Reaching it was the only reason a consumer needed the raw field objects, so
  `form.values.x` and `form.fields.x.value` were two ways to the same value with
  nothing to say which. The payload context gets it too, which flattens the one
  nested read it had.

  Additive: the field object still carries its own `selected`, which is what a
  setup reads off the const it declared.

## `@null-nuxt/form-domain` 0.4.0 — 2026-08-01

Renames only. No behaviour changed.

### Changed

- **`fields` is `refFields`, and `field` is `refField`.** They create reactive
  state the way `ref()` does, which is exactly why calling them at module scope
  is a mistake — the prefix carries a warning the bare name couldn't. `use*` was
  the obvious alternative and is wrong twice over: it claims "composable", which
  these aren't, and `useField` is already vee-validate's.

- **`useForm` is `toForm`.** vee-validate exports `useForm`, and most projects
  reaching for this package have vee-validate too — so the old name collided
  head-on with an import the same file was likely to hold. `to*` follows Vue's
  own sense of deriving one shape from another, as in `toRefs`. `createForm`
  was considered and dropped: in this package `create*` used to mean a builder
  you had to terminate.

The README now also says outright that the `useForm({ validationSchema })` in
the validation section is **vee-validate's**, not this package's. That
ambiguity was in the 0.3.0 docs and is what surfaced the collision.

## `@null-nuxt/form-domain` 0.3.0 — 2026-08-01

The builder is gone. A form is now a setup function.

### Changed

- **`createFormDomain` and the whole `withX` chain are replaced** by
  `defineFormDomain(id, metadata?, setup)` for a shared domain and
  `useForm(fields)` for one inside a component — where no wrapper is needed at
  all, since `<script setup>` is already the scope.

  The chain existed for one reason: inside a single object literal TypeScript
  infers every property at once, so `rules` could not see the inferred type of
  `facts`. A setup has no literal — each line is a declaration and inference
  runs top to bottom — so the limitation is gone rather than worked around.

- **Rules and validation are attached to the field**, with the field as the
  argument: `addRule(campos.cpf, { ... })`, or `addRules(campos, { ... })` for
  several. Nothing needs to know which form is "current", so these are callable
  from any file without an ambient registry, and the rules stay a separable
  layer. They are also callable any number of times, so a large domain can be
  split by section — one file owning a block's rule *and* its validation —
  instead of by layer.

- **`facts` and `outcome` stop being layers** and become plain `computed`. The
  setup returns its fields under the reserved `fields` key and everything else
  it returns is exposed untouched; nothing is classified.

### Removed

- **`RulesOf`, `SchemaOf`, `OutcomeOf`, `ContextOf` and `PayloadContextOf`.**
  These existed so a split-file domain could reconstruct the builder's
  accumulated types — library plumbing a consuming project had to import to use
  the feature. What crosses a file boundary now is
  `ReturnType<typeof createFields>`, a type from the project's own factory. The
  ported domain went from five such imports to none.

### Added

- **A warning when one fields object drives two forms.** Fields are reactive
  state, and declared at module scope they are built once per process, so under
  SSR the second request drives what the first one filled in. The types cannot
  see this, so it is caught at runtime, on the condition that is the bug rather
  than a proxy for it. Wrap fields in a factory and call it inside the setup.

## `@null-nuxt/form-domain` 0.2.1 — 2026-08-01

### Fixed

- **A layer declared before `withFields` no longer passes its key check in
  silence.** `withFields` is what gives the check something to check against;
  before it, `keyof F` is the whole `string` type, every key satisfies
  `K extends Allowed`, and `OnlyKnownKeys` accepts anything. Validating a field
  that doesn't exist compiled cleanly, which is worse than not checking at all —
  it looked like the check had run. It is now a compile error naming the cause.

  ```ts
  createFormDomain('x')
    .withRules({ anything: { canShow: () => true } })  // ✗ declare withFields first
    .withFields({ /* ... */ })
  ```

  Correct order is unaffected. Only code that was already unchecked stops
  compiling.

## `@null-nuxt/form-domain` 0.2.0 — 2026-08-01

Breaking, and worth migrating in one go: three layer names changed and
`storeLabelIn` is gone. Everything here is type-level, so the compiler points
at every call site that needs updating.

### Fixed

- **`register()` bindings are assignable to an ordinary input component.** The
  `update:modelValue` handler now accepts `TValue | undefined`. A component
  declaring `defineModel<string>()` emits `string | undefined`, and under
  `strictFunctionTypes` a handler taking only `string` is not assignable to it —
  `v-bind="form.register('name')"` failed to compile on the most common way to
  write an input.
- **`shape` keeps the validator types the project declared** instead of erasing
  them to `StandardSchemaV1`, so `object(form.shape.value)` and
  `z.object(form.shape.value)` compile. Composing was the documented purpose of
  `shape` and it did not typecheck. A key is optional only when a `canShow` rule
  can hide it: an all-optional shape is what those functions reject.

### Added

- **`withMetadata`**, the catalog entry: title, route, category, keywords,
  ordering, which component renders the form. Static, and attached to the
  factory rather than the instance, so **`useFormDomainsMetadata()` lists every
  domain without instantiating any of them**. The old listing called every
  factory to collect what were mostly constants — a catalog of 300 certificates
  created 300 effect scopes to render 300 links.
- **`withPayload`**, projecting the filled form for the backend. The context
  carries `values`, `visible` (only what `canShow` allows through), `facts`,
  `selected` and `outcome`, so a price the backend also wants isn't computed
  twice. Without it, `payload` is `values`.
- **`PayloadContextOf`** for splitting the payload into its own file. It
  annotates the context rather than the whole function, so unlike `SchemaOf`
  the projected type survives.
- **`composeSchema(combine)`**, handing the visible validators to the project's
  own combinator and returning a `ComputedRef`:
  `form.composeSchema(object)`, `form.composeSchema(z.object)`. Which library
  composes stays the project's decision; the reactivity does not — composing by
  hand outside a `computed` freezes the schema at its first value, so a field
  `canShow` hides later stays required.

### Changed

- **`register()` is typed per field.** `options`, `placeholder` and `mask` are
  absent from the bindings unless the field (or, for options, a rule) declares
  them, so reading one that doesn't exist is a compile error rather than
  `undefined`. `field()` now returns the definition as written to make that
  possible; the guarantee that an option's value matches the field's is
  unchanged.
- `FormDomainBuilder` and `FormDomainInstance` carry further type parameters —
  schema, rules, metadata and payload. All default, so annotations that named
  the previous four keep working.
- **`withComputed` is now `withFacts`**, and `ctx.computed` is `ctx.facts`.
  Vue's `computed` is auto-imported in every SFC, so the old name made the
  reader stop to work out which of the two it was. `facts` also pairs with
  `rules`.
- **`withMeta` is now `withOutcome`**, and `form.meta` is `form.outcome`;
  `MetaOf` is `OutcomeOf`. The name had to move to make room for `metadata`,
  and `outcome` describes the contents better: price, sku and the cart line are
  what results from filling the form in, not metadata about the domain.

### Removed

- **`storeLabelIn`.** Getting an option's text into the payload took three
  declarations — a phantom `field()` nobody fills, the mirror rule, and a
  second rule hiding the phantom from the screen — and kept derived data as
  state, which is the staleness the engine argues against everywhere else.
  `withPayload` does it in one line, computed on read. The phantom field, its
  watcher and the `Exclude<keyof F, K>` gymnastics are gone with it.

## [0.1.0] — 2026-07-31

First release of both packages. Everything below is initial functionality, so
it is listed under `Added` rather than split across change types.

### `@null-nuxt/tracking` — Added

- **Event model built on slug + type + target.** Events are declared in
  `app/tracking.ts` through `defineTracking`, and the module generates the type
  augmentation from that file — there is no `.d.ts` to hand-write. The type
  governs whether a target is required, optional or forbidden, which makes
  contradictory calls impossible to express.
- **Built-in types**: `page_view`, `click` and `hover`. `hover` carries a
  mandatory dwell threshold (400 ms by default) so a mouse crossing the screen
  can't flood the backend.
- **Navigation tree.** Nodes chain to their parent; going back in the browser
  reuses the existing node so the next navigation becomes a sibling branch,
  which is what reveals "tried, went back, took another path". Persisted in
  `sessionStorage`, capped by `maxNodes`.
- **Sinks.** The core collects and the project decides delivery, with `event`,
  `unload` and `interval` triggers. With no sink registered the legacy path
  stays byte-identical, so installing the module doesn't change what an existing
  backend receives.
- **Statistics** separating `occurrences` (how often it happened) from `sends`
  (how often it was transmitted) — two genuinely different questions once
  dedupe is in play.
- **Pluggable identity**: own cookies, or a cross-domain iframe sharing identity
  across hosts. The iframe strategy has a timeout and matches responses to
  requests, so a silent iframe can't hang a promise and concurrent requests
  can't swap answers.
- **Pluggable transport and payload**, defaulting to `fetch` with `keepalive`
  so a click that navigates doesn't lose its event.
- **First-touch attribution** from `?src=`, with `withSource()` to propagate it.
- **Configurable dedupe** by name, page or full URL, with a per-call override.
  `name-path` is recommended: this module writes `?src=` into URLs, so a
  URL-scoped dedupe would fire twice for the same page reached from two
  campaigns.
- **Build-time configuration** through a generated virtual module rather than
  `runtimeConfig.public`, keeping it out of the SSR payload.
- **Consent gate**: nothing is sent while consent is false.

### `@null-nuxt/form-domain` — Changed

- **`options` and `selected` are keyed by the fields that declared options**,
  not by every field. They used to type a plain text input as though a choice
  might land in it — the same mistake `register()` had before its extras were
  made per-field.

  A field declares `options` to say it holds a choice; an empty list counts and
  reads as "the list comes later". That marker is now also what lets a rule
  derive the list: `addRules` rejects `options` on a field that never declared
  any, since deriving a list for something that never said it was a select is a
  mistake the types can catch.

  Breaking for a field that took its options only from a rule — add
  `options: []` to its declaration.

- **A rule derives a list with `deriveOptions`, not `options`.** The two shapes
  differ — an array in the declaration, a function returning one in the rule —
  and sharing the name invited writing the array form in a rule and learning
  otherwise from a type error. The verb also stops the key reading as a setting
  of `addRules` itself, which is what the other rule keys are not.

### `@null-nuxt/form-domain` — Fixed

- **`refFields` checks an option's value against its own field again.** The
  guarantee held through `refField()` and not through `refFields()`, which is
  the path almost everyone takes: the record is keyed with `any`, because its
  entries hold different value types from one another, and `any` switched the
  check off. A field holding a string accepted options holding numbers — the
  select would render choices that can never match, `selected` would never
  resolve, and a `oneOf` schema would reject everything the user picked.

  This regressed when the setup format was built. The builder forced every field
  through `field()`, so the check always ran; `refFields` accepting a bare
  declaration is what opened the gap — and the README kept claiming the
  guarantee in 0.3.0 and 0.4.0.

### `@null-nuxt/form-domain` — Added

- **`createFormDomain` builder** accumulating types across `withFields`,
  `withComputed`, `withRules`, `withSchema` and `withMeta`. The builder exists
  for a technical reason: in a single object literal, `rules` could not see the
  inferred type of `computed`.
- **`computed` as the shared source of business rules**, consumed by rules,
  schema and meta — removing the duplication where the same condition was
  written once as visibility and again as a `.when()`.
- **Schema-library agnostic** through
  [Standard Schema](https://standardschema.dev): Zod, Valibot, ArkType and
  yup 1.7+ all work with no adapter, and none is a dependency.
- **Validation declared per field**, which makes validating a non-existent
  field a compile error and lets hidden fields be skipped without any
  library-specific API.
- **Hidden fields are not validated**, reusing the condition already stated in
  `canShow`.
- **`clearWhenHidden`** to clear a field once it disappears, reusing that same
  condition instead of restating it in an `onChange`.
- **Declarative derived options** in `rules`, which removes the reset branch an
  imperative version would need.
- **`selected`** to resolve an option's label from the stored value, and
  **`storeLabelIn`** to mirror that label into an ordinary field so it can
  travel in the payload.
- **`onChange` writing through `ctx.patch()`**, with stale async responses
  discarded so a slow lookup can't overwrite newer input.
- **Two terminals**: `use()` for a local instance declared inline, `build()` for
  a shared domain registered in the catalog.
- **Typed catalog** with `useFormDomain('slug')`, `useFormDomains()` and
  `useFormDomainsMeta()`, discovering domains under `<srcDir>/forms`.
- **`register()`** producing ready-made input props, including `options`,
  `placeholder` and `mask` only when the field actually has them.
- **File splitting** supported through the `RulesOf`, `SchemaOf` and `MetaOf`
  helpers, which extract the context from a partial builder and avoid a
  circular import.

[Unreleased]: https://github.com/null-nuxt/null-nuxt/compare/form-domain@0.4.0...HEAD
[0.1.0]: https://github.com/null-nuxt/null-nuxt/releases/tag/v0.1.0
