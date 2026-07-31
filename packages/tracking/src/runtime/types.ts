import type { builtinTypes } from './events'

// `#tracking` is the public entry point: types and the definition helper
export { defineTracking } from './events'
export type { EventTypeDef, TargetRule, TrackingDefinition } from './events'

/**
 * The module GENERATES this augmentation pointing at the project's
 * `app/tracking.ts` — nobody hand-writes a `.d.ts`. Slugs, types and the target
 * rule all come from the same runtime definition.
 */
// Must start EMPTY: that's what lets the module augment it.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TrackingDefinitionRegistry {}

type RegisteredDefinition = TrackingDefinitionRegistry extends { definition: infer D } ? D : never

type EventsOf<D> = D extends { events: infer E } ? E : never
type CustomTypesOf<D> = D extends { types: infer T } ? T : Record<never, never>

type AllTypes = CustomTypesOf<RegisteredDefinition> & typeof builtinTypes

/** With no definition registered the types stay permissive instead of breaking. */
type HasDefinition = [RegisteredDefinition] extends [never] ? false : true

export type TrackSlug = HasDefinition extends true
  ? keyof EventsOf<RegisteredDefinition> & string
  : string

type TypeNameOf<S extends string> = S extends keyof EventsOf<RegisteredDefinition>
  ? EventsOf<RegisteredDefinition>[S]
  : never

type TargetRuleOf<S extends string> = TypeNameOf<S> extends keyof AllTypes
  ? AllTypes[TypeNameOf<S>] extends { target: infer R } ? R : 'optional'
  : 'optional'

/**
 * Targets stay project-specific; augmenting `target` here gives autocomplete
 * without tying the library to business values.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TrackingRegistry {}

export type TrackTarget = TrackingRegistry extends { target: infer T } ? T : string

export type Device = 'mobile' | 'desktop'

/**
 * Per-call dedupe. `true` uses the module's global scope; `'per-page'` ignores
 * the query string, `'per-url'` takes it into account.
 */
export type Once = boolean | 'per-page' | 'per-url'

export interface TrackOptions {
  target?: TrackTarget
  once?: Once
}

/**
 * The target rule of the slug's TYPE becomes the call signature: required,
 * optional or forbidden. It's what rejects `track('landing_page', { target })`.
 */
export type TrackArgs<S extends TrackSlug> = TargetRuleOf<S> extends 'never'
  ? [options?: Omit<TrackOptions, 'target'>]
  : TargetRuleOf<S> extends 'required'
    ? [options: Omit<TrackOptions, 'target'> & { target: TrackTarget }]
    : [options?: TrackOptions]

/** Everything the core collects before delegating the format to the preset. */
export interface TrackContext {
  /** The event's type, derived from the slug — never passed by hand. */
  event: string
  /** The slug itself (e.g. `add_to_cart`). */
  name: string
  target?: TrackTarget
  url: string
  device: Device
  source: string
  cookieId: string
  language: string
  userAgent: string
}

/**
 * Where the anonymous id and the attribution come from. Async because the
 * cross-domain iframe strategy resolves over postMessage.
 */
export interface IdentityProvider {
  cookieId(): string | Promise<string>
  getSource(): string | null | Promise<string | null>
  setSource(value: string): void | Promise<void>
}

/** Translates the context into the body the backend expects. */
export type PayloadBuilder = (ctx: TrackContext) => unknown

export type Transport = (url: string, body: unknown) => void | Promise<void>

export interface TrackDirectiveValue extends TrackOptions {
  name: TrackSlug
}

/** A node in the navigation tree. `parent` is what forms the tree. */
export interface JourneyNode {
  id: string
  parent?: string
  type: 'page_view' | 'click' | 'event'
  name?: string
  target?: string
  path: string
  url: string
  at: number
  /** Time spent on the node, in ms — filled in when the user leaves it. */
  dwell?: number
  /** Browser history position; used to detect backward navigation. */
  position?: number
}

export interface JourneySnapshot {
  startedAt: number
  currentId: string | null
  nodes: JourneyNode[]
}

export interface TrackingStorage {
  read: () => string | null
  write: (value: string) => void
}

/** Everything the core knows. The sink receives this and decides what becomes a request. */
export interface TrackingSnapshot {
  cookieId: string
  source: string
  device: Device
  language: string
  userAgent: string
  journey: JourneySnapshot
}

export type SinkTrigger = 'event' | 'unload' | 'interval'

export interface TrackingSink {
  name?: string
  /** When `send` runs. Defaults to every event. */
  on?: SinkTrigger[]
  intervalMs?: number
  /**
   * `node` is provided on the per-event trigger and absent on unload/interval,
   * where the trigger is the whole journey rather than one specific event.
   */
  send: (snapshot: TrackingSnapshot, node?: JourneyNode) => void | Promise<void>
}
