# @null-nuxt/tracking

Interaction tracking for Nuxt 3 and 4. The core handles what is always the
same — anonymous identity, attribution, context, the navigation tree, dedupe,
delivery — and leaves pluggable what actually differs per project: the **wire
format**, the **identity strategy** and the **event vocabulary**.

Extracted from four projects doing the same thing by copy-paste, each with one
more variation than the last.

## Installation

```bash
pnpm add "github:null-nuxt/null-nuxt#tracking@0.1.0&path:/packages/tracking"
```

Each package is tagged on its own, since they are versioned and pinned
separately. Dropping the tag resolves to whatever `main` points at.

Not published to npm — installed straight from the repository. The consuming
project must allow the package to build on install:

```yaml
# pnpm-workspace.yaml
allowBuilds:
  "@null-nuxt/tracking": true
```

```ts
export default defineNuxtConfig({
  modules: ['@null-nuxt/tracking'],
  tracking: {
    baseURL: process.env.API_BASE_URL,
  },
})
```

## Events belong to the project

An event has three parts: a **slug** (what it is), a **type** (which family it
belongs to) and a **target** (what exactly). The type governs the target.

Declare everything in `app/tracking.ts` — the single source, feeding both the
runtime metadata and the types:

```ts
export default defineTracking({
  types: {
    conversion: { target: 'optional' },      // your own type
  },
  events: {
    landing_page: 'page_view',               // target forbidden
    add_to_cart: 'click',                    // target required
    featured_plan: 'hover',                  // target required + dwell threshold
    payment_tried: 'conversion',             // target optional
  },
})
```

There is no `.d.ts` to write: the module generates the augmentation pointing at
your file, and slugs, types and target rules are all **inferred** from it.

| built-in type | target | note |
|---|---|---|
| `page_view` | forbidden | |
| `click` | required | |
| `hover` | required | only fires after 400 ms of dwell |

`hover` ships with a threshold on purpose — without it, moving the mouse across
the screen would produce dozens of events. Your own types can set `minDwell`
too.

### The type becomes the signature

```ts
track('landing_page')                          // ok
track('landing_page', { target: 'x' })         // ✗ page_view takes no target
track('add_to_cart', { target: 'annual-plan' })// ok
track('add_to_cart')                           // ✗ click requires a target
track('unknown_slug')                          // ✗ not in the definition
```

The type is **not** an argument: it comes from the slug. That removes the
contradictory call the older signature allowed
(`track('click', 'landing_page')`).

Without `app/tracking.ts`, slugs fall back to `string` and nothing breaks — it
just doesn't protect.

## The three layers

The rule: **track the semantics, not the DOM.**

| kind of event | how |
|---|---|
| viewed a page | `definePageMeta({ track: 'landing_page' })` |
| a plain click | `v-track="{ name: 'clicked_summary', target: 'btn-x' }"` |
| a business event | `track('payment_tried')` in the handler, **after** validation |

The third one is where most implementations go wrong: `payment_tried` is not
"clicked the pay button" — a click that dies in form validation is not a
payment attempt. That's why business events are imperative calls at the point
where the action actually happens, not a directive on an element.

## Journey and sinks

The core doesn't decide what goes to your backend. It **collects** — identity,
attribution, context and the navigation tree — and you decide what comes out of
that.

### The tree

Each node points at the previous one. `page_view` advances the tree; clicks and
business events hang off the current node without becoming it. Going back in
the browser does **not** create a new node: the core recognises it through the
history position, returns to the existing node, and the next navigation becomes
a **sibling branch** — which is how you see "tried, went back, took another
path".

```ts
interface JourneyNode {
  id: string
  parent?: string   // the chain — this is what forms the tree
  type: 'page_view' | 'click' | 'event'
  name?: string
  target?: string
  path: string
  at: number
  dwell?: number    // filled in when leaving the node
}
```

The journey persists in `sessionStorage`, so it survives a reload and any
navigation that reloads the page. With `journey.persist: 'memory'` it resets on
every load. `journey.maxNodes` (default 200) caps growth; when trimming the
oldest, anything that loses its parent becomes a root so the tree is never
broken.

