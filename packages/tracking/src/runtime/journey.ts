import type { JourneyNode, JourneySnapshot, TrackingStorage } from './types'

export const memoryStorage = (): TrackingStorage => {
  let value: string | null = null
  return {
    read: () => value,
    write: (next) => {
      value = next
    },
  }
}

export const sessionStorage_ = (key: string): TrackingStorage => ({
  read: () => {
    try {
      return sessionStorage.getItem(key)
    }
    catch {
      return null
    }
  },
  write: (next) => {
    try {
      sessionStorage.setItem(key, next)
    }
    catch {
      // storage full or blocked: carrying on without persisting beats breaking
    }
  },
})

export interface JourneyOptions {
  storage: TrackingStorage
  /** Node cap: a long session can't grow unbounded in storage. */
  maxNodes: number
  now?: () => number
  createId?: () => string
  /** Signals that the tree changed — what lets a UI follow along live. */
  onChange?: () => void
}

export interface VisitInput {
  path: string
  url: string
  /** Browser history position — what makes detecting "went back" possible. */
  position?: number
  name?: string
}

export interface RecordInput {
  type: JourneyNode['type']
  path: string
  url: string
  name?: string
  target?: string
}

/**
 * Builds the navigation tree. Each node points at the previous one; going back
 * in the browser and then taking another path creates a real branch, instead of
 * a linear list pretending the user never backtracked.
 */
export function createJourney(options: JourneyOptions) {
  const now = options.now ?? (() => Date.now())
  const createId = options.createId ?? (() => crypto.randomUUID())

  let nodes: JourneyNode[] = []
  let currentId: string | null = null
  let startedAt = now()

  /**
   * Persisting is best-effort: storage that is full, blocked or custom and
   * throwing must not break the user's navigation. The journey carries on in
   * memory.
   */
  const persist = () => {
    try {
      options.storage.write(JSON.stringify({ startedAt, currentId, nodes } satisfies JourneySnapshot))
    }
    catch {
      // no persistence this session; tracking keeps working
    }
    options.onChange?.()
  }

  const restore = () => {
    const raw = options.storage.read()
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as JourneySnapshot
      if (!Array.isArray(parsed.nodes)) return
      nodes = parsed.nodes
      currentId = parsed.currentId
      startedAt = parsed.startedAt ?? now()
    }
    catch {
      // a corrupted journey must not break tracking: start clean
    }
  }

  const nodeById = (id: string | null) => nodes.find(node => node.id === id) ?? null

  /** Closes the dwell time of the node being left. */
  const closeDwell = (at: number) => {
    const current = nodeById(currentId)
    if (current && current.dwell === undefined) current.dwell = at - current.at
  }

  const trim = () => {
    if (nodes.length <= options.maxNodes) return
    // trim the oldest; anything losing its parent becomes a root so the tree holds
    nodes = nodes.slice(nodes.length - options.maxNodes)
    const alive = new Set(nodes.map(node => node.id))
    for (const node of nodes) {
      if (node.parent && !alive.has(node.parent)) delete node.parent
    }
  }

  const push = (node: JourneyNode) => {
    nodes.push(node)
    trim()
  }

  /**
   * Navigation. If the history position moved back and a node for that path
   * already exists, the user went back: we reuse that node instead of creating
   * another, and the next navigation becomes a branch from it.
   */
  const visit = (input: VisitInput) => {
    const at = now()
    const current = nodeById(currentId)

    if (input.position !== undefined && current?.position !== undefined && input.position < current.position) {
      const revisited = [...nodes].reverse().find(
        node => node.type === 'page_view' && node.path === input.path && node.position === input.position,
      )
      if (revisited) {
        closeDwell(at)
        currentId = revisited.id
        persist()
        return revisited
      }
    }

    closeDwell(at)

    const node: JourneyNode = {
      id: createId(),
      type: 'page_view',
      path: input.path,
      url: input.url,
      at,
      ...(input.name ? { name: input.name } : {}),
      ...(currentId ? { parent: currentId } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
    }

    push(node)
    currentId = node.id
    persist()
    return node
  }

  /** A leaf event (click, business event): hangs off the current node without becoming it. */
  const record = (input: RecordInput) => {
    const node: JourneyNode = {
      id: createId(),
      type: input.type,
      path: input.path,
      url: input.url,
      at: now(),
      ...(input.name ? { name: input.name } : {}),
      ...(input.target ? { target: input.target } : {}),
      ...(currentId ? { parent: currentId } : {}),
    }

    push(node)
    persist()
    return node
  }

  const reset = () => {
    nodes = []
    currentId = null
    startedAt = now()
    persist()
  }

  return {
    restore,
    visit,
    record,
    reset,
    get current() {
      return nodeById(currentId)
    },
    snapshot: (): JourneySnapshot => ({
      startedAt,
      currentId,
      nodes: nodes.map(node => ({ ...node })),
    }),
  }
}

export type Journey = ReturnType<typeof createJourney>
