import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { ComputedRef } from 'vue'
import type { ValidationResult } from '../standard'
import type { FieldsDef, FormData, FormValues, OnlyKnownKeys } from '../types'

/** Context available already in `withComputed`: only what came from `fields`. */
export interface FieldsContext<F extends FieldsDef> {
  values: FormValues<F>
  data: FormData<F>
}

/** The full context: what rules, schema and meta consume. */
export interface DomainContext<F extends FieldsDef, C> extends FieldsContext<F> {
  computed: C
}

/**
 * The `onChange` context, with explicit writes.
 *
 * `patch` is a REQUEST, not a direct write: the engine only applies it if that
 * invocation is still the most recent one. That's what keeps a slow autofill
 * from overwriting what the user typed afterwards — and why a rule can't write
 * `data.x.value = y` directly.
 */
export interface ChangeContext<F extends FieldsDef, C> extends DomainContext<F, C> {
  patch: (values: Partial<FormValues<F>>) => void
}

export interface FieldOption<TValue> {
  label: string
  value: TValue
}

/**
 * The business-rule layer. Everything depending on context lives here — `fields`
 * keeps only structure (label, initial value, fixed list), because at
 * `withFields` time the context doesn't exist yet.
 */
export type DomainRules<F extends FieldsDef, C> = {
  [K in keyof F]?: {
    canShow?: (ctx: DomainContext<F, C>) => boolean

    /**
     * Resets to the initial value as soon as `canShow` hides the field. Prevents
     * sending the opposite group's data to the backend without restating, in an
     * `onChange`, the condition `canShow` already declared.
     *
     * Opt-in because it erases data: in a multi-step form, a hidden field
     * usually needs to keep whatever the user typed.
     */
    clearWhenHidden?: boolean

    /**
     * Derived options. Declarative on purpose: being a function of the context,
     * there is no "reset the options" branch that the imperative version would
     * require — and forgetting that reset is a silent bug.
     */
    options?: (ctx: DomainContext<F, C>) => ReadonlyArray<FieldOption<F[K]['value']>>

    /**
     * Copies the selected option's label into ANOTHER field, so it can travel in
     * the payload like any other value.
     *
     * It exists because `data.field.label` is the field's label ("Region") and
     * cannot become the option's text ("First Region") — two different things
     * sharing a name. The destination is an ordinary field declared in `fields`,
     * so it lands in `values`, can be validated and is sent with no special
     * handling.
     */
    storeLabelIn?: Exclude<keyof F & string, K>

    /**
     * A genuine side effect (clearing a field, autofilling from a service).
     * Writes through `ctx.patch()`; the return value is ignored, so a helper
     * that happens to return an object won't change the form by accident.
     */
    onChange?: (
      value: F[K]['value'],
      ctx: ChangeContext<F, C>,
    ) => void | Promise<void>
  }
}

/**
 * The selected option per field, resolved from the value plus the current list.
 * The field still stores only the `value` — storing the whole object would break
 * `v-model` by identity, `oneOf` in the schema and the backend payload, besides
 * freezing a label that may change.
 */
export type SelectedOptions<F extends FieldsDef> = {
  [K in keyof F]: FieldOption<F[K]['value']> | undefined
}

/**
 * The `meta` context. It has `selected` because a cart summary needs the
 * friendly text, not the code.
 *
 * `options` deliberately does NOT receive this context: if it could read
 * `selected`, an options rule depending on the selected option would recurse.
 * Separate contexts make that cycle impossible by construction.
 */
export interface MetaContext<F extends FieldsDef, C> extends DomainContext<F, C> {
  selected: SelectedOptions<F>
}

/**
 * One validator PER FIELD, rather than a pre-composed schema. Three things fall
 * out of that:
 *
 * 1. a key outside `fields` becomes a compile error — you can't validate a
 *    field that doesn't exist;
 * 2. a hidden field is simply skipped, with no need for `.omit()`, which was
 *    the only part tied to a specific schema library;
 * 3. any library implementing Standard Schema works (yup 1.7+, Zod, Valibot,
 *    ArkType) — the engine only touches `~standard.validate`.
 *
 * Cross-field validation is still possible: the validator closes over `ctx`.
 */
export type DomainSchemaShape<F extends FieldsDef> = {
  [K in keyof F]?: StandardSchemaV1
}

/**
 * The schema context. `shape` exists because of a real inference limitation:
 * when the object comes from the RETURN of an arrow function, TypeScript can't
 * check the keys (inference becomes circular). Passing the object as a DIRECT
 * argument to a helper makes the check work again.
 */
export interface SchemaContext<F extends FieldsDef, C> extends DomainContext<F, C> {
  shape: <T>(fields: T & DomainSchemaShape<F> & OnlyKnownKeys<T, keyof F & string>) => DomainSchemaShape<F>
}

export type DomainSchema<F extends FieldsDef, C> =
  | DomainSchemaShape<F>
  | ((ctx: SchemaContext<F, C>) => DomainSchemaShape<F>)

export type DomainMeta<F extends FieldsDef, C, M> =
  | M
  | ((ctx: MetaContext<F, C>) => M)

/**
 * What an input component needs to receive. Optional fields only appear when
 * they exist — `v-bind` of a key the component doesn't declare would land as a
 * DOM attribute.
 */
