import { computed, watch } from 'vue'
import { runStandard } from '../standard'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { ValidationResult } from '../standard'
import type { AnyFields, FieldOption, FormEngine, ValuesOf } from './types'

/**
 * Everything derived from a fields object, once the rules and validators have
 * been attached to it.
 *
 * The engine reads the fields; it never owns them. That's what lets the same
 * engine serve a form assembled inside a component and one assembled inside a
 * domain's setup.
 */
export function createEngine<F extends AnyFields>(fields: F): FormEngine<F> {
  const keys = Object.keys(fields)

  const values = computed(() => {
    const result: Record<string, unknown> = {}
    for (const key of keys) result[key] = fields[key]!.value
    return result as ValuesOf<F>
  })

  const canShow = computed(() => {
    const result: Record<string, boolean> = {}
    for (const key of keys) {
      const rule = fields[key]!.rule
      result[key] = rule?.canShow ? rule.canShow() : true
    }
    return result as { [K in keyof F]: boolean }
  })

  const visible = computed(() => {
    const result: Record<string, unknown> = {}
    for (const key of keys) {
      if (canShow.value[key] !== false) result[key] = fields[key]!.value
    }
    return result as Partial<ValuesOf<F>>
  })

  const options = computed(() => {
    const result: Record<string, ReadonlyArray<FieldOption<unknown>>> = {}
    for (const key of keys) {
      const target = fields[key]!
      // the rule wins over the list declared on the field
      result[key] = target.rule?.options ? target.rule.options() : (target.declaredOptions ?? [])
    }
    return result as { [K in keyof F]: ReadonlyArray<FieldOption<F[K]['value']>> }
  })

  const initialValues = Object.fromEntries(keys.map(key => [key, fields[key]!.value]))

  /**
   * Clears whatever got hidden. `canShow` already stated the condition;
   * repeating it in an `onChange` is the duplication this engine exists to
   * avoid, and it's easy to get the empty value wrong.
   */
  watch(canShow, (current, previous) => {
    for (const key of keys) {
      if (!fields[key]!.rule?.clearWhenHidden) continue
      if (current[key] === false && previous?.[key] !== false) {
        fields[key]!.value = initialValues[key]
      }
    }
  })

  /**
   * Only the visible fields' validators. A hidden field isn't validated —
   * that's what erases most `.when()` calls, since the condition was already
   * stated once in `canShow`.
   */
  const shape = computed(() => {
    const result: Record<string, StandardSchemaV1> = {}
    for (const key of keys) {
      const declared = fields[key]!.schema
      if (!declared || canShow.value[key] === false) continue
      result[key] = (typeof declared === 'function' ? declared() : declared) as StandardSchemaV1
    }
    return result
  })

  /**
   * Composition stays the project's call — the engine has no idea whether
   * `object` or `z.object` is right — but the reactivity doesn't: wrapping it
   * here keeps a hidden field from staying required in a schema composed once
   * and never again.
   */
  const composeSchema = (combine: (shape: never) => unknown) =>
    computed(() => combine(shape.value as never))

  const validate = async (): Promise<ValidationResult<ValuesOf<F>>> => {
    const errors: Record<string, string[]> = {}
    const firstErrors: Record<string, string> = {}
    const validated: Record<string, unknown> = {}

    await Promise.all(
      Object.entries(shape.value).map(async ([key, validator]) => {
        const result = await runStandard(validator, fields[key]!.value)

        if (result.ok) {
          validated[key] = result.value
          return
        }

        const messages = result.issues.map(issue => issue.message)
        errors[key] = messages
        if (messages[0]) firstErrors[key] = messages[0]
      }),
    )

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      firstErrors,
      values: validated as Partial<ValuesOf<F>>,
    }
  }

  const set = (patch: Partial<ValuesOf<F>>) => {
    for (const [key, next] of Object.entries(patch as Record<string, unknown>)) {
      if (key in fields) fields[key]!.value = next
    }
  }

  for (const key of keys) {
    const onChange = fields[key]!.rule?.onChange
    if (!onChange) continue

    /** Discards a stale response from an async `onChange`. */
    let latest = 0

    watch(
      () => fields[key]!.value,
      async (value) => {
        const ticket = ++latest

        await onChange(value, {
          patch: (patch) => {
            // a request, not a write: a slow autofill must not overwrite what
            // the user typed in the meantime
            if (ticket === latest) set(patch as Partial<ValuesOf<F>>)
          },
        })
      },
    )
  }

  return {
    fields,
    values,
    visible,
    canShow,
    options,
    shape,
    composeSchema,
    validate,
    set,
    reset: () => {
      for (const key of keys) fields[key]!.value = initialValues[key]
    },
    dispose: () => {},
    register: (key: string) => {
      const target = fields[key]!
      const list = options.value[key] ?? []

      return {
        name: key,
        label: target.label,
        modelValue: target.value,
        /**
         * Whatever the component emits is what the field stores, `undefined`
         * included: a component written with `defineModel<string>()` emits the
         * wider type, and the binding has to accept it to be assignable.
         */
        'onUpdate:modelValue': (next: unknown) => {
          target.value = next
        },
        // only what exists: a key the component doesn't declare becomes a DOM attribute
        ...(list.length > 0 ? { options: list } : {}),
        ...(target.placeholder ? { placeholder: target.placeholder } : {}),
        ...(target.mask ? { mask: target.mask } : {}),
      }
    },
  } as FormEngine<F>
}
