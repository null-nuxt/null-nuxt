import { computed, effectScope, getCurrentScope, onScopeDispose, reactive, watch } from 'vue'
import { getFormRegistry } from '../registry'
import { runStandard } from '../standard'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { ValidationResult } from '../standard'
import type { FieldsDef, FormData, FormValues } from '../types'
import type {
  ChangeContext,
  DomainContext,
  DomainMeta,
  DomainRules,
  DomainSchema,
  FieldOption,
  FormDomainBuilder,
  FormDomainInstance,
} from './types'

interface Definition {
  id: string
  fields: FieldsDef
  compute?: (ctx: unknown) => Record<string, unknown>
  rules?: DomainRules<FieldsDef, unknown>
  schema?: DomainSchema<FieldsDef, unknown>
  meta?: DomainMeta<FieldsDef, unknown, Record<string, unknown>>
}

/**
 * Each instance needs its own `data`: the definition is shared. `key` is
 * injected here so the template doesn't repeat the field name.
 */
const cloneFields = (fields: FieldsDef): FieldsDef =>
  Object.fromEntries(
    Object.entries(fields).map(([key, definition]) => [key, { ...definition, key }]),
  )

function createInstance(definition: Definition) {
  /**
   * A detached scope: the watchers belong to the domain, not to whichever
   * component instantiated it first — a form split across sub-components would
   * lose its effects when the first child unmounted.
   */
  const scope = effectScope(true)

  return scope.run(() => {
    const data = reactive(cloneFields(definition.fields)) as FormData<FieldsDef>

    const values = computed(() => {
      const result: Record<string, unknown> = {}
      for (const key of Object.keys(data)) result[key] = data[key]!.value
      return result as FormValues<FieldsDef>
    })

    /**
     * The domain's `computed`: the business rule exists ONCE and is consumed by
     * rules, schema and meta. It's what avoids the same condition written twice
     * — once as a visibility rule, once in the schema's `.when()`.
     */
    const domainComputed = computed(() =>
      definition.compute ? definition.compute(baseContext) : {},
    )

    const baseContext = {
      get values() {
        return values.value
      },
      get data() {
        return data
      },
    }

    const context: DomainContext<FieldsDef, unknown> = {
      get values() {
        return values.value
      },
      get data() {
        return data
      },
      get computed() {
        return domainComputed.value
      },
    }

    const canShow = computed(() => {
      const result: Record<string, boolean> = {}
      for (const key of Object.keys(definition.fields)) {
        const rule = definition.rules?.[key]
        result[key] = rule?.canShow ? rule.canShow(context) : true
      }
      return result
    })

    const initialValues = Object.fromEntries(
      Object.entries(definition.fields).map(([key, definitionField]) => [key, definitionField.value]),
    )

    /**
     * Automatic clearing of whatever got hidden. `canShow` already stated the
     * condition; repeating it in an `onChange` is exactly the duplication this
     * engine exists to avoid — and it's easy to get the empty-value case wrong,
     * leaving the opposite field dirty.
     */
    watch(canShow, (visible, previous) => {
      for (const key of Object.keys(visible)) {
        if (!definition.rules?.[key]?.clearWhenHidden) continue
        if (visible[key] === false && previous?.[key] !== false) {
          data[key]!.value = initialValues[key]
        }
      }
    })

    const options = computed(() => {
      const result: Record<string, ReadonlyArray<FieldOption<unknown>>> = {}
      for (const key of Object.keys(definition.fields)) {
        const derived = definition.rules?.[key]?.options
        // the rule wins over the static list declared in `fields`
        result[key] = derived ? derived(context) : (definition.fields[key]?.options ?? [])
      }
      return result
    })

    /**
     * Resolves the label from the stored value. Derived, not stored: if the
     * options list changes, the text follows instead of going stale.
     */
    const selected = computed(() => {
      const result: Record<string, FieldOption<unknown> | undefined> = {}
      for (const key of Object.keys(definition.fields)) {
        result[key] = options.value[key]?.find(option => option.value === data[key]!.value)
      }
      return result
    })

    /**
     * Mirrors the option's text into an ordinary field so it can travel in the
     * payload. `immediate` because a restored form already arrives with a value
     * selected and needs its label filled without waiting for the next change.
     */
    watch(selected, (current) => {
      for (const key of Object.keys(definition.fields)) {
        const target = definition.rules?.[key]?.storeLabelIn
        if (!target || !(target in data)) continue
        data[target]!.value = current[key]?.label ?? ''
      }
    }, { immediate: true })

    // `shape` is the identity function at runtime: it exists purely so
    // TypeScript can check the keys, which it won't do on an arrow's return
    const schemaContext = Object.create(context) as Record<string, unknown>
    schemaContext.shape = (fields: unknown) => fields

    const metaContext = Object.create(context) as Record<string, unknown>
    Object.defineProperty(metaContext, 'selected', { get: () => selected.value })

    /**
     * Only the visible fields' validators. A hidden field isn't validated —
     * that's what erases most `.when()` calls: the condition was already stated
     * once, in `canShow`. And filtering a record depends on no library's API,
     * unlike the previous `.omit()`.
     */
    const shape = computed(() => {
      const declared = typeof definition.schema === 'function'
        ? definition.schema(schemaContext as never)
        : definition.schema ?? {}

      const visible: Record<string, StandardSchemaV1> = {}
      for (const [key, validator] of Object.entries(declared)) {
        if (validator && canShow.value[key] !== false) visible[key] = validator as StandardSchemaV1
      }
      return visible
    })

    const validate = async (): Promise<ValidationResult<FormValues<FieldsDef>>> => {
      const errors: Record<string, string[]> = {}
      const firstErrors: Record<string, string> = {}
      const validated: Record<string, unknown> = {}

      await Promise.all(
        Object.entries(shape.value).map(async ([key, validator]) => {
          const result = await runStandard(validator, data[key]!.value)

          if (result.ok) {
            validated[key] = result.value
            return
          }

          const mensagens = result.issues.map(issue => issue.message)
          errors[key] = mensagens
          if (mensagens[0]) firstErrors[key] = mensagens[0]
        }),
      )

      return {
        valid: Object.keys(errors).length === 0,
        errors,
        firstErrors,
        values: validated as Partial<FormValues<FieldsDef>>,
      }
    }

    const meta = computed(() =>
      typeof definition.meta === 'function'
        ? (definition.meta as (ctx: unknown) => Record<string, unknown>)(metaContext)
        : definition.meta ?? {},
    )

    for (const key of Object.keys(definition.rules ?? {})) {
      const onChange = definition.rules?.[key]?.onChange
      if (!onChange) continue

      /** Descarta resposta obsoleta de um `onChange` async. */
      let latest = 0

      watch(
        () => data[key]!.value,
        async (value) => {
          const ticket = ++latest

          /**
           * A context specific to this invocation: `patch` carries the ticket
           * and discards itself if another change happened in between. It
           * inherits the base context's getters, so it stays reactive.
           */
          const changeContext = Object.create(context) as ChangeContext<FieldsDef, unknown>
          changeContext.patch = (values) => {
            if (ticket !== latest) return

            for (const [target, next] of Object.entries(values)) {
              if (target in data) data[target]!.value = next
            }
          }

          await onChange(value, changeContext)
        },
      )
    }

    const set = (patch: Record<string, unknown>) => {
      for (const [key, next] of Object.entries(patch)) {
        if (key in data) data[key]!.value = next
      }
    }

    const reset = () => {
      const fresh = cloneFields(definition.fields)
      for (const key of Object.keys(fresh)) data[key]!.value = fresh[key]!.value
    }

    return {
      id: definition.id,
      data,
      // refs, not getters: destructuring a getter copies the value and kills
      // reactivity — and destructuring is how composables are used in Vue
      values,
      computed: domainComputed,
      canShow,
      options,
      selected,
      shape,
      validate,
      meta,
      set,
      reset,
      dispose: () => scope.stop(),

      register: (key: string) => {
        const fieldData = data[key]!
        const fieldOptions = options.value[key] ?? []

        return {
          name: key,
          label: fieldData.label,
          modelValue: fieldData.value,
          'onUpdate:modelValue': (next: unknown) => {
            fieldData.value = next
          },
          // only what exists: a key the component doesn't declare becomes a DOM attribute
          ...(fieldOptions.length > 0 ? { options: fieldOptions } : {}),
          ...(fieldData.placeholder ? { placeholder: fieldData.placeholder } : {}),
          ...(fieldData.mask ? { mask: fieldData.mask } : {}),
        }
      },
    }
  })
}

