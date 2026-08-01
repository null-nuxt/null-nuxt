import type { FieldDef } from './types'

/**
 * Helps value inference. Use the explicit generic when the type is wider than
 * the initial value: `field<PersonType | ''>({ label: '...', value: '' })`.
 *
 * The return type is the definition AS WRITTEN, not `FieldDef<TValue>`: the
 * declared type has `options`, `placeholder` and `mask` optional, so collapsing
 * to it would lose the one thing `register()` needs to know — whether this
 * field declares them at all. Keeping the literal is what makes
 * `register('username').options` a compile error on a field with no options.
 *
 * No `const` modifier on purpose: it would infer `value: ''` as the literal
 * `''` instead of `string`, and assigning to the field would stop compiling.
 *
 * Passing the value type explicitly falls back to the declared shape, since
 * TypeScript stops inferring once a type argument is given. Widen through the
 * value itself — `field({ label: '...', value: '' as PersonType | '' })` — to
 * keep both the wider type and the precise bindings.
 *
 * The parameter is `TDef & { value: TValue }` rather than plain `TDef`: it
 * gives `TValue` its own inference site. Left to be inferred from `TDef`'s
 * constraint alone, `TValue` collects a candidate from the options too and
 * widens to `string | number`, which silently drops the guarantee that an
 * option's value matches the field's.
 */
export const field = <TValue, TDef extends FieldDef<TValue> = FieldDef<TValue>>(
  definition: TDef & { value: TValue },
): TDef => definition
