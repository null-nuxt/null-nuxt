
// `#forms` is the package's public entry point
export { field } from './field'
export { createFormDomain } from './domain/createFormDomain'
export type {
  ContextOf,
  DomainContext,
  DomainOutcome,
  DomainRules,
  DomainSchema,
  FieldBindings,
  FieldOption,
  FormDomainBuilder,
  FormDomainInstance,
  OutcomeOf,
  ResolvedShape,
  RulesOf,
  SchemaOf,
} from './domain/types'

/**
 * A field describes itself completely: label, initial value and what the UI
 * needs (options, mask, placeholder). Those extras usually end up scattered in
 * constants next to the form — here they live with the field.
 */
export interface FieldDef<TValue = unknown> {
  label: string
  value: TValue
  placeholder?: string
  mask?: string
  options?: ReadonlyArray<{ label: string, value: TValue }>
}

/**
 * `any` is deliberate here: a form's fields have different value types from one
 * another, and `unknown` would erase the `F[K]['value']` inference that
 * `set()`, `onChange` and `values` rely on.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FieldsDef = Record<string, FieldDef<any>>

/**
 * The reactive `data` has the definition's shape plus `key`, injected by the
 * engine. Without it the template would repeat the field name
 * (`:name="'email'"`) right next to `data.email` — duplication we get rid of
 * for free.
 */
export type FormData<F extends FieldsDef> = {
  -readonly [K in keyof F]: F[K] & { key: K }
}

export type FormValues<F extends FieldsDef> = { [K in keyof F]: F[K]['value'] }

/**
 * A key outside `Allowed` gets the type `never`, which no schema satisfies —
 * that's what makes `shape({ missingField: string() })` fail to compile.
 * Constraining with `Partial<Record<...>>` alone wouldn't be enough: in an
 * `extends` check, extra properties pass.
 */
export type OnlyKnownKeys<T, Allowed extends string> = {
  [K in keyof T]: K extends Allowed ? T[K] : never
}

