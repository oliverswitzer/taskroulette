// Audio debug bus — imported by AudioDebugOverlay component.
// audio.ts pushes events here; the overlay reads them reactively.

export type AudioEvent = {
  t: number
  label: string
}

const MAX_EVENTS = 60
export const audioEvents: AudioEvent[] = []
let _listeners: Array<() => void> = []

export function logAudioEvent(label: string) {
  audioEvents.push({ t: Math.round(performance.now()), label })
  if (audioEvents.length > MAX_EVENTS) audioEvents.shift()
  _listeners.forEach(fn => fn())
}

export function onAudioEvent(fn: () => void): () => void {
  _listeners.push(fn)
  return () => { _listeners = _listeners.filter(f => f !== fn) }
}

// analyser stub — kept so AudioDebugOverlay import doesn't break
export const analyser: AnalyserNode | null = null

export const liveState = {
  ctxState: 'none' as string,
  audioElReady: true,   // always true — no <audio> element
  audioElPaused: false, // always false — no <audio> element
  tickCount: 0,
  activeNodes: 0,
}