/**
 * Factories by slug, registered at `build()` — WITHOUT instantiating anything.
 * That's what lets `useFormDomain('slug')` create only that domain instead of
 * instantiating all of them and then searching. It holds functions, not user
 * data.
 */
const factories = new Map<string, () => unknown>()

export const registeredDomains = () => factories

/**
 * Declares a form domain: fields, derived business rules, behaviour rules,
 * schema and metadata — each in its own layer, all speaking the same language
 * through `computed`.
 */
export function createFormDomain<const Id extends string>(
  id: Id,
): FormDomainBuilder<FieldsDef, unknown, object, Id> {
  const definition = { id, fields: {} } as Definition

  const builder = {
    withFields(fields: FieldsDef) {
      definition.fields = fields
      return builder
    },
    withComputed(compute: (ctx: unknown) => Record<string, unknown>) {
      definition.compute = compute
      return builder
    },
    withRules(rules: DomainRules<FieldsDef, unknown>) {
      definition.rules = rules
      return builder
    },
    withSchema(schema: DomainSchema<FieldsDef, unknown>) {
      definition.schema = schema
      return builder
    },
    withMeta(meta: DomainMeta<FieldsDef, unknown, Record<string, unknown>>) {
      definition.meta = meta
      return builder
    },
    build() {
      const use = () => {
        const registry = getFormRegistry()
        if (!registry.has(definition.id)) {
          registry.set(definition.id, createInstance(definition))
        }
        return registry.get(definition.id) as FormDomainInstance<FieldsDef, unknown, object, Id>
      }

      factories.set(definition.id, use)
      return use
    },

    /**
     * A simple form declared inside the component itself: a local instance, not
     * registered in the catalog and not sharing state. Binds the watchers to the
     * caller's scope, otherwise every mount of the component would leak effects.
     */
    use() {
      const instance = createInstance(definition)
      if (getCurrentScope()) onScopeDispose(() => instance?.dispose())
      return instance
    },
  }

  return builder as unknown as FormDomainBuilder<FieldsDef, unknown, object, Id>
}
