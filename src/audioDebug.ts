// Audio debug bus — imported by AudioDebugOverlay component.
// audio.ts pushes events here; the overlay reads them reactively.

export type AudioEvent = {
  t: number        // performance.now() ms
  label: string
}

// Ring buffer — keep last 60 events
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

// Exposed so AudioDebugOverlay can read analyser + live state
export let analyser: AnalyserNode | null = null
export function setAnalyser(a: AnalyserNode) { analyser = a }

export const liveState = {
  ctxState: 'none' as string,
  audioElReady: false,
  audioElPaused: true,
  tickCount: 0,
  activeNodes: 0,
}
