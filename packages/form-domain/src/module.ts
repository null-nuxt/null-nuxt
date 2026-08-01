import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { addImports, addTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'

export interface ModuleOptions {
  /** Registers `fields`, the `add*` helpers and the catalog composables. */
  autoImports: boolean
  /** Directory scanned for domains, relative to srcDir. */
  domainsDir: string
}

/**
 * Finds the domains: `forms/x.ts` or `forms/x/index.ts`. A SYNCHRONOUS scan on
 * purpose — an await inside setup makes Nuxt move past the point where it
 * collects aliases, and the alias disappears from the generated tsconfig.
 */
const findDomainFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return []

  /** Keyed by slug: `x/index.ts` and `x.ts` are the SAME domain, not two. */
  const bySlug = new Map<string, string>()

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)

    if (statSync(full).isDirectory()) {
      const index = ['index.ts', 'index.js'].map(file => join(full, file)).find(existsSync)
      // the directory wins: splitting into files was an explicit choice
      if (index) bySlug.set(entry, index)
      continue
    }

    if (!/\.[cm]?[jt]s$/.test(entry) || entry.endsWith('.d.ts')) continue

    const slug = entry.replace(/\.[cm]?[jt]s$/, '')
    if (!bySlug.has(slug)) bySlug.set(slug, full)
  }

  return [...bySlug.values()].sort()
}

/**
 * Explicitly annotated: without it the emitted .d.ts references an internal
 * node_modules path and breaks for anyone installing the package (TS2742).
 */
const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@null-nuxt/form-domain',
    configKey: 'forms',
    compatibility: { nuxt: '>=3.13.0' },
  },
  defaults: {
    autoImports: true,
    domainsDir: 'forms',
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    nuxt.options.alias['#forms'] = resolver.resolve('./runtime/index')

    const files = findDomainFiles(resolve(nuxt.options.srcDir, options.domainsDir))
    const withoutExtension = (file: string) => file.replace(/\.[cm]?[jt]s$/, '')

    /**
     * The project's domains. The catalog reads `id` and `metadata` straight
     * off these factories, so listing costs no setups; calling one is what
     * builds a form.
     */
    const domainsTemplate = addTemplate({
      filename: 'null-nuxt-form-domains.ts',
      write: true,
      getContents: () => [
        ...files.map((file, index) => `import domain${index} from '${withoutExtension(file)}'`),
        ``,
        // no `as const`: it would make `length` a literal and the catalog's
        // generic runtime would stop compiling (an "impossible" comparison)
        `export default [${files.map((_, index) => `domain${index}`).join(', ')}]`,
        ``,
      ].join('\n'),
    })

    nuxt.options.alias['#form-domains'] = domainsTemplate.dst

    if (options.autoImports) {
      addImports([
        { name: 'refField', from: resolver.resolve('./runtime/field') },
        { name: 'refFields', from: resolver.resolve('./runtime/field') },
        { name: 'addRule', from: resolver.resolve('./runtime/register') },
        { name: 'addRules', from: resolver.resolve('./runtime/register') },
        { name: 'addSchema', from: resolver.resolve('./runtime/register') },
        { name: 'addSchemas', from: resolver.resolve('./runtime/register') },
        { name: 'toForm', from: resolver.resolve('./runtime/define') },
        { name: 'defineFormDomain', from: resolver.resolve('./runtime/define') },
        { name: 'useFormDomain', from: resolver.resolve('./runtime/catalog') },
        { name: 'useFormDomains', from: resolver.resolve('./runtime/catalog') },
        { name: 'useFormDomainsMetadata', from: resolver.resolve('./runtime/catalog') },
      ])
    }
  },
})

export default module
