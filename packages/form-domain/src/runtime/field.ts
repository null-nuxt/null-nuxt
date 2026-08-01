import { reactive } from 'vue'
import type { FieldOption } from './types'

/**
 * What a field is declared with. Structure only — anything that depends on the
 * form's state is a rule, because at declaration time there is no state yet.
 */
export interface FieldInput<TValue> {
  label: string
  value: TValue
  placeholder?: string
  mask?: string
  options?: ReadonlyArray<FieldOption<TValue>>
}

/**
 * The behaviour a rule attaches to a field. Written by `addRule`/`addRules`
 * onto the field itself, which is what keeps registration from needing an
 * ambient "current form" — the field IS the target.
 */
export interface FieldRule<TValue, TValues> {
  canShow?: () => boolean
  clearWhenHidden?: boolean
  /**
   * The derived list, which wins over the one declared on the field.
   *
   * Named apart from the declaration's `options` because the shapes differ —
   * there an array, here a function returning one. The same name on both would
   * invite writing `options: [{ label, value }]` in a rule and finding out from
   * a type error.
   */
  deriveOptions?: () => ReadonlyArray<FieldOption<TValue>>
  onChange?: (value: TValue, ctx: { patch: (values: Partial<TValues>) => void }) => void | Promise<void>
}

/**
 * A live field: reactive `value` plus the declaration, plus the slots the
 * registration functions write into.
 *
 * `key` is filled at assembly, not here: a field doesn't know its own name
 * until it is put into a form, and `refField()` has to work for a field declared
 * on its own to be reused across domains.
 */
export interface FieldObj<TValue, TValues = Record<string, unknown>, TDeclared = FieldInput<TValue>> {
  /**
   * The declaration AS WRITTEN, kept only as a type. `register()` reads it to
   * know whether this field declares `options`, `placeholder` or `mask` at all
   * — the interface below has them optional, so it cannot answer that.
   */
  readonly __declared?: TDeclared
  label: string
  value: TValue
  key: string
  placeholder?: string
  mask?: string
  /** The static list from the declaration; a rule's list wins over it. */
  declaredOptions?: ReadonlyArray<FieldOption<TValue>>
  /** Written by `addRule`. Read by the engine. */
  rule?: FieldRule<TValue, TValues>
  /** Written by `addSchema`. A getter when the validator depends on state. */
  schema?: unknown
  /** The option matching the current value, from the effective list. */
  readonly selected: FieldOption<TValue> | undefined
  /** Marks the object as a field so the engine can tell it from anything else. */
  readonly __isFormField: true
}

/**
 * The shape handed to `reactive()`. Named rather than inlined so `this` inside
 * the getter has a type — in an inline literal it widens to `never`.
 */
interface ReactiveSource<TValue> {
  label: string
  value: TValue
  key: string
  placeholder?: string
  mask?: string
  declaredOptions?: ReadonlyArray<FieldOption<TValue>>
  rule?: FieldRule<TValue, Record<string, unknown>>
  schema?: unknown
  readonly selected: FieldOption<TValue> | undefined
  readonly __isFormField: true
}

/** The reactive object a field actually is, before it knows its name. */
const createField = <TValue>(input: FieldInput<TValue>): FieldObj<TValue> => {
  const { options, ...rest } = input

  const source: ReactiveSource<TValue> = {
    ...rest,
    key: '',
    declaredOptions: options,
    /**
     * Derived, never stored. Storing the label freezes it: change the list and
     * the text goes stale — which is the whole reason the field keeps only the
     * value.
     *
     * `this` is the reactive proxy when read through it, so the reads inside
     * are tracked.
     */
    get selected(): FieldOption<TValue> | undefined {
      const list = this.rule?.deriveOptions ? this.rule.deriveOptions() : this.declaredOptions
      return list?.find(option => option.value === this.value)
    },
    __isFormField: true,
  }

  return reactive(source) as FieldObj<TValue>
}

/**
 * One field, on its own. Use it for a field worth reusing across domains — a
 * CPF with its mask and its list — and hand it to `refFields()` alongside the
 * plain declarations.
 *
 * `ref` rather than `use`: this creates reactive state, the way `ref()` does,
 * which is exactly why calling it at module scope is suspect. `use` would say
 * "composable", which it isn't — and vee-validate already owns `useField`.
 *
 * The parameter is `TInput & { value: TValue }` rather than plain `TInput` so
 * `TValue` gets its own inference site. Inferred from the constraint alone it
 * would collect a candidate from the options too and widen, silently dropping
 * the guarantee that an option's value matches the field's.
 */
export const refField = <TValue, TInput extends FieldInput<TValue> = FieldInput<TValue>>(
  input: TInput & { value: TValue },
): FieldObj<TInput['value'], Record<string, unknown>, TInput> =>
  createField(input) as FieldObj<TInput['value'], Record<string, unknown>, TInput>

/** A field object, or the declaration to build one from. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FieldSource = FieldObj<any> | FieldInput<any>

export type FieldsInput = Record<string, FieldSource>

/** The value a source carries, whether it arrived built or as a declaration. */
export type ValueOfSource<T> = T extends FieldObj<infer V> ? V : T extends FieldInput<infer V> ? V : never

/** What the source declared, so the extras stay answerable after assembly. */
export type DeclaredOfSource<T> = T extends FieldObj<infer _V, infer _Vs, infer D> ? D : T

/**
 * Each entry checked against ITSELF: an option's value has to match the value
 * its own field holds.
 *
 * `FieldsInput` can't express this. Entries have different value types from one
 * another, so the record is keyed with `any`, and `any` is what switched the
 * check off — a field holding a string accepted options holding numbers. The
 * select would then render choices that can never match, `selected` would never
 * resolve, and a `oneOf` schema would reject everything the user picked.
 *
 * The intersection with the input is the same double defence `OnlyKnownKeys`
 * uses: on a mismatch the option's value type collapses to `never`, and the
 * error lands on the offending value rather than on the whole object.
 *
 * Already-built fields carry `declaredOptions`, not `options`, so they skip the
 * check — it already ran in `refField`.
 */
export type CheckedFields<T> = {
  [K in keyof T]: T[K] extends { value: infer V, options: ReadonlyArray<{ value: infer OV }> }
    ? [OV] extends [V] ? T[K] : { options: ReadonlyArray<FieldOption<V>> }
    : T[K]
}

export type BuiltFields<T extends FieldsInput> = {
  [K in keyof T]: FieldObj<
    ValueOfSource<T[K]>,
    { [K2 in keyof T]: ValueOfSource<T[K2]> },
    DeclaredOfSource<T[K]>
  >
}

/**
 * The form's fields, named. This is where a field learns its own key, so the
 * template never repeats the name next to the field.
 *
 * Accepts a declaration or an already-built `refField()`, so a shared field drops
 * in next to inline ones.
 */
export const refFields = <T extends FieldsInput>(input: T & CheckedFields<T>): BuiltFields<T> => {
  const result: Record<string, unknown> = {}

  for (const [key, source] of Object.entries(input)) {
    const built = isField(source) ? source : createField(source)
    built.key = key
    result[key] = built
  }

  return result as BuiltFields<T>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isField = (value: unknown): value is FieldObj<any> =>
  typeof value === 'object' && value !== null && '__isFormField' in value
