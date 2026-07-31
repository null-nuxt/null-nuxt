import type { Once } from './types'

/**
 * Dedupe scope:
 * - `off`        — always sends
 * - `name`       — once per name, for the whole session
 * - `name-path`  — once per name and page, IGNORING the query string
 * - `name-url`   — once per name and full URL (the query counts)
 */
export type DedupeScope = 'off' | 'name' | 'name-path' | 'name-url'

/**
 * `name-path` exists because a query string should almost never create a new
 * "page" for dedupe purposes — and this module itself writes `?src=` into the
 * URL when propagating attribution. With `name-url`, the same page reached from
 * two campaigns would fire twice.
 */
export const dedupeKeyFor = (
  name: string,
  // `false` means "don't deduplicate", in which case we never get here
  once: Exclude<Once, false>,
  scope: DedupeScope,
  url: string,
  path: string,
): string => {
  const effective: DedupeScope | 'per-page' | 'per-url'
    = once === true ? scope : once

  if (effective === 'per-url' || effective === 'name-url') return `${name}@${url}`
  if (effective === 'per-page' || effective === 'name-path') return `${name}@${path}`
  return name
}
