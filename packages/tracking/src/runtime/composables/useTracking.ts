import { computed, shallowRef } from 'vue'
import { joinURL, withQuery } from 'ufo'
import { useState } from '#imports'
import options from '#tracking-options'
import { cookieIdentity, iframeIdentity } from '../identity'
import { presets } from '../presets'
import { beaconTransport, fetchTransport } from '../transport'
import { detectDevice, readSourceParam } from '../context'
import { createJourney, memoryStorage, sessionStorage_ } from '../journey'
import { dedupeKeyFor } from '../dedupe'
import { createSendLedger } from '../ledger'
import { currentNode, dwellOf, longestNode, occurrencesOf, timeInCurrent } from '../stats'
import definition from '#tracking-events'
import type { SendLedger } from '../ledger'
import { dispatchToSinks, hasTrackingSinks } from '../sink'
import type { Journey } from '../journey'
import type {
  IdentityProvider,
  JourneyNode,
  JourneySnapshot,
  PayloadBuilder,
  SinkTrigger,
  TrackContext,
  TrackArgs,
  TrackSlug,
  TrackOptions,
  TrackTarget,
  TrackingSnapshot,
  Transport,
} from '../types'

/**
 * Overrides injected by a project plugin. They live at module scope because
 * they're functions — they wouldn't survive serialisation. They carry
 * configuration only, never user data.
 */
let transportOverride: Transport | null = null
let identityOverride: IdentityProvider | null = null
let payloadOverride: PayloadBuilder | null = null
let errorHandler: (error: unknown) => void = error => console.error('[@null-nuxt/tracking]', error)

/** A project talking to its backend through axios or its own instance plugs in here. */
export const setTrackingTransport = (transport: Transport) => {
  transportOverride = transport
}

export const setTrackingIdentity = (identity: IdentityProvider) => {
  identityOverride = identity
}

export const setTrackingPayload = (builder: PayloadBuilder) => {
  payloadOverride = builder
}

/** e.g. `setTrackingErrorHandler(captureException)` to report to Sentry. */
export const setTrackingErrorHandler = (handler: (error: unknown) => void) => {
  errorHandler = handler
}

const DEDUPE_KEY = '@null-nuxt/tracking:dispatched'
const JOURNEY_KEY = '@null-nuxt/tracking:journey'

/**
 * The journey is client-only (it depends on history and sessionStorage), so a
 * module singleton is enough — each browser has its own JS context and there is
 * no other user's request to leak into.
 */
let journeyInstance: Journey | null = null

/**
 * A counter used to invalidate computeds when the tree changes. It holds a
 * number, not user data, so living at module scope leaks nothing across
 * requests.
 */
const journeyVersion = shallowRef(0)

const journey = (): Journey => {
  if (!journeyInstance) {
    journeyInstance = createJourney({
      storage: options.journey.persist === 'session' ? sessionStorage_(JOURNEY_KEY) : memoryStorage(),
      maxNodes: options.journey.maxNodes,
      onChange: () => {
        journeyVersion.value++
      },
    })
    journeyInstance.restore()
  }
  return journeyInstance
}

const EMPTY_JOURNEY: JourneySnapshot = { startedAt: 0, currentId: null, nodes: [] }

let ledgerInstance: SendLedger | null = null
const ledgerVersion = shallowRef(0)

const ledger = (): SendLedger => {
  if (!ledgerInstance) {
    ledgerInstance = createSendLedger({
      storage: options.dedupeStorage === 'session' ? sessionStorage_(DEDUPE_KEY) : memoryStorage(),
    })
    ledgerInstance.restore()
  }
  return ledgerInstance
}

/**
 * The definition's keys are literals (that's where the types come from), but at
 * runtime lookups arrive as strings — hence the loose index, only here.
 */
const eventTypes = definition.events as Record<string, string | undefined>

/** A custom type becomes an `event` node; only built-ins get their own node type. */
const nodeTypeOf = (typeName: string): JourneyNode['type'] => {
  if (typeName === 'page_view') return 'page_view'
  if (typeName === 'click' || typeName === 'hover') return 'click'
  return 'event'
}

