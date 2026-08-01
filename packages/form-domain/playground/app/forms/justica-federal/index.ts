import { base } from './domain'
import { rules } from './rules'
import { schema } from './schema'
import { outcome } from './outcome'

/** Cada contexto num arquivo; aqui só a montagem. */
export default base
  .withRules(rules)
  .withSchema(schema)
  .withOutcome(outcome)
  .build()
