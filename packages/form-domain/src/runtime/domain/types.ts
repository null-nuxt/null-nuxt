import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { ComputedRef } from 'vue'
import type { ValidationResult } from '../standard'
import type { FieldsDef, FormData, FormValues, OnlyKnownKeys } from '../types'

/** Flattens an intersection so hovers and errors show one object, not a chain. */
type Prettify<T> = { [K in keyof T]: T[K] } & {}

/**
 * The rule declared for `K`, or `object` when there is none.
 *
 * `object` rather than `never` on purpose: `never` is assignable to everything
 * and `keyof never` is every key, so both of the obvious fallbacks would make
 * every `'x' extends keyof RuleFor<...>` check silently pass. `keyof object` is
 * `never`, which answers "declares nothing" correctly.
 */
type RuleFor<R, K extends PropertyKey> = K extends keyof R ? NonNullable<R[K]> : object

/** Context available already in `withFacts`: only what came from `fields`. */
export interface FieldsContext<F extends FieldsDef> {
  values: FormValues<F>
  data: FormData<F>
}

/** The full context: what rules, schema, outcome and payload consume. */
export interface DomainContext<F extends FieldsDef, C> extends FieldsContext<F> {
  facts: C
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
 * The `outcome` context. It has `selected` because a cart line needs the
 * friendly text, not the code.
 *
 * `options` deliberately does NOT receive this context: if it could read
 * `selected`, an options rule depending on the selected option would recurse.
 * Separate contexts make that cycle impossible by construction.
 */
export interface OutcomeContext<F extends FieldsDef, C> extends DomainContext<F, C> {
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
  /** Returns `T`, not the erased shape, so the declared validator types survive. */
  shape: <T>(fields: T & DomainSchemaShape<F> & OnlyKnownKeys<T, keyof F & string>) => T
}

export type DomainSchema<F extends FieldsDef, C> =
  | DomainSchemaShape<F>
  | ((ctx: SchemaContext<F, C>) => DomainSchemaShape<F>)

export type DomainOutcome<F extends FieldsDef, C, M> =
  | M
  | ((ctx: OutcomeContext<F, C>) => M)

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

/**
 * Which extras this field can produce AT ALL. A key nobody declared is absent
 * from the bindings rather than optional — that's the difference between
 * `register('username').options` being `undefined` and being a compile error on
 * a field that has no options.
 *
 * `options` has two sources: the static list in `fields` and the derived one in
 * `rules`, which is why the rules type has to travel this far.
 */
type DeclaredExtras<F extends FieldsDef, R, K extends keyof F> =
  | ('options' extends keyof F[K] ? 'options' : never)
  | ('options' extends keyof RuleFor<R, K> ? 'options' : never)
  | ('placeholder' extends keyof F[K] ? 'placeholder' : never)
  | ('mask' extends keyof F[K] ? 'mask' : never)

/** What an input component receives from `register(key)`. */
export type FieldBindings<F extends FieldsDef, R, K extends keyof F & string> = Prettify<
  {
    name: K
    label: string
    modelValue: F[K]['value']
    /**
     * The parameter is widened with `| undefined` deliberately. A component
     * declaring `defineModel<string>()` emits `string | undefined`, and under
     * `strictFunctionTypes` a handler taking only `string` is NOT assignable to
     * that — `v-bind="register('x')"` would fail to compile on the single most
     * common way to write an input.
     *
     * The widening costs nothing in the other direction: a component that emits
     * a non-optional value still accepts a handler that tolerates `undefined`.
     */
    'onUpdate:modelValue': (value: F[K]['value'] | undefined) => void
  }
  & Pick<FieldExtras<F[K]['value']>, DeclaredExtras<F, R, K>>
>

/**
 * The keys the runtime may drop from `shape`, which is exactly the fields a
 * `canShow` rule can hide.
 */
type HidableKeys<S, R> = { [K in keyof S]: 'canShow' extends keyof RuleFor<R, K> ? K : never }[keyof S]

/**
 * `shape` keeps the validator types the project declared instead of collapsing
 * them to `StandardSchemaV1`. That is what lets the result be composed —
 * `object(form.shape)`, `z.object(form.shape)` — since those functions require
 * their own library's schema type, which the erased version no longer was.
 *
 * Only the hidable keys become optional. Marking all of them optional would
 * defeat the point: yup and zod both reject a `Schema | undefined` value, so a
 * fully `Partial` shape stops composing.
 */
export type ResolvedShape<S, R> = Prettify<
  Omit<S, HidableKeys<S, R>> & Partial<Pick<S, HidableKeys<S, R>>>
>

/**
 * Derived state is exposed as `ComputedRef` rather than a getter, because
 * `const { canShow } = useForm()` is the idiomatic usage — and destructuring a
 * getter copies the value once and silently kills reactivity. With a ref,
 * forgetting `.value` is a type error instead of a frozen screen.
 */
export interface FormDomainInstance<
  F extends FieldsDef,
  C,
  M,
  Id extends string = string,
  S = object,
  R = object,
> {
  /** The literal is preserved: it's what lets `useFormDomain('slug')` type its return. */
  id: Id
  /** Reactive object: this is where `v-model` writes. */
  data: FormData<F>
  values: ComputedRef<FormValues<F>>
  /** The domain's conclusions, shared by rules, schema, outcome and payload. */
  facts: ComputedRef<C>
  canShow: ComputedRef<{ [K in keyof F]: boolean }>
  /** Effective options: the ones from `rules` beat the ones declared in `fields`. */
  options: ComputedRef<{ [K in keyof F]: ReadonlyArray<FieldOption<F[K]['value']>> }>
  /** The selected option per field — where the friendly text comes from. */
  selected: ComputedRef<SelectedOptions<F>>
  /**
   * Validators for the VISIBLE fields, with the types the project declared.
   * Handed over like this so it can be composed into whatever the project's
   * library expects: `object(form.shape)`, `z.object(form.shape)`...
   */
  shape: ComputedRef<ResolvedShape<S, R>>
  /**
   * The same validators, already handed to the project's own combinator and
   * already reactive: `form.composeSchema(object)`, `form.composeSchema(z.object)`.
   *
   * It exists because the reactive part is the easy part to get wrong.
   * Composing by hand outside a `computed` freezes the schema at its first
   * value, so a field that `canShow` hides later stays required — a bug that
   * only shows up on the branch of the form that hides something, which is the
   * branch nobody tests first.
   *
   * Call it once in `setup`, like any other composable: each call builds its
   * own `computed`.
   */
  composeSchema: <T>(combine: (shape: ResolvedShape<S, R>) => T) => ComputedRef<T>
  /** Validates only what's visible. Hidden fields aren't required. */
  validate: () => Promise<ValidationResult<FormValues<F>>>
  outcome: ComputedRef<M>
  set: (patch: Partial<FormValues<F>>) => void
  reset: () => void
  dispose: () => void
  /** Ready-made input props: `<Input v-bind="form.register('email')" />`. */
  register: <K extends keyof F & string>(key: K) => FieldBindings<F, R, K>
}

/**
 * The builder exists for a technical reason, not an aesthetic one: in a single
 * object literal TypeScript infers everything at once, and `rules` could not see
 * the inferred type of `facts`. Each `.withX()` returns a new type carrying
 * what has accumulated so far.
 */
export interface FormDomainBuilder<
  F extends FieldsDef,
  C,
  M,
  Id extends string = string,
  S = object,
  R = object,
> {
  withFields: <F2 extends FieldsDef>(fields: F2) => FormDomainBuilder<F2, C, M, Id, S, R>

  /**
   * The shared conclusions the rest of the domain reads. Named `facts` rather
   * than `computed` because Vue's `computed` is auto-imported in every SFC, so
   * `ctx.computed` made the reader stop to work out which of the two it was.
   * `facts` also pairs with `rules` — the vocabulary this layer already speaks.
   */
  withFacts: <C2 extends object>(
    derive: (ctx: FieldsContext<F>) => C2,
  ) => FormDomainBuilder<F, C2, M, Id, S, R>

  /**
   * `R2` is carried forward, not discarded: `register()` needs to know whether a
   * field has derived options, and `shape` needs to know which fields a
   * `canShow` can hide.
   */
  withRules: <R2>(
    rules: R2 & DomainRules<F, C> & OnlyKnownKeys<R2, keyof F & string>,
  ) => FormDomainBuilder<F, C, M, Id, S, R2>

  /**
   * The same double defence as `rules`, for the same reason: with a union target
   * TypeScript's excess property check doesn't fire, so `OnlyKnownKeys` marks
   * the unknown key as `never`. That's what prevents declaring validation for a
   * field that doesn't exist.
   *
   * Both forms capture the declared validator types so `shape` can hand them
   * back intact instead of as bare `StandardSchemaV1`.
   */
  withSchema: {
    <S2>(
      shape: S2 & DomainSchemaShape<NoInfer<F>> & OnlyKnownKeys<S2, keyof F & string>,
    ): FormDomainBuilder<F, C, M, Id, S2, R>
    <S2 extends DomainSchemaShape<F>>(
      build: (ctx: SchemaContext<F, C>) => S2,
    ): FormDomainBuilder<F, C, M, Id, S2, R>
  }

  withOutcome: <M2 extends object>(
    outcome: DomainOutcome<F, C, M2>,
  ) => FormDomainBuilder<F, C, M2, Id, S, R>

  /**
   * Ends the type accumulation and returns the domain's composable, registered
   * by slug: every caller receives the SAME instance. This is the path for
   * domains under `<srcDir>/forms`.
   */
  build: () => () => FormDomainInstance<F, C, M, Id, S, R>

  /**
   * A LOCAL instance, created on the spot — for a simple form declared inside
   * the component itself. It isn't registered in the catalog and isn't shared,
   * so a definition capturing `props` works: each component gets its own.
   *
   * Watchers are bound to the caller's scope and die with it.
   */
  use: () => FormDomainInstance<F, C, M, Id, S, R>
}

/**
 * These extract the context and the rules from a builder that already has
 * `fields` and `facts`. They exist to solve the friction of splitting into
 * files: `rules.ts` imports the TYPE of the partial domain instead of trying to
 * reconstruct it, which would cause a circular import.
 */
export type ContextOf<B> = B extends FormDomainBuilder<infer F, infer C, infer _M, infer _Id, infer _S, infer _R>
  ? DomainContext<F, C>
  : never

export type RulesOf<B> = B extends FormDomainBuilder<infer F, infer C, infer _M, infer _Id, infer _S, infer _R>
  ? DomainRules<F, C>
  : never

/**
 * The FUNCTION form only: it's the one used in a separate file, and a union type
 * would stop `withSchema`'s overloads from picking the right signature. The
 * unknown-key check happens here, at the declaration.
 */
export type SchemaOf<B> = B extends FormDomainBuilder<infer F, infer C, infer _M, infer _Id, infer _S, infer _R>
  ? (ctx: SchemaContext<F, C>) => DomainSchemaShape<F>
  : never

export type OutcomeOf<B, M extends object> = B extends FormDomainBuilder<infer F, infer C, infer _M, infer _Id, infer _S, infer _R>
  ? DomainOutcome<F, C, M>
  : never
