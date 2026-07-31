# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and both packages
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
independently.

## [Unreleased]

Nothing yet.

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

### `@null-nuxt/forms` — Added

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

[Unreleased]: https://github.com/null-nuxt/null-nuxt/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/null-nuxt/null-nuxt/releases/tag/v0.1.0
