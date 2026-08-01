import type { BuiltFields } from '#forms'

export type PersonType = 'PF' | 'PJ' | ''

/**
 * The field DECLARATION — plain data, not state.
 *
 * That is why it can live at module scope: `refFields()` here would build
 * reactive state shared across requests, and under SSR the second request would
 * drive what the first one filled in. An inert object has nothing to leak, so
 * the failure stops existing rather than being warned about.
 *
 * Construction happens inside the setup, in `index.ts`. The guarantees stay in
 * the constructor: `refFields` still rejects an option whose value doesn't
 * match its field's.
 */
export const declaration = {
  personType: { label: 'Person type', value: '' as PersonType },
  cpf: { label: 'CPF', value: '', mask: 'cpf' },
  cnpj: { label: 'CNPJ', value: '', mask: 'cnpj' },
  region: { label: 'Region', value: '' },
  notes: { label: 'Notes', value: '' },
}

/** What the sections receive, derived from the declaration. */
export type Fields = BuiltFields<typeof declaration>
