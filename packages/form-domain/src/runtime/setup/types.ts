import type { ComputedRef } from 'vue'
import type { ValidationResult } from '../standard'
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
 * The extras an input may receive. Only the ones the field can actually
 * produce reach the bindings — a key the component doesn't declare would land
 * as a stray DOM attribute.
 */
interface FieldExtras<TValue> {
  options?: ReadonlyArray<FieldOption<TValue>>
  placeholder?: string
  mask?: string
}

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
  & Partial<FieldExtras<F[K]['value']>>
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
