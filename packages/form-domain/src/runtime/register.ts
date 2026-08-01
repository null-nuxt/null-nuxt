import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { FieldObj, FieldRule } from './field'
import type { AnyFields, OnlyKnownKeys, ValuesOf } from './form-types'

/**
 * Two rules for the same field is almost always a copy-paste, not intent —
 * and with the registration callable any number of times it stops being
 * impossible the way `withRules({...})` made it. Loud in dev, last-write-wins
 * in production so a warning never breaks a page.
 */
const warnIfTaken = (slot: 'rule' | 'schema', key: string, taken: boolean) => {
  if (!taken || !import.meta.dev) return

  console.warn(
    `[@null-nuxt/form-domain] field "${key}" already had a ${slot}; the later one replaces it. `
    + `Declaring the same field in two places is usually a copy-paste.`,
  )
}

/**
 * Behaviour for one field. The field is the argument, so nothing has to know
 * which form is "current" — which is what keeps this callable from anywhere,
 * including another file, without the hazards an ambient registry brings.
 */
export function addRule<TValue, TValues>(
  target: FieldObj<TValue, TValues>,
  rule: FieldRule<TValue, TValues>,
): void {
  warnIfTaken('rule', target.key, target.rule !== undefined)
  target.rule = rule
}

/**
 * Behaviour for several fields at once, keyed by name.
 *
 * The object is a DIRECT argument rather than something returned, which is
 * what puts the compiler's finger on the offending key: from an arrow's return
 * the same check still fires, but the error lands on the whole function.
 */
export function addRules<F extends AnyFields, R>(
  fields: F,
  rules: R
    & { [K in keyof F]?: FieldRule<F[K]['value'], ValuesOf<F>> }
    & OnlyKnownKeys<R, keyof F & string>,
): void {
  for (const [key, rule] of Object.entries(rules as Record<string, unknown>)) {
    const target = fields[key]
    if (target && rule) addRule(target, rule as FieldRule<unknown, unknown>)
  }
}

/** A validator, or a getter for one when it depends on the form's state. */
export type SchemaSource = StandardSchemaV1 | (() => StandardSchemaV1)

export function addSchema<TValue, TValues>(
  target: FieldObj<TValue, TValues>,
  schema: SchemaSource,
): void {
  warnIfTaken('schema', target.key, target.schema !== undefined)
  target.schema = schema
}

/**
 * Validation for several fields. Pass a getter for the ones that depend on
 * state — a plain validator is read once, which is the right thing when it
 * never changes and the wrong thing when it does.
 */
export function addSchemas<F extends AnyFields, S>(
  fields: F,
  schemas: S
    & { [K in keyof F]?: SchemaSource }
    & OnlyKnownKeys<S, keyof F & string>,
): void {
  for (const [key, schema] of Object.entries(schemas as Record<string, unknown>)) {
    const target = fields[key]
    if (target && schema) addSchema(target, schema as SchemaSource)
  }
}