export const useTracking = () => {
  const consent = useState<boolean>('tracking:consent', () => options.enabled)
  /** The last body sent through the legacy path — the old `tracker` equivalent. */
  const last = useState<unknown>('tracking:last', () => null)

  const identity = () =>
    identityOverride
    ?? (options.identity.strategy === 'iframe'
      ? iframeIdentity({
          origin: options.identity.iframeOrigin,
          selector: options.identity.iframeSelector,
          timeout: options.identity.iframeTimeout,
        })
      : cookieIdentity({
          cookieIdName: options.identity.cookieIdName,
          sourceName: options.identity.sourceName,
          days: options.identity.days,
        }))

  const buildPayload = () => payloadOverride ?? presets[options.preset].payload
  const send = () => transportOverride ?? (options.transport === 'beacon' ? beaconTransport : fetchTransport)


  /**
   * Records the attribution from the current URL. First-touch by default: a new
   * `?src=` doesn't overwrite an origin already recorded.
   */
  const captureSource = async () => {
    if (!import.meta.client) return
    const incoming = readSourceParam(window.location.search, options.source.queryParams)
    if (!incoming) return

    const provider = identity()
    if (options.source.firstTouch && (await provider.getSource())) return
    await provider.setSource(incoming)
  }

  const resolveSource = async (provider: IdentityProvider) =>
    (await provider.getSource()) ?? `${options.source.directPrefix}${window.location.host}`

  const buildSnapshot = async (): Promise<TrackingSnapshot> => {
    const provider = identity()
    const userAgent = navigator.userAgent.toLowerCase()

    return {
      cookieId: await provider.cookieId(),
      source: await resolveSource(provider),
      device: detectDevice(userAgent),
      language: navigator.language,
      userAgent,
      journey: journey().snapshot(),
    }
  }

  /** The legacy path: one POST per event, with the preset's body. */
  const sendLegacy = async (snapshot: TrackingSnapshot, node: JourneyNode) => {
    const context: TrackContext = {
      event: node.name ? (eventTypes[node.name] ?? node.type) : node.type,
      name: node.name ?? '',
      target: node.target as TrackTarget | undefined,
      url: node.url,
      device: snapshot.device,
      source: snapshot.source,
      cookieId: snapshot.cookieId,
      language: snapshot.language,
      userAgent: snapshot.userAgent,
    }

    const body = buildPayload()(context)
    last.value = body

    if (options.debug) console.debug('[@null-nuxt/tracking]', context.event, context.name, body)

    await send()(joinURL(options.baseURL, options.endpoint), body)
  }

  /**
   * A registered sink takes over delivery; with none, the legacy path still
   * applies — installing the module doesn't change what the backend receives.
   */
  const emit = async (snapshot: TrackingSnapshot, node: JourneyNode) => {
    if (hasTrackingSinks()) {
      await dispatchToSinks('event', snapshot, node, errorHandler)
      return
    }
    await sendLegacy(snapshot, node)
  }

  /**
   * The type comes from the registered slug, not from the caller — which makes
   * it impossible to pass a type contradicting the event, as the older
   * signature allowed.
   */
  const track = async <S extends TrackSlug>(slug: S, ...args: TrackArgs<S>) => {
    if (!import.meta.client || !consent.value) return

    const opts = (args[0] ?? {}) as TrackOptions
    const name = slug as string

    const typeName = eventTypes[name] ?? 'click'
    const url = window.location.href
    const type = nodeTypeOf(typeName)
    const path = window.location.pathname

    /**
     * The tree ALWAYS records. Dedupe is about not repeating a SEND — if it
     * blocked recording, revisiting a page would vanish from the journey and the
     * tree would lie about the path the user took.
     */
    const node = type === 'page_view'
      ? journey().visit({ path, url, name, position: historyPosition() })
      : journey().record({ type, path, url, name, target: opts.target })

    const once = opts.once ?? options.dedupe !== 'off'

    let key: string | null = null
    if (once !== false) {
      key = dedupeKeyFor(name, once, options.dedupe, url, path)
      if (!ledger().isNew(key)) return
    }

    try {
      /**
       * ALWAYS counts, even with dedupe off — `stats.sends()` counts sends, and
       * dedupe only decides whether one is skipped. And before the await: two
       * quick clicks must not become two sends.
       */
      ledger().record(key, name)
      ledgerVersion.value++

      await emit(await buildSnapshot(), node)
    }
    catch (error) {
      // a lost send must not break the interaction: undo and report
      ledger().rollback(key, name)
      ledgerVersion.value++
      errorHandler(error)
    }
  }

  const trackPageView = (slug: TrackSlug) =>
    track(slug, ...([] as unknown as TrackArgs<TrackSlug>))

  /** Fires the `unload`/`interval` sinks with the whole journey. */
  const flush = async (trigger: SinkTrigger = 'unload') => {
    if (!import.meta.client || !consent.value || !hasTrackingSinks()) return
    await dispatchToSinks(trigger, await buildSnapshot(), undefined, errorHandler)
  }

  /**
   * Propagates the attribution to another link or domain. Builds the query
   * parameter properly (respecting an existing `?`).
   */
  const withSource = async (url: string) => {
    if (!import.meta.client) return url
    const source = await identity().getSource()
    const [param] = options.source.queryParams
    if (!source || !param) return url
    return withQuery(url, { [param]: source })
  }

  const setConsent = (value: boolean) => {
    consent.value = value
  }

  const snapshotOf = () => (import.meta.client ? journey().snapshot() : EMPTY_JOURNEY)

  /**
   * `occurrences` and `sends` answer DIFFERENT questions: how many times the
   * event happened, and how many times it was sent to the backend. A project
   * sending once per page and one sending every time share the same occurrence
   * count and have very different send counts.
   */
  const stats = {
    timeInCurrent: () => timeInCurrent(snapshotOf(), Date.now()),
    current: () => currentNode(snapshotOf()),
    longest: () => longestNode(snapshotOf(), Date.now()),
    dwellOf: (node: JourneyNode) => dwellOf(node, snapshotOf(), Date.now()),
    occurrences: (slug: TrackSlug) => occurrencesOf(snapshotOf(), slug),
    sends: (slug: TrackSlug) => (import.meta.client ? ledger().sends(slug) : 0),
    totalSends: () => (import.meta.client ? ledger().total() : 0),
  }

  return {
    track,
    trackPageView,
    flush,
    withSource,
    captureSource,
    consent,
    setConsent,
    last,
    stats,
    /** The navigation tree, reactive — render it straight from a component. */
    journey: computed<JourneySnapshot>(() => {
      void journeyVersion.value
      return snapshotOf()
    }),
    /** Reactive: changes on every counted send. */
    sendsVersion: computed(() => ledgerVersion.value),
    resetJourney: () => journey().reset(),
  }
}

/** Vue Router stores the position in history.state; that's what reveals backward navigation. */
function historyPosition(): number | undefined {
  const state = window.history.state as { position?: number } | null
  return typeof state?.position === 'number' ? state.position : undefined
}
