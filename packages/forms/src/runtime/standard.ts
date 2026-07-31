import type { StandardSchemaV1 } from '@standard-schema/spec'

export interface FieldIssue {
  message: string
  path?: ReadonlyArray<PropertyKey>
}

export interface ValidationResult<TValues> {
  valid: boolean
  /** Errors per field, in the order the validator returned them. */
  errors: Record<string, string[]>
  /** The first message per field — what most UIs display. */
  firstErrors: Record<string, string>
  /** Only the validated fields: hidden ones are not included. */
  values: Partial<TValues>
}

/**
 * Runs a Standard Schema validator. Works with any library implementing the
 * spec — yup 1.7+, Zod, Valibot, ArkType — because the only thing we touch is
 * `~standard.validate`.
 */
export const runStandard = async (
  schema: StandardSchemaV1,
  value: unknown,
): Promise<{ ok: true, value: unknown } | { ok: false, issues: readonly FieldIssue[] }> => {
  const result = await schema['~standard'].validate(value)

  if (result.issues) {
    return { ok: false, issues: result.issues as readonly FieldIssue[] }
  }

  return { ok: true, value: result.value }
}
