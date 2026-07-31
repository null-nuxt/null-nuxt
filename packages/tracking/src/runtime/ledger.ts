import type { TrackingStorage } from './types'

interface LedgerState {
  /** dedupe key → how many times that key was sent */
  keys: Record<string, number>
  /** slug → total SENDS (different from how many times the event occurred) */
  slugs: Record<string, number>
}

const emptyState = (): LedgerState => ({ keys: {}, slugs: {} })

/**
 * The ledger of SENDS. This used to be just a list of seen keys, which answered
 * "did I already send it?" but not "how many times did I send it?" — and both
 * differ from "how many times did the event happen?", which the navigation tree
 * answers.
 */
export function createSendLedger(options: { storage: TrackingStorage }) {
  let state = emptyState()

  const persist = () => {
    try {
      options.storage.write(JSON.stringify(state))
    }
    catch {
      // no persistence; dedupe still applies, but only for this page load
    }
  }

  const restore = () => {
    const raw = options.storage.read()
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as Partial<LedgerState>
      state = {
        keys: parsed.keys ?? {},
        slugs: parsed.slugs ?? {},
      }
    }
    catch {
      state = emptyState()
    }
  }

  return {
    restore,

    /** `false` once that key has been sent — this is the dedupe cut. */
    isNew: (key: string) => (state.keys[key] ?? 0) === 0,

    /**
     * `key` is null when dedupe is off: the send is still COUNTED, it just
     * doesn't produce a cut key. Dedupe decides whether to skip, not whether to
     * count.
     */
    record: (key: string | null, slug: string) => {
      if (key) state.keys[key] = (state.keys[key] ?? 0) + 1
      state.slugs[slug] = (state.slugs[slug] ?? 0) + 1
      persist()
    },

    /** The send failed: undo it, otherwise the next retry is swallowed by dedupe. */
    rollback: (key: string | null, slug: string) => {
      if (key) state.keys[key] = Math.max(0, (state.keys[key] ?? 0) - 1)
      state.slugs[slug] = Math.max(0, (state.slugs[slug] ?? 0) - 1)
      persist()
    },

    sends: (slug: string) => state.slugs[slug] ?? 0,

    total: () => Object.values(state.slugs).reduce((sum, count) => sum + count, 0),

    reset: () => {
      state = emptyState()
      persist()
    },
  }
}

export type SendLedger = ReturnType<typeof createSendLedger>
