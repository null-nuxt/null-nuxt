export type TargetRule = 'required' | 'optional' | 'never'

export interface EventTypeDef {
  /** Whether events of this type require, accept or forbid a target. */
  target: TargetRule
  /**
   * Only fires after this dwell time (ms). It exists because of hover: with no
   * threshold, a mouse passing by turns into dozens of events.
   */
  minDwell?: number
}

/**
 * Built-in types. `hover` ships with a threshold — leaving that default out
 * would ship a backend flooder disguised as a feature.
 */
export const builtinTypes = {
  page_view: { target: 'never' },
  click: { target: 'required' },
  hover: { target: 'required', minDwell: 400 },
} as const satisfies Record<string, EventTypeDef>

export type BuiltinTypeName = keyof typeof builtinTypes

export interface TrackingDefinition {
  types?: Record<string, EventTypeDef>
  events: Record<string, string>
}

/**
 * The single source: declares custom types and which type each slug belongs to.
 * It lives at runtime (the metadata is needed to validate targets and apply the
 * dwell threshold) and the module generates the types from it — projects never
 * hand-write a `.d.ts`.
 *
 * ```ts
 * // app/tracking.ts
 * export default defineTracking({
 *   types: { conversao: { target: 'optional' } },
 *   events: {
 *     landing_page: 'page_view',
 *     add_to_cart: 'click',
 *     payment_tried: 'conversao',
 *   },
 * })
 * ```
 */
export function defineTracking<
  const TTypes extends Record<string, EventTypeDef>,
  const TEvents extends Record<string, (keyof TTypes & string) | BuiltinTypeName>,
>(definition: { types?: TTypes, events: TEvents }): { types: TTypes, events: TEvents } {
  return { types: (definition.types ?? {}) as TTypes, events: definition.events }
}

/** Resolves a slug's type at runtime, merging built-in and custom types. */
export const resolveEventType = (
  definition: TrackingDefinition,
  slug: string,
): EventTypeDef | undefined => {
  const typeName = definition.events[slug]
  if (!typeName) return undefined

  const custom = definition.types?.[typeName]
  if (custom) return custom

  return (builtinTypes as Record<string, EventTypeDef>)[typeName]
}
