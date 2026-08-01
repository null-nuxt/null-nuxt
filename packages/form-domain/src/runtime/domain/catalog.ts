import domains from '#form-domains'
import { registeredDomains } from './createFormDomain'

/** Every domain composable discovered under `<srcDir>/forms`. */
type Factories = typeof domains

/** The factories themselves, which is where the static parts live. */
type Factory = Factories[number]

/** The union of every instance — where the typed lookup by slug comes from. */
export type AnyFormDomain = Factories extends readonly (() => infer I)[] ? I : never

export type FormDomainSlug = AnyFormDomain extends { id: infer Id extends string } ? Id : string

/**
 * A specific domain, correctly typed for the slug: `useFormDomain('x')` returns
 * exactly that domain, not a union of all of them.
 *
 * Instantiates only the requested domain — the factory was registered at
 * `build()` time without creating reactive state.
 */
export function useFormDomain<S extends FormDomainSlug>(slug: S) {
  /**
   * Reading `domains` here isn't decorative: the import must be a VALUE import,
   * because executing the domain files is what registers the factories. Since
   * `import type` would be erased, the catalog would be empty at runtime.
   */
  if (domains.length === 0) {
    throw new Error('[@null-nuxt/form-domain] no form domains found. Are they under <srcDir>/forms?')
  }

  const factory = registeredDomains().get(slug)
  if (!factory) {
    throw new Error(`[@null-nuxt/form-domain] form domain "${slug}" not found. Is it under <srcDir>/forms?`)
  }

  return factory() as Extract<AnyFormDomain, { id: S }>
}

/**
 * Every domain. Unlike the lookup by slug, here ALL of them are instantiated —
 * the inherent cost of listing; use it for catalogs, not on a hot path.
 */
export function useFormDomains(): AnyFormDomain[] {
  return domains.map(use => use()) as AnyFormDomain[]
}

/**
 * Every domain's catalog entry, WITHOUT instantiating any of them — this is the
 * one a listing page wants. `metadata` is static, so it is read straight off
 * the factory: 300 certificates cost 300 property reads, not 300 effect scopes.
 *
 * Not a composable in any real sense — there is no reactive state to own — but
 * it keeps the `useX` name the rest of the catalog uses.
 */
export function useFormDomainsMetadata(): Array<Pick<Factory, 'id' | 'metadata'>> {
  return domains.map(factory => ({ id: factory.id, metadata: factory.metadata }))
}

/**
 * Every domain's outcome. Unlike the metadata listing, this one INSTANTIATES
 * every domain, because an outcome is a function of a filled form. Use it when
 * you genuinely need the reactive values; reach for `useFormDomainsMetadata`
 * for a catalog.
 */
export function useFormDomainsOutcome() {
  return useFormDomains().map(domain => ({
    id: (domain as { id: string }).id,
    outcome: (domain as { outcome: unknown }).outcome,
  }))
}
