import { defineNuxtPlugin } from '#imports'
import options from '#tracking-options'
import { useTracking } from './composables/useTracking'
import { resolveEventType } from './events'
import definition from '#tracking-events'
import type { Plugin } from 'nuxt/app'
import type { TrackArgs, TrackDirectiveValue, TrackSlug } from './types'

/**
 * The directive is registered on BOTH sides on purpose. Registered only on the
 * client, SSR of any page using `v-track` blows up in `getSSRProps` — and that
 * only shows up on a direct URL hit, never on SPA navigation, so it slips
 * through easily.
 *
 * On the server it does nothing: `mounted` never runs, and `getSSRProps`
 * returns empty because the directive doesn't alter the HTML.
 */
const plugin: Plugin = defineNuxtPlugin((nuxtApp) => {
  if (!options.directive) return

  const cleanups = new WeakMap<HTMLElement, () => void>()

  nuxtApp.vueApp.directive<HTMLElement, TrackDirectiveValue>(options.directive, {
    getSSRProps: () => ({}),

    mounted(el, { value }) {
      const { track } = useTracking()
      const eventType = resolveEventType(definition, value.name)

      const fire = () => {
        void track(
          value.name,
          ...([{ target: value.target, once: value.once }] as unknown as TrackArgs<TrackSlug>),
        )
      }

      /**
       * A type with `minDwell` (hover) listens for dwell time, not clicks:
       * without the threshold, a mouse crossing the screen would turn into
       * dozens of events.
       */
      if (eventType?.minDwell) {
        let timer: ReturnType<typeof setTimeout> | null = null
        const enter = () => {
          timer = setTimeout(fire, eventType.minDwell)
        }
        const leave = () => {
          if (timer) clearTimeout(timer)
          timer = null
        }

        el.addEventListener('mouseenter', enter)
        el.addEventListener('mouseleave', leave)
        cleanups.set(el, () => {
          leave()
          el.removeEventListener('mouseenter', enter)
          el.removeEventListener('mouseleave', leave)
        })
        return
      }

      el.addEventListener('click', fire)
      cleanups.set(el, () => el.removeEventListener('click', fire))
    },

    unmounted(el) {
      cleanups.get(el)?.()
      cleanups.delete(el)
    },
  })
})

export default plugin
