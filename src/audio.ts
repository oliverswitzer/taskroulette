// Mechanical peg-click tick — tuned for a real prize wheel ratchet feel
// Combines a sharp transient (attack) with a short resonant body
//
// iOS routing note: Web Audio's audioCtx.destination routes to the RINGER channel,
// which is silenced by the mute switch and ringer volume. To route through the
// MEDIA channel (volume-button controlled, not affected by mute switch), we pipe
// through MediaStreamAudioDestinationNode → <audio> element. This is the only
// reliable way to get Web Audio output on iOS Safari + Chrome iOS.

let audioCtx: AudioContext | null = null
let mediaStreamDest: MediaStreamAudioDestinationNode | null = null
let audioEl: HTMLAudioElement | null = null
let audioElReady = false   // true once audioEl.play() has resolved
let lastTickTime = 0
const MIN_TICK_INTERVAL_MS = 18

// The node to connect synthesis outputs to — either the MediaStream destination
// (iOS media-channel routing) or the default destination (desktop).
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
    // MediaStreamAudioDestinationNode not supported — fall back, mark ready immediately
    mediaStreamDest = null
    audioEl = null
    audioElReady = true
  }
}

// Bootstrap audio on the very first touch anywhere on the page.
// This fires long before the user reaches the spin button, so by the time
// they tap Spin the <audio> element has already resolved play() and is ready.
if (typeof document !== 'undefined') {
  document.addEventListener('touchstart', () => { _init() }, { once: true, passive: true })
  // Also on first click (desktop)
  document.addEventListener('click', () => { _init() }, { once: true })
}

export function initAudioContext(): void {
  _init()
}

// Call this synchronously inside a button click handler (user gesture).
// iOS requires AudioContext.resume() AND audioEl.play() in the same gesture tick.
export function resumeAudioContext(): void {
  _init()
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  // Kick play() again in this gesture tick — iOS may have paused the element
  // after silence. play() is a no-op if already playing, but re-calls in a
  // gesture context if it had been paused/interrupted.
  if (audioEl) {
    audioEl.play()
      .then(() => { audioElReady = true })
      .catch(() => {})
  }
}

export function playTick(velocity: number): void {
  if (!audioCtx) return
  if (!audioElReady) return  // <audio> element not playing yet — skip rather than queue
  // Don't try to resume here — we're in a RAF callback, not a gesture.
  if (audioCtx.state !== 'running') return

  const now = audioCtx.currentTime * 1000
  if (now - lastTickTime < MIN_TICK_INTERVAL_MS) return
  lastTickTime = now

  const t = audioCtx.currentTime
  const dest = getDestination()

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
  clickGain.connect(dest)
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
  bodyGain.connect(dest)
  osc.start(t)
  osc.stop(t + 0.09)
}
