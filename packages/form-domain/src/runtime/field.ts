import type { FieldDef } from './types'

/**
 * Helps value inference. Use the explicit generic when the type is wider than
 * the initial value: `field<PersonType | ''>({ label: '...', value: '' })`.
 */
export const field = <TValue>(definition: FieldDef<TValue>): FieldDef<TValue> => definition
