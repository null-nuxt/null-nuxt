import type { DedupeScope } from './dedupe'
import type { PresetName } from './presets'

/** What the runtime reads — everything already resolved. */
export interface ResolvedTrackingOptions {
  enabled: boolean
  baseURL: string
  endpoint: string
  preset: PresetName
  identity: {
    strategy: 'cookie' | 'iframe'
    cookieIdName: string
    sourceName: string
    days: number
    iframeOrigin: string
    iframeSelector: string
    iframeTimeout: number
  }
  source: {
    queryParams: string[]
    directPrefix: string
    firstTouch: boolean
  }
  journey: {
    /** `session` survives a reload; `memory` resets the tree on every page load. */
    persist: 'session' | 'memory'
    /** Node cap: a long session can't grow unbounded in storage. */
    maxNodes: number
  }
  dedupe: DedupeScope
  /**
   * `memory` resets on every page load — for database writes use `session`,
   * otherwise every refresh produces a duplicate.
   */
  dedupeStorage: 'memory' | 'session'
  pageView: boolean
  directive: string | false
  transport: 'fetch' | 'beacon'
  debug: boolean
}

/**
 * What the project writes in nuxt.config. Convention fields are optional because
 * the preset fills them in — override if you dislike the preset's defaults, and
 * if you say nothing you don't inherit another company's convention.
 */
export interface ModuleOptions extends Omit<ResolvedTrackingOptions, 'endpoint' | 'source' | 'dedupe'> {
  endpoint?: string
  dedupe?: ResolvedTrackingOptions['dedupe']
  source: {
    queryParams?: string[]
    directPrefix?: string
    firstTouch: boolean
  }
}
