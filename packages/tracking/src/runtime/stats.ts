import type { JourneyNode, JourneySnapshot } from './types'

/**
 * A node's dwell time. The current node has no closed `dwell` yet, so its time
 * is counted up to now.
 */
export const dwellOf = (node: JourneyNode, snapshot: JourneySnapshot, now: number): number => {
  if (node.dwell !== undefined) return node.dwell
  if (node.id === snapshot.currentId) return Math.max(0, now - node.at)
  return 0
}

export const currentNode = (snapshot: JourneySnapshot): JourneyNode | null =>
  snapshot.nodes.find(node => node.id === snapshot.currentId) ?? null

/** How long the user has been on the current event, in ms. */
export const timeInCurrent = (snapshot: JourneySnapshot, now: number): number => {
  const current = currentNode(snapshot)
  return current ? Math.max(0, now - current.at) : 0
}

/** Where the user spent the most time. */
export const longestNode = (snapshot: JourneySnapshot, now: number): JourneyNode | null => {
  let best: JourneyNode | null = null
  let bestDwell = -1

  for (const node of snapshot.nodes) {
    const dwell = dwellOf(node, snapshot, now)
    if (dwell > bestDwell) {
      best = node
      bestDwell = dwell
    }
  }

  return best
}

/**
 * How many times the event HAPPENED. Not to be confused with how many times it
 * was sent: one project sends once per page, another sends every event — the
 * occurrence count is the same in both.
 */
export const occurrencesOf = (snapshot: JourneySnapshot, slug: string): number =>
  snapshot.nodes.filter(node => node.name === slug).length
