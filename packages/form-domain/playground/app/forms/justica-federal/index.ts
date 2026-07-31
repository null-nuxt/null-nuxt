import { base } from './domain'
import { rules } from './rules'
import { schema } from './schema'
import { meta } from './meta'

/** Cada contexto num arquivo; aqui só a montagem. */
export default base
  .withRules(rules)
  .withSchema(schema)
  .withMeta(meta)
  .build()
