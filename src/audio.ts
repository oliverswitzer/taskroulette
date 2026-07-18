// Mechanical peg-click tick — tuned for a real prize wheel ratchet feel
// Combines a sharp transient (attack) with a short resonant body
// Much louder and more physical than a bandpass noise burst alone

let audioCtx: AudioContext | null = null
let lastTickTime = 0
const MIN_TICK_INTERVAL_MS = 18 // rate-limit: prevent simultaneous ticks from hammering

export function initAudioContext(): void {
  if (audioCtx) return
  audioCtx = new AudioContext()
}

export function playTick(velocity: number): void {
  if (!audioCtx) return

  // Resume if suspended (iOS AudioContext starts suspended)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
    return
  }

  // Rate limit — at very high spin speeds avoid audio overload
  const now = audioCtx.currentTime * 1000
  if (now - lastTickTime < MIN_TICK_INTERVAL_MS) return
  lastTickTime = now

  const t = audioCtx.currentTime

  // ── Layer 1: Sharp transient click (short white noise burst) ─────────────
  // This is the "crack" when the peg hits the ticker
  const clickBufferSize = Math.floor(audioCtx.sampleRate * 0.006) // 6ms
  const clickBuffer = audioCtx.createBuffer(1, clickBufferSize, audioCtx.sampleRate)
  const clickData = clickBuffer.getChannelData(0)
  for (let i = 0; i < clickBufferSize; i++) {
    const env = Math.exp(-i / (clickBufferSize * 0.15)) // very fast decay
    clickData[i] = (Math.random() * 2 - 1) * env
  }

  const clickFilter = audioCtx.createBiquadFilter()
  clickFilter.type = 'bandpass'
  // Higher velocity = higher pitch (peg hits harder = brighter sound)
  clickFilter.frequency.value = 1200 + velocity * 12000
  clickFilter.Q.value = 1.2

  const clickGain = audioCtx.createGain()
  clickGain.gain.setValueAtTime(0.9, t) // loud initial hit
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)

  const clickSource = audioCtx.createBufferSource()
  clickSource.buffer = clickBuffer
  clickSource.connect(clickFilter)
  clickFilter.connect(clickGain)
  clickGain.connect(audioCtx.destination)
  clickSource.start(t)

  // ── Layer 2: Resonant body (short tone burst) ────────────────────────────
  // This is the woody/plastic resonance after impact — gives it physicality
  const osc = audioCtx.createOscillator()
  osc.type = 'triangle'
  // Slightly lower than click — the body resonates at a different freq
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
