import type { Transport } from './types'

/**
 * `keepalive` is the whole point: a click that navigates kills an in-flight
 * request, and CTA clicks are exactly the ones worth measuring.
 */
export const fetchTransport: Transport = async (url, body) => {
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  })
}

/** Survives unload more reliably than keepalive; falls back to fetch when unavailable. */
export const beaconTransport: Transport = (url, body) => {
  const blob = new Blob([JSON.stringify(body)], { type: 'application/json' })
  if (navigator.sendBeacon?.(url, blob)) return
  return fetchTransport(url, body)
}
