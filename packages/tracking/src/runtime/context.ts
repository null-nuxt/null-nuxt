import type { Device } from './types'

/** Inherited from the source projects — kept identical so the `device`
 * column keeps its historical values. */
const MOBILE_UA = /mobile|android|iphone|ipad|ipod|blackberry|opera mini|iemobile|wpdesktop/

export const detectDevice = (userAgent: string): Device =>
  MOBILE_UA.test(userAgent) ? 'mobile' : 'desktop'

/** Reads the first attribution query parameter present (e.g. ['src', 'source']). */
export const readSourceParam = (search: string, names: string[]): string | null => {
  const params = new URLSearchParams(search)
  for (const name of names) {
    const value = params.get(name)
    if (value) return value
  }
  return null
}
