import { base } from './domain'
import { rules } from './rules'
import { schema } from './schema'
import { outcome } from './outcome'
import { payload } from './payload'

/** Cada contexto num arquivo; aqui só a montagem. */
export default base
  .withRules(rules)
  .withSchema(schema)
  .withOutcome(outcome)
  .withPayload(payload)
  .build()
