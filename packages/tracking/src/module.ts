import { addImports, addPlugin, addTemplate, addTypeTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defu } from 'defu'
import type { NuxtModule } from '@nuxt/schema'
import { presets } from './runtime/presets'
import type { ModuleOptions, ResolvedTrackingOptions } from './runtime/options'

export type { ModuleOptions }

/**
 * Without `endpoint`, `dedupe` and the `source` conventions: the chosen preset
 * fills those in. That way the module doesn't carry one specific backend's
 * convention as though it were a universal default.
 */
const defaults: ModuleOptions = {
  enabled: true,
  baseURL: '',
  preset: 'tracking-pages',
  identity: {
    strategy: 'cookie',
    cookieIdName: 'cuid',
    sourceName: 'src',
    days: 364,
    iframeOrigin: '',
    iframeSelector: '#iframe-cross-domain',
    iframeTimeout: 3000,
  },
  source: {
    firstTouch: true,
  },
  journey: {
    persist: 'session',
    maxNodes: 200,
  },
  dedupeStorage: 'memory',
  pageView: true,
  directive: 'track',
  transport: 'fetch',
  debug: false,
}

/**
 * Explicitly annotated: without it the emitted .d.ts references an internal
 * node_modules path and breaks for anyone installing the package (TS2742).
 */
const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@null-nuxt/tracking',
    configKey: 'tracking',
    compatibility: { nuxt: '>=3.13.0' },
  },
  defaults,
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    const preset = presets[options.preset]
    const resolved = defu(options, {
      endpoint: preset.defaults.endpoint,
      dedupe: preset.defaults.dedupe,
      source: {
        queryParams: preset.defaults.queryParams,
        directPrefix: preset.defaults.directPrefix,
      },
    }) as ResolvedTrackingOptions

    /**
     * Configuration goes into a virtual module generated at build time, not
     * into `runtimeConfig.public`. That keeps it out of the SSR payload, out of
     * sight in DevTools, and tree-shakeable.
     *
     * The trade-off: it becomes build-time. Publishing the SAME build to
     * several environments means injecting whatever varies (e.g. baseURL)
     * through `process.env` in nuxt.config.
     */
    const optionsTemplate = addTemplate({
      filename: 'null-nuxt-tracking-options.ts',
      write: true,
      getContents: () => [
        `import type { ResolvedTrackingOptions } from '${resolver.resolve('./runtime/options')}'`,
        ``,
        // an annotation, NOT `satisfies`: `satisfies` would preserve this build's
        // literals ('cookie', 'fetch'...) and the generic runtime would stop
        // compiling — the compiler would consider comparing against the other
        // options impossible.
        `const options: ResolvedTrackingOptions = ${JSON.stringify(resolved, null, 2)}`,
        ``,
        `export default options`,
        ``,
      ].join('\n'),
    })

    nuxt.options.alias['#tracking-options'] = optionsTemplate.dst

    nuxt.options.alias['#tracking'] = resolver.resolve('./runtime/types')

    /**
     * The project's event definition: a single runtime file providing BOTH the
     * metadata (each slug's type, target rule, dwell) AND the types — the
     * augmentation below is generated, not hand-written.
     */
    // A SYNCHRONOUS lookup on purpose: an await here makes setup move past the
    // point where Nuxt collects aliases, and the alias vanishes from the
    // generated tsconfig.
    const userEvents = ['tracking.ts', 'tracking.mjs', 'tracking.js']
      .map(file => resolve(nuxt.options.srcDir, file))
      .find(existsSync) ?? null

    const eventsTemplate = addTemplate({
      filename: 'null-nuxt-tracking-events.ts',
      write: true,
      getContents: () => userEvents
        ? `export { default } from '${userEvents.replace(/\.[cm]?[jt]s$/, '')}'\n`
        : [
            `import type { TrackingDefinition } from '${resolver.resolve('./runtime/events')}'`,
            ``,
            `// nenhum app/tracking.ts encontrado: slugs ficam livres`,
            `const definition: TrackingDefinition = { types: {}, events: {} }`,
            ``,
            `export default definition`,
            ``,
          ].join('\n'),
    })

    nuxt.options.alias['#tracking-events'] = eventsTemplate.dst

    if (userEvents) {
      addTypeTemplate({
        filename: 'types/null-nuxt-tracking-events.d.ts',
        getContents: () => [
          `declare module '#tracking' {`,
          `  interface TrackingDefinitionRegistry {`,
          // points at the project's file: slugs and rules are INFERRED from it
          `    definition: typeof import('${userEvents.replace(/\.[cm]?[jt]s$/, '')}').default`,
          `  }`,
          `}`,
          `export {}`,
          ``,
        ].join('\n'),
      })
    }

    addImports([
      { name: 'useTracking', from: resolver.resolve('./runtime/composables/useTracking') },
      { name: 'setTrackingTransport', from: resolver.resolve('./runtime/composables/useTracking') },
      { name: 'setTrackingIdentity', from: resolver.resolve('./runtime/composables/useTracking') },
      { name: 'setTrackingPayload', from: resolver.resolve('./runtime/composables/useTracking') },
      { name: 'setTrackingErrorHandler', from: resolver.resolve('./runtime/composables/useTracking') },
      { name: 'defineTrackingSink', from: resolver.resolve('./runtime/sink') },
      { name: 'addTrackingSink', from: resolver.resolve('./runtime/sink') },
      { name: 'defineTracking', from: resolver.resolve('./runtime/events') },
    ])

    addPlugin({ src: resolver.resolve('./runtime/plugin.client'), mode: 'client' })
    // universal: the directive must exist during SSR, otherwise a page using v-track breaks
    addPlugin({ src: resolver.resolve('./runtime/plugin.directive') })

    const directiveType = options.directive
      ? `v${options.directive.charAt(0).toUpperCase()}${options.directive.slice(1)}`
      : null

    addTypeTemplate({
      filename: 'types/null-nuxt-tracking.d.ts',
      getContents: () => [
        // RouteMeta cobre a LEITURA (route.meta.track); PageMeta cobre a
        // the WRITE side (definePageMeta) — different interfaces, both needed.
        `declare module 'vue-router' {`,
        `  interface RouteMeta {`,
        `    track?: import('#tracking').TrackSlug`,
        `  }`,
        `}`,
        `declare module '#app' {`,
        `  interface PageMeta {`,
        `    track?: import('#tracking').TrackSlug`,
        `  }`,
        `}`,
        ...(directiveType
          ? [
              `declare module 'vue' {`,
              `  interface GlobalDirectives {`,
              `    ${directiveType}: import('vue').ObjectDirective<HTMLElement, import('#tracking').TrackDirectiveValue>`,
              `  }`,
              `}`,
            ]
          : []),
        `export {}`,
        ``,
      ].join('\n'),
    })
  },
})

export default module
