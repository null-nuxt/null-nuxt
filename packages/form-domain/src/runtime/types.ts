// `#forms` is the package's public entry point
export { field, fields } from './field'
export { addRule, addRules, addSchema, addSchemas } from './register'
export { defineFormDomain, useForm } from './define'

export type {
  BuiltFields,
  FieldInput,
  FieldObj,
  FieldRule,
  FieldsInput,
} from './field'

export type { SchemaSource } from './register'

export type {
  AnyFields,
  FieldBindings,
  FieldOption,
  FormEngine,
  ValuesOf,
} from './form-types'

export type {
  FormDomain,
  FormDomainInstance,
} from './define'
