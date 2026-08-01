import type { ComputedRef } from 'vue'
import type { ValidationResult } from './standard'
import type { BuiltFields, FieldObj, FieldsInput } from './field'

export interface FieldOption<TValue> {
  label: string
  value: TValue
}

/** Any built fields object, for constraints that don't care about the shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFields = Record<string, FieldObj<any, any>>

export type ValuesOf<F extends AnyFields> = { [K in keyof F]: F[K]['value'] }

/**
 * A key outside `Allowed` becomes `never`, which nothing satisfies — that's
 * what makes `addRules(fields, { missing: ... })` fail to compile.
 *
 * The `string extends Allowed` branch guards the failure mode: when the keys
 * aren't known, every key passes and the check silently accepts anything.
 * Silently is the problem, so it becomes an error naming the cause.
 */
export type OnlyKnownKeys<T, Allowed extends string> = string extends Allowed
  ? { __fieldsNotKnownHere: 'the field keys are not known here, so this check would silently accept anything — pass a concrete fields object' }
  : { [K in keyof T]: K extends Allowed ? T[K] : never }

/**
 * The extras an input may receive. All optional: the engine only emits the ones
 * that have a value at runtime, because `v-bind` of a key the component doesn't
 * declare lands as a stray DOM attribute.
 */
interface FieldExtras<TValue> {
  options?: ReadonlyArray<FieldOption<TValue>>
  placeholder?: string
  mask?: string
}

/** What the field was declared with, or the wide shape when it isn't known. */
type DeclaredOf<F extends AnyFields, K extends keyof F> =
  NonNullable<F[K]['__declared']>

/**
 * Which extras this field can produce AT ALL. A key nobody declared is absent
 * from the bindings rather than optional — that's the difference between
 * `register('username').options` being `undefined` and being a compile error.
 *
 * `options` has two sources, the declaration and a rule, and a rule can be
 * attached from anywhere at any time. So a field whose declaration has no list
 * still gets the key IF something could derive one — which, unlike the builder,
 * cannot be settled from the types here. The declaration is what's answerable,
 * and it is what the check uses.
 */
type DeclaredExtras<F extends AnyFields, K extends keyof F> =
  | ('options' extends keyof DeclaredOf<F, K> ? 'options' : never)
  | ('placeholder' extends keyof DeclaredOf<F, K> ? 'placeholder' : never)
  | ('mask' extends keyof DeclaredOf<F, K> ? 'mask' : never)

type Prettify<T> = { [K in keyof T]: T[K] } & {}

/** What an input component receives from `register(key)`. */
export type FieldBindings<F extends AnyFields, K extends keyof F & string> = Prettify<
  {
    name: K
    label: string
    modelValue: F[K]['value']
    /**
     * Widened with `| undefined` deliberately: a component declaring
     * `defineModel<string>()` emits `string | undefined`, and under
     * `strictFunctionTypes` a handler taking only `string` is not assignable
     * to it.
     */
    'onUpdate:modelValue': (value: F[K]['value'] | undefined) => void
  }
  & Pick<FieldExtras<F[K]['value']>, DeclaredExtras<F, K>>
>

/** Everything the engine derives from a fields object. */
export interface FormEngine<F extends AnyFields> {
  fields: F
  values: ComputedRef<ValuesOf<F>>
  /** Only what a rule is currently letting through. */
  visible: ComputedRef<Partial<ValuesOf<F>>>
  canShow: ComputedRef<{ [K in keyof F]: boolean }>
  options: ComputedRef<{ [K in keyof F]: ReadonlyArray<FieldOption<F[K]['value']>> }>
  /** Validators for the visible fields, with the types you declared. */
  shape: ComputedRef<Record<string, unknown>>
  /**
   * The same validators handed to the project's own combinator, already
   * reactive. Composing outside a `computed` freezes the schema at its first
   * value, so a field a rule hides later stays required.
   */
  composeSchema: <T>(combine: (shape: Record<string, never>) => T) => ComputedRef<T>
  validate: () => Promise<ValidationResult<ValuesOf<F>>>
  register: <K extends keyof F & string>(key: K) => FieldBindings<F, K>
  set: (patch: Partial<ValuesOf<F>>) => void
  reset: () => void
  dispose: () => void
}

/** The reserved key the setup uses to hand its fields to the engine. */
export interface SetupResult {
  fields: AnyFields
}

/** Everything the setup returned except the fields, exposed untouched. */
export type Exposed<S> = Omit<S, 'fields'>

export type { BuiltFields, FieldObj, FieldsInput }