The journey is **client-only** by nature (it lives in `sessionStorage` and the
history). Any component displaying it needs `<ClientOnly>`, otherwise the server
renders it empty and the client renders it full — a hydration mismatch.

### Sinks

```ts
export default defineNuxtPlugin(() => {
  addTrackingSink(defineTrackingSink({
    on: ['unload'],
    send: snapshot => $fetch('/analytics', {
      method: 'POST',
      body: {
        visitor: snapshot.cookieId,
        source: snapshot.source,
        path: snapshot.journey.nodes.map(n => n.path),
      },
    }),
  }))
})
```

The sink receives **everything**, typed, and projects whatever it wants — there
is no field-selection DSL to learn. Multiple sinks coexist, and one that fails
neither silences the others nor breaks the interaction.

| trigger | when |
|---|---|
| `event` (default) | on every event; `node` is provided |
| `unload` | when the user leaves (via `pagehide`, which Safari honours) |
| `interval` | every `intervalMs` |

**With no sink registered, the legacy behaviour still applies**: one POST per
event with the preset's body. Installing the module doesn't change what your
backend receives; registering a sink is what takes over.

You can also read the tree directly, for debugging or UI:

```ts
const { journey, flush } = useTracking()
journey.value    // tree snapshot (reactive)
flush('unload')  // fire the unload sinks manually
```

## Statistics

```ts
const { stats } = useTracking()

stats.timeInCurrent()            // ms in the current event
stats.current()                  // the current node
stats.longest()                  // where the user spent the most time
stats.dwellOf(node)              // one node's dwell time
stats.occurrences('add_to_cart') // how many times it HAPPENED
stats.sends('add_to_cart')       // how many times it was SENT
stats.totalSends()               // total sends
```

**`occurrences` and `sends` answer different questions.** One project sends
once per page, another sends every event, another only on unload — the
occurrence count is the same in all three, the send count is not. That's why
the tree always records and dedupe only cuts the send.

Every event also carries an `id` (uuid) that persists with the journey.
Together with `cookieId`, that's a ready-made idempotency key for the backend.

`sendsVersion` is reactive and changes on every counted send — use it when a UI
needs to recompute `sends()`.

## Configuration

Everything is configured in `nuxt.config`, and configuration is **build-time**:
the module generates a virtual module (`#tracking-options`) instead of writing
to `runtimeConfig.public`. It doesn't travel in the SSR payload, doesn't show up
for anyone opening DevTools, and is tree-shakeable.

The trade-off: publishing the **same build** to several environments means
injecting whatever varies (typically `baseURL`) through `process.env` in
`nuxt.config`.

Convention fields (`endpoint`, `dedupe`, `source.queryParams`,
`source.directPrefix`) are **filled in by the preset** — only list them here to
override.

```ts
tracking: {
  enabled: true,
  baseURL: '',
  preset: 'tracking-pages',    // 'raw' for a new backend, with neutral conventions
  identity: {
    strategy: 'cookie',        // 'cookie' | 'iframe'
    cookieIdName: 'cuid',
    sourceName: 'src',
    days: 364,
    iframeOrigin: '',          // 'iframe' strategy only
    iframeSelector: '#iframe-cross-domain',
    iframeTimeout: 3000,
  },
  source: {
    firstTouch: true,          // a new ?src= doesn't overwrite a recorded origin
  },
  journey: {
    persist: 'session',        // 'memory' resets the tree on every load
    maxNodes: 200,
  },
  dedupeStorage: 'memory',     // 'session' survives a reload
  pageView: true,
  directive: 'track',          // false disables it
  transport: 'fetch',          // 'beacon' survives unload better
  debug: false,
}
```

### Identity: cookie or cross-domain iframe

`cookie` keeps the id and attribution in its own cookies. `iframe` shares
identity across domains through `postMessage` on a common host. The
implementation here has a timeout (an unresponsive iframe neither hangs the
promise nor leaves a `setInterval` running forever) and matches the response to
the request `type`, so two concurrent requests can't swap answers.

### Presets

