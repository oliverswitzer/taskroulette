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

// Shared suspend timer — always cancelled + rescheduled by each new sound.
// Prevents an older sound's suspend from killing a newer sound mid-play.
let _suspendTimer: ReturnType<typeof setTimeout> | null = null

function _scheduleSuspend(delayMs: number): void {
  if (_suspendTimer !== null) clearTimeout(_suspendTimer)
  _suspendTimer = setTimeout(() => {
    _suspendTimer = null
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend().catch(() => {})
    if (audioEl && !audioEl.paused) { audioEl.pause(); audioElReady = false }
  }, delayMs)
}

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
  // Cancel any pending auto-suspend from a previous sound
  if (_suspendTimer !== null) { clearTimeout(_suspendTimer); _suspendTimer = null }
  if (audioCtx && audioCtx.state === 'running') {
    audioCtx.suspend().catch(() => {})
  }
  if (audioEl && !audioEl.paused) {
    audioEl.pause()
    audioElReady = false
  }
}

// ── Sample-based sounds (fetched from public/audio/, cached as AudioBuffer) ──
// Files live in public/audio/ — served as static assets by Vite and cached
// by the PWA service worker after first load. No bundle bloat.

const _decodedBuffers: Map<string, AudioBuffer> = new Map()

async function _getBuffer(url: string, key: string): Promise<AudioBuffer | null> {
  if (_decodedBuffers.has(key)) return _decodedBuffers.get(key)!
  if (!audioCtx) return null
  try {
    const res = await fetch(url)
    const arrayBuf = await res.arrayBuffer()
    const buf = await audioCtx.decodeAudioData(arrayBuf)
    _decodedBuffers.set(key, buf)
    return buf
  } catch {
    return null
  }
}

function _playBuffer(buf: AudioBuffer, volume = 1.0): void {
  if (!audioCtx) return
  const src = audioCtx.createBufferSource()
  src.buffer = buf
  const gainNode = audioCtx.createGain()
  gainNode.gain.value = volume
  src.connect(gainNode)
  gainNode.connect(getDestination())
  // Disconnect nodes when playback finishes — prevents orphaned nodes from
  // accumulating in the audio graph and emitting silence-frame artifacts on iOS.
  src.onended = () => {
    src.disconnect()
    gainNode.disconnect()
  }
  src.start(audioCtx.currentTime)
}

// Shared helper for all 3 MP3 sample playback functions.
function _playSample(url: string, key: string, volume: number, suspendMs: number): void {
  _init()
  if (!audioCtx) return
  audioCtx.resume().catch(() => {})
  if (audioEl) audioEl.play().then(() => { audioElReady = true }).catch(() => {})
  _getBuffer(url, key).then(buf => {
    if (buf) _playBuffer(buf, volume)
    _scheduleSuspend(suspendMs)
  })
}

// Task completion sound — called from the checkbox handler (gesture context).
export const playCompletionDing = (): void => _playSample('/audio/task-complete.mp3', 'complete', 1.0, 2500)

// Play when wheel lands on a task (called just before TASK_CARD transition).
export const playWheelLands = (): void => _playSample('/audio/wheel-lands.mp3', 'lands', 0.85, 2500)

// Play crowd applause when all tasks are done (AllDoneScreen mount).
export const playCrowdApplause = (): void => _playSample('/audio/crowd-applause.mp3', 'crowd', 1.0, 11000)

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
