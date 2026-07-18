// Mechanical peg-click tick — tuned for a real prize wheel ratchet feel
// Combines a sharp transient (attack) with a short resonant body

let audioCtx: AudioContext | null = null
let lastTickTime = 0
const MIN_TICK_INTERVAL_MS = 18

export function initAudioContext(): void {
  if (audioCtx) return
  audioCtx = new AudioContext()
}

// Call this synchronously inside a button click handler (user gesture).
// iOS requires AudioContext.resume() to happen in the same tick as the tap —
// calling it later (e.g. in a RAF loop) silently fails.
export function resumeAudioContext(): void {
  if (!audioCtx) initAudioContext()
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
}

export function playTick(velocity: number): void {
  if (!audioCtx) return
  // Don't try to resume here — we're in a RAF callback, not a gesture.
  // If the context is still suspended, just bail silently.
  if (audioCtx.state !== 'running') return

  const now = audioCtx.currentTime * 1000
  if (now - lastTickTime < MIN_TICK_INTERVAL_MS) return
  lastTickTime = now

  const t = audioCtx.currentTime

  // Layer 1: Sharp transient click
  const clickBufferSize = Math.floor(audioCtx.sampleRate * 0.006)
  const clickBuffer = audioCtx.createBuffer(1, clickBufferSize, audioCtx.sampleRate)
  const clickData = clickBuffer.getChannelData(0)
  for (let i = 0; i < clickBufferSize; i++) {
    const env = Math.exp(-i / (clickBufferSize * 0.15))
    clickData[i] = (Math.random() * 2 - 1) * env
  }
  const clickFilter = audioCtx.createBiquadFilter()
  clickFilter.type = 'bandpass'
  clickFilter.frequency.value = 1200 + velocity * 12000
  clickFilter.Q.value = 1.2
  const clickGain = audioCtx.createGain()
  clickGain.gain.setValueAtTime(0.9, t)
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
  const clickSource = audioCtx.createBufferSource()
  clickSource.buffer = clickBuffer
  clickSource.connect(clickFilter)
  clickFilter.connect(clickGain)
  clickGain.connect(audioCtx.destination)
  clickSource.start(t)

  // Layer 2: Resonant body
  const osc = audioCtx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(280 + velocity * 1800, t)
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.06)
  const bodyGain = audioCtx.createGain()
  bodyGain.gain.setValueAtTime(0.35, t)
  bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
  osc.connect(bodyGain)
  bodyGain.connect(audioCtx.destination)
  osc.start(t)
  osc.stop(t + 0.09)
}
