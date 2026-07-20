// Mechanical peg-click tick — tuned for a real prize wheel ratchet feel
// Combines a sharp transient (attack) with a short resonant body
//
// iOS routing: Web Audio's audioCtx.destination routes to the RINGER channel
// (silenced by mute switch). We pipe through MediaStreamAudioDestinationNode →
// <audio> element to use the MEDIA channel instead (volume buttons, not mute).

let audioCtx: AudioContext | null = null
let mediaStreamDest: MediaStreamAudioDestinationNode | null = null
let audioEl: HTMLAudioElement | null = null
let audioElReady = false
let lastTickTime = 0
const MIN_TICK_INTERVAL_MS = 18

function getDestination(): AudioNode {
  if (mediaStreamDest) return mediaStreamDest
  return audioCtx!.destination
}

function _init(): void {
  if (audioCtx) return
  audioCtx = new AudioContext()

  try {
    mediaStreamDest = audioCtx.createMediaStreamDestination()
    audioEl = new Audio()
    audioEl.srcObject = mediaStreamDest.stream
    audioEl.play()
      .then(() => { audioElReady = true })
      .catch(() => {})
  } catch {
    // MediaStreamAudioDestinationNode not supported — fall back to default destination
    mediaStreamDest = null
    audioEl = null
    audioElReady = true
  }

  // Start suspended — only resume when actually spinning. Keeps the MediaStream
  // idle between spins so it doesn't emit buffer-click artifacts at rest.
  audioCtx.suspend().catch(() => {})
}

// Bootstrap on the first touch/click — fires well before the spin button,
// so audioEl.play() has resolved long before the user can tap Spin.
if (typeof document !== 'undefined') {
  document.addEventListener('touchstart', () => { _init() }, { once: true, passive: true })
  document.addEventListener('click', () => { _init() }, { once: true })
}

// Call synchronously inside the spin button click handler (user gesture).
// Resumes the suspended context + re-kicks audioEl.play() if needed.
export function resumeAudioContext(): void {
  _init()
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  if (audioEl) {
    audioEl.play()
      .then(() => { audioElReady = true })
      .catch(() => {})
  }
}

// Call when the spin ends — suspends the context AND pauses the audio element
// so iOS has no active audio session between spins (prevents silence-frame DAC artifacts).
export function suspendAudioContext(): void {
  if (audioCtx && audioCtx.state === 'running') {
    audioCtx.suspend().catch(() => {})
  }
  if (audioEl && !audioEl.paused) {
    audioEl.pause()
    audioElReady = false
  }
}

// Celebratory "ding" — two sine tones an octave apart, xylophone-style.
// Called on task checkbox completion. Resumes the audio context for the
// gesture duration, plays the ding, then suspends again after decay.
export function playCompletionDing(): void {
  _init()
  if (!audioCtx) return

  // Resume inside the user gesture tick so iOS allows playback
  audioCtx.resume().catch(() => {})
  if (audioEl) {
    audioEl.play().then(() => { audioElReady = true }).catch(() => {})
  }

  const t = audioCtx.currentTime
  const dest = getDestination()

  // Two harmonically related tones: root + octave
  const freqs = [880, 1760]
  for (const freq of freqs) {
    const osc = audioCtx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq

    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.28, t + 0.008)  // fast attack
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6) // natural decay

    osc.connect(gain)
    gain.connect(dest)
    osc.start(t)
    osc.stop(t + 0.62)
  }

  // Suspend context after the ding has fully decayed
  setTimeout(() => {
    if (audioCtx && audioCtx.state === 'running') {
      audioCtx.suspend().catch(() => {})
    }
    if (audioEl && !audioEl.paused) {
      audioEl.pause()
      audioElReady = false
    }
  }, 700)
}

export function playTick(velocity: number): void {
  if (!audioCtx || !audioElReady) return
  if (audioCtx.state !== 'running') return

  const now = audioCtx.currentTime * 1000
  if (now - lastTickTime < MIN_TICK_INTERVAL_MS) return
  lastTickTime = now

  const t = audioCtx.currentTime
  const dest = getDestination()

  // Layer 1: Sharp transient click (bandpass-filtered noise burst)
  const clickBufferSize = Math.floor(audioCtx.sampleRate * 0.006)
  const clickBuffer = audioCtx.createBuffer(1, clickBufferSize, audioCtx.sampleRate)
  const clickData = clickBuffer.getChannelData(0)
  for (let i = 0; i < clickBufferSize; i++) {
    clickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (clickBufferSize * 0.15))
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
  clickGain.connect(dest)
  clickSource.start(t)

  // Layer 2: Resonant body (triangle oscillator)
  const osc = audioCtx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(280 + velocity * 1800, t)
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.06)
  const bodyGain = audioCtx.createGain()
  bodyGain.gain.setValueAtTime(0.35, t)
  bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
  osc.connect(bodyGain)
  bodyGain.connect(dest)
  osc.start(t)
  osc.stop(t + 0.09)
}
