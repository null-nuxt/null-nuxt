import type { JourneyNode, SinkTrigger, TrackingSink, TrackingSnapshot } from './types'

/** Just types the object — saves consumers from importing the type by hand. */
export const defineTrackingSink = (sink: TrackingSink): TrackingSink => sink

const sinks: TrackingSink[] = []

/**
 * Registers a destination. Multiple sinks coexist: you can send the raw event to
 * a legacy backend and the whole journey somewhere else, neither aware of the
 * other.
 */
export const addTrackingSink = (sink: TrackingSink) => {
  sinks.push(sink)
  return () => {
    const index = sinks.indexOf(sink)
    if (index >= 0) sinks.splice(index, 1)
  }
}

export const clearTrackingSinks = () => {
  sinks.length = 0
}

export const hasTrackingSinks = () => sinks.length > 0

const triggersOf = (sink: TrackingSink): SinkTrigger[] => sink.on ?? ['event']

/**
 * A failing sink can neither break the interaction nor silence the others —
 * each one runs in isolation.
 */
export const dispatchToSinks = async (
  trigger: SinkTrigger,
  snapshot: TrackingSnapshot,
  node: JourneyNode | undefined,
  onError: (error: unknown) => void,
) => {
  await Promise.all(
    sinks
      .filter(sink => triggersOf(sink).includes(trigger))
      .map(async (sink) => {
        try {
          await sink.send(snapshot, node)
        }
        catch (error) {
          onError(error)
        }
      }),
  )
}

export const intervalSinks = () => sinks.filter(sink => triggersOf(sink).includes('interval'))
