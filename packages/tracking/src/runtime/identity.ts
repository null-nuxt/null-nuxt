import { useCookie } from '#imports'
import type { IdentityProvider } from './types'

export interface CookieIdentityOptions {
  cookieIdName: string
  sourceName: string
  days: number
}

/** Single-domain identity: two cookies of its own. */
export const cookieIdentity = (options: CookieIdentityOptions): IdentityProvider => {
  const expires = new Date(Date.now() + options.days * 86_400_000)
  const id = useCookie(options.cookieIdName, { expires, sameSite: 'lax' })
  const source = useCookie(options.sourceName, { expires, sameSite: 'lax' })

  return {
    cookieId() {
      if (!id.value) id.value = crypto.randomUUID()
      return id.value
    },
    getSource: () => source.value ?? null,
    setSource(value) {
      source.value = value
    },
  }
}

export interface IframeIdentityOptions {
  origin: string
  selector: string
  timeout: number
}

/**
 * Identity shared across domains: an iframe on a common host holds the cookie
 * and answers over postMessage.
 *
 * Two fixes over the original implementation this was extracted from: the ping
 * has a timeout (previously, an iframe that never answered left a setInterval
 * running forever and the promise hanging), and responses are matched to the
 * requested `type` (previously, two concurrent requests could swap answers).
 */
export const iframeIdentity = (options: IframeIdentityOptions): IdentityProvider => {
  const ask = (type: string, data: unknown = null) =>
    new Promise<string | null>((resolve) => {
      const iframe = document.querySelector<HTMLIFrameElement>(options.selector)
      if (!iframe?.contentWindow) return resolve(null)

      let settled = false
      const finish = (value: string | null) => {
        if (settled) return
        settled = true
        clearInterval(ping)
        clearTimeout(bail)
        window.removeEventListener('message', onMessage)
        resolve(value)
      }

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== options.origin) return
        const payload = event.data
        if (payload && typeof payload === 'object' && 'type' in payload && payload.type !== type) return
        finish(payload?.data ?? null)
      }

      window.addEventListener('message', onMessage)
      const ping = setInterval(
        () => iframe.contentWindow?.postMessage({ type, data }, options.origin),
        100,
      )
      const bail = setTimeout(() => finish(null), options.timeout)
    })

  return {
    /** An unavailable iframe can't zero out tracking: fall back to a local id. */
    cookieId: async () => (await ask('GET_COOKIE_ID')) ?? crypto.randomUUID(),
    getSource: () => ask('GET_SOURCE'),
    setSource: async (value) => {
      await ask('SET_SOURCE', value)
    },
  }
}
