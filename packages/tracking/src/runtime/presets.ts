import type { PayloadBuilder, TrackContext } from './types'

/**
 * A preset is the body format PLUS the conventions that come with it. Without
 * that, one backend's convention becomes a global default and contaminates
 * every new project that installs the package.
 */
export interface TrackingPreset {
  payload: PayloadBuilder
  defaults: {
    endpoint: string
    queryParams: string[]
    directPrefix: string
    dedupe: 'off' | 'name' | 'name-url'
  }
}

/**
 * A legacy backend receiving `POST /tracking-pages`. Frozen: `name` goes out in
 * the `track` field because that's how the API has always received it.
 */
export const trackingPagesPreset: TrackingPreset = {
  payload: (ctx: TrackContext) => ({
    source: ctx.source,
    target: ctx.target,
    url: ctx.url,
    event: ctx.event,
    track: ctx.name,
    cookieId: ctx.cookieId,
    device: ctx.device,
    metadata: {
      language: ctx.language,
      userAgent: ctx.userAgent,
    },
  }),
  defaults: {
    endpoint: '/tracking-pages',
    queryParams: ['src', 'source'],
    directPrefix: 'acesso-direto-',
    dedupe: 'name',
  },
}

/** Raw context and neutral conventions — the starting point for a new backend. */
export const rawPreset: TrackingPreset = {
  payload: (ctx: TrackContext) => ctx,
  defaults: {
    endpoint: '/events',
    queryParams: ['src'],
    directPrefix: 'direct-',
    dedupe: 'off',
  },
}

export const presets = {
  'tracking-pages': trackingPagesPreset,
  'raw': rawPreset,
} satisfies Record<string, TrackingPreset>

export type PresetName = keyof typeof presets
