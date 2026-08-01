# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and both packages
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
independently.

Each package is tagged on its own — `form-domain@0.2.0`, `tracking@0.1.0` —
because they are installed and pinned separately. The repo-wide `v0.1.0` tag
predates that and is kept only so existing pins keep resolving.

## [Unreleased]

Nothing yet.

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

[Unreleased]: https://github.com/null-nuxt/null-nuxt/compare/form-domain@0.2.0...HEAD
[0.1.0]: https://github.com/null-nuxt/null-nuxt/releases/tag/v0.1.0
