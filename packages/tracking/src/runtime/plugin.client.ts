import { defineNuxtPlugin, useRouter } from '#imports'
import options from '#tracking-options'
import { useTracking } from './composables/useTracking'
import { intervalSinks } from './sink'
import type { Plugin } from 'nuxt/app'
import type { TrackSlug } from './types'

/** Anotado pelo mesmo motivo do module.ts: portabilidade do .d.ts emitido. */
const plugin: Plugin = defineNuxtPlugin((nuxtApp) => {
  const { trackPageView, captureSource, flush } = useTracking()
  const router = useRouter()

  void captureSource()

  /**
   * `pagehide` rather than `unload`: `unload` doesn't fire on Safari/iOS, nor
   * when the tab goes into the bfcache — which is exactly when the user leaves.
   */
  window.addEventListener('pagehide', () => {
    void flush('unload')
  })

  const intervals = intervalSinks()
  if (intervals.length > 0) {
    const period = Math.min(...intervals.map(sink => sink.intervalMs ?? 30_000))
    const timer = setInterval(() => void flush('interval'), period)
    nuxtApp.hook('app:unmounted' as 'app:mounted', () => clearInterval(timer))
  }

  if (options.pageView) {
    /**
     * `page:finish` also fires on initial hydration; remembering the last path
     * avoids a doubled page_view without relying on dedupe being enabled.
     */
    let lastPath: string | null = null
    const trackCurrentPage = () => {
      const route = router.currentRoute.value
      const name = route.meta.track as TrackSlug | undefined
      if (!name || route.fullPath === lastPath) return
      lastPath = route.fullPath
      void trackPageView(name)
    }

    nuxtApp.hook('page:finish', trackCurrentPage)
    trackCurrentPage()
  }
})

export default plugin