export interface FieldBindings<TValue> {
  name: string
  label: string
  modelValue: TValue
  'onUpdate:modelValue': (value: TValue) => void
  options?: ReadonlyArray<FieldOption<TValue>>
  placeholder?: string
  mask?: string
}

/**
 * Derived state is exposed as `ComputedRef` rather than a getter, because
 * `const { canShow } = useForm()` is the idiomatic usage — and destructuring a
 * getter copies the value once and silently kills reactivity. With a ref,
 * forgetting `.value` is a type error instead of a frozen screen.
 */
export interface FormDomainInstance<F extends FieldsDef, C, M, Id extends string = string> {
  /** The literal is preserved: it's what lets `useFormDomain('slug')` type its return. */
  id: Id
  /** Reactive object: this is where `v-model` writes. */
  data: FormData<F>
  values: ComputedRef<FormValues<F>>
  /** Derived business rules, shared by rules, schema and meta. */
  computed: ComputedRef<C>
  canShow: ComputedRef<{ [K in keyof F]: boolean }>
  /** Effective options: the ones from `rules` beat the ones declared in `fields`. */
  options: ComputedRef<{ [K in keyof F]: ReadonlyArray<FieldOption<F[K]['value']>> }>
  /** The selected option per field — where the friendly text comes from. */
  selected: ComputedRef<SelectedOptions<F>>
  /**
   * Validators for the VISIBLE fields. Handed over like this so the project can
   * compose whatever its library expects: `object(form.shape)`,
   * `z.object(form.shape)`...
   */
  shape: ComputedRef<Partial<Record<keyof F & string, StandardSchemaV1>>>
  /** Validates only what's visible. Hidden fields aren't required. */
  validate: () => Promise<ValidationResult<FormValues<F>>>
  meta: ComputedRef<M>
  set: (patch: Partial<FormValues<F>>) => void
  reset: () => void
  dispose: () => void
  /** Ready-made input props: `<Input v-bind="form.register('email')" />`. */
  register: <K extends keyof F & string>(key: K) => FieldBindings<F[K]['value']>
}

/**
 * The builder exists for a technical reason, not an aesthetic one: in a single
 * object literal TypeScript infers everything at once, and `rules` could not see
 * the inferred type of `computed`. Each `.withX()` returns a new type carrying
 * what has accumulated so far.
 */
export interface FormDomainBuilder<F extends FieldsDef, C, M, Id extends string = string> {
  withFields: <F2 extends FieldsDef>(fields: F2) => FormDomainBuilder<F2, C, M, Id>

  withComputed: <C2 extends object>(
    compute: (ctx: FieldsContext<F>) => C2,
  ) => FormDomainBuilder<F, C2, M, Id>

  withRules: <R>(
    rules: R & DomainRules<F, C> & OnlyKnownKeys<R, keyof F & string>,
  ) => FormDomainBuilder<F, C, M, Id>

  /**
   * The same double defence as `rules`, for the same reason: with a union target
   * TypeScript's excess property check doesn't fire, so `OnlyKnownKeys` marks
   * the unknown key as `never`. That's what prevents declaring validation for a
   * field that doesn't exist.
   */
  withSchema: {
    <S>(
      shape: S & DomainSchemaShape<NoInfer<F>> & OnlyKnownKeys<S, keyof F & string>,
    ): FormDomainBuilder<F, C, M, Id>
    (
      build: (ctx: SchemaContext<F, C>) => DomainSchemaShape<F>,
    ): FormDomainBuilder<F, C, M, Id>
  }

  withMeta: <M2 extends object>(
    meta: DomainMeta<F, C, M2>,
  ) => FormDomainBuilder<F, C, M2, Id>

  /**
   * Ends the type accumulation and returns the domain's composable, registered
   * by slug: every caller receives the SAME instance. This is the path for
   * domains under `<srcDir>/forms`.
   */
  build: () => () => FormDomainInstance<F, C, M, Id>

  /**
   * A LOCAL instance, created on the spot — for a simple form declared inside
   * the component itself. It isn't registered in the catalog and isn't shared,
   * so a definition capturing `props` works: each component gets its own.
   *
   * Watchers are bound to the caller's scope and die with it.
   */
  use: () => FormDomainInstance<F, C, M, Id>
}

/**
 * These extract the context and the rules from a builder that already has
 * `fields` and `computed`. They exist to solve the friction of splitting into
 * files: `rules.ts` imports the TYPE of the partial domain instead of trying to
 * reconstruct it, which would cause a circular import.
 */
export type ContextOf<B> = B extends FormDomainBuilder<infer F, infer C, infer _M, infer _Id>
  ? DomainContext<F, C>
  : never

export type RulesOf<B> = B extends FormDomainBuilder<infer F, infer C, infer _M, infer _Id>
  ? DomainRules<F, C>
  : never

/**
 * The FUNCTION form only: it's the one used in a separate file, and a union type
 * would stop `withSchema`'s overloads from picking the right signature. The
 * unknown-key check happens here, at the declaration.
 */
export type SchemaOf<B> = B extends FormDomainBuilder<infer F, infer C, infer _M, infer _Id>
  ? (ctx: SchemaContext<F, C>) => DomainSchemaShape<F>
  : never

export type MetaOf<B, M extends object> = B extends FormDomainBuilder<infer F, infer C, infer _M, infer _Id>
  ? DomainMeta<F, C, M>
  : never