A preset is **the body format plus the conventions that come with it**
(endpoint, attribution query parameter, direct-access prefix, dedupe).

| preset | for |
|---|---|
| `tracking-pages` | a legacy backend receiving `POST /tracking-pages`; sends `name` in the `track` field. Format locked by a test. |
| `raw` | a new backend: raw context and neutral conventions. |

For a different backend:

```ts
export default defineNuxtPlugin(() => {
  setTrackingPayload(ctx => ({ type: ctx.event, label: ctx.name, at: ctx.url }))
})
```

### Custom transport (axios, a configured instance)

The default is `fetch` with `keepalive` — which matters because a click that
navigates kills an in-flight request, and CTA clicks are exactly the ones worth
measuring.

```ts
export default defineNuxtPlugin(() => {
  const axios = useAxios()
  setTrackingTransport((url, body) => axios.post(url, body))
})
```

### Reporting errors

```ts
import { captureException } from '@sentry/nuxt'

export default defineNuxtPlugin(() => setTrackingErrorHandler(captureException))
```

## Dedupe

Dedupe is about **not repeating a send**. The navigation tree always records —
if dedupe blocked recording, revisiting a page would vanish from the journey and
the tree would lie about the path taken.

| scope | once per |
|---|---|
| `off` | never deduplicates |
| `name` | name, for the whole session |
| `name-path` | name + page, **ignoring the query string** |
| `name-url` | name + full URL (query counts) |

Per call: `{ once: false }` forces a send, `{ once: 'per-page' }` and
`{ once: 'per-url' }` override the global scope.

Prefer `name-path` over `name-url`: this module writes `?src=` into the URL when
propagating attribution, so with `name-url` the same page arriving from two
campaigns fires twice.

A failed send releases the dedupe, so a retry isn't swallowed.

### Firing once per page, for a database write

```ts
tracking: {
  dedupe: 'name-path',      // ignores the query string
  dedupeStorage: 'session', // survives a refresh
}
```

`dedupeStorage: 'memory'` (the default) resets on every page load — with a
database write, every refresh becomes a duplicate row. For that case, `session`
isn't optional.

**But client-side dedupe is best-effort, not a guarantee.** Another tab, a
private window, cleared storage, a different device — each of those produces a
new send. If the database can't hold duplicates, send an idempotency key and let
the server decide:

```ts
addTrackingSink(defineTrackingSink({
  send: (snapshot, node) => $fetch('/events', {
    method: 'POST',
    body: {
      idempotencyKey: `${snapshot.cookieId}:${node?.name}:${node?.path}`,
      event: node,
    },
  }),
}))
```

The client cuts the noise; the database guarantees uniqueness.

## Attribution

The plugin records `?src=` from the URL into a cookie (first-touch by default).
To propagate it to another link or domain:

```ts
const { withSource } = useTracking()
await withSource('https://other-domain.example')
```

The query parameter is built properly (respecting an existing `?`).

## Consent

Nothing is sent while `consent` is `false`. For a consent gate, start with
`tracking.enabled: false` and call `setConsent(true)` once the user accepts.

## API

```ts
const {
  track,          // (slug, options?) — the type comes from the slug
  trackPageView,  // (slug)
  flush,          // (trigger) — fires unload/interval sinks manually
  withSource,     // (url) → url carrying the attribution parameter
  captureSource,  // records ?src= from the URL (the plugin does this at boot)
  journey,        // reactive tree snapshot
  stats,          // occurrences, sends, dwell times
  consent,        // Ref<boolean>
  setConsent,     // (boolean) — nothing is sent while false
  last,           // last body sent through the legacy path
} = useTracking()
```

## Development

```bash
pnpm dev:prepare   # required before test/typecheck (generates the playground .nuxt)
pnpm test          # locks the wire format
pnpm typecheck
pnpm typecheck:playground   # validates the type registry end to end
pnpm dev
```

The playground has a local endpoint echoing the received body, and a
`type-guard` page whose errors are **expected** via `@ts-expect-error` — if the
type augmentation regresses, typecheck fails instead of silently passing.

## License

MIT
