# null-nuxt

Nuxt modules for the patterns that repeat in every project: interaction
tracking and form definition.

| package | what it solves |
|---|---|
| [`@null-nuxt/tracking`](packages/tracking) | anonymous identity, attribution, page views, a click directive and delivery — with a pluggable wire format and identity strategy |
| [`@null-nuxt/form-domain`](packages/form-domain) | a form declared in layers (fields, rules, schema, meta) and consumed through composables, in the style of `defineStore` |

## Why they exist

This isn't an architectural preference — it's measured duplication across the
codebases these were extracted from:

- **5 projects** posted tracking to the same endpoint with the **same body
  shape**, through **4 different implementations** that had already drifted
  apart.
- `useCertificateSchema` was **byte-for-byte identical** in two projects;
  `useCertificateFormRules` differed only by a flag one of them had to add.
- The form codegen had **~500 identical lines** across two projects, differing
  in **5 constants** (paths and aliases).
- Where nothing was extracted, things drifted: the same payment integration
  had **diverged by 455 lines** between two sibling projects.

Every one of those divergences is a bug that has to be fixed N times.

## Principles

**Configurable, not opinionated.** Projects genuinely differ — HTTP client,
identity strategy, query parameter names, event vocabulary. What varies is an
option; what doesn't is core.

**Conventions live in presets, not defaults.** A convention from one specific
backend never becomes a global default — otherwise every new project inherits
another team's decision.

**The compiler is the cheapest test.** Where possible, a misconfiguration is a
build error instead of a runtime warning. Where that isn't possible, it's a
loud dev warning plus a test — and that limitation is documented, not hidden.

**No coupling to any single project.** No client names, no hard-coded domains,
no company convention baked in.

## Installing

These packages are not published to npm. Install them straight from this
repository — pnpm supports pointing at a subdirectory:

```bash
pnpm add "github:null-nuxt/null-nuxt#path:/packages/form-domain"
pnpm add "github:null-nuxt/null-nuxt#path:/packages/tracking"
```

Pin a tag for reproducible installs:

```bash
pnpm add "github:null-nuxt/null-nuxt#v0.1.0&path:/packages/form-domain"
```

A git-hosted package is built on install, and pnpm 10+ requires the consuming
project to allow that explicitly:

```yaml
# pnpm-workspace.yaml in the consuming project
allowBuilds:
  "@null-nuxt/form-domain": true
```

Without that entry the install fails with `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`.

## Development

```bash
pnpm install
pnpm bootstrap   # generates the playgrounds' .nuxt — needed by typecheck and tests
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`bootstrap` is a separate command rather than an automatic `prepare` on purpose:
`prepare` runs when the repository is installed as a git dependency too, where
it collides with the package build.

Each package has its own playground (`pnpm --filter @null-nuxt/tracking dev`)
and a `type-guard` page whose type errors are **expected**, asserted with
`@ts-expect-error`. If a type guarantee regresses, typecheck fails instead of
silently passing.

## Publishing

Packages are scoped under `@null-nuxt`. Versioning is per package;
`pnpm -r publish` from the root.

## License

MIT
