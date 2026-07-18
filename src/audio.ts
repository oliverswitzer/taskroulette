// Mechanical peg-click tick — real prize wheel click samples
//
// Source: sampled from a real prize wheel (3 individual clicks extracted,
// normalized to 0.9 peak, 60ms each at 44100Hz).
//
// iOS routing: audioCtx.destination → ringer channel (mute switch silences it).
// We pipe through MediaStreamAudioDestinationNode → <audio> to use the media
// channel instead. See: docs/adrs/ADR-002-ios-web-audio-routing.md

// Real click samples (base64-encoded WAV, 44100Hz mono 16-bit, ~60ms each)
const CLICK_B64: readonly string[] = [
  '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',
]

// Decode base64 WAV → AudioBuffer once (lazy, cached)
let decodedBuffers: AudioBuffer[] | null = null

async function loadClickBuffers(ctx: AudioContext): Promise<AudioBuffer[]> {
  if (decodedBuffers) return decodedBuffers
  const bufs = await Promise.all(
    CLICK_B64.map(async b64 => {
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return ctx.decodeAudioData(bytes.buffer.slice(0))
    })
  )
  decodedBuffers = bufs
  return bufs
}

// Audio context + iOS routing ─────────────────────────────────────────────────

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
    mediaStreamDest = null
    audioEl = null
    audioElReady = true
  }

  // Start suspended — only resume when spinning.
  // Prevents idle MediaStream silence-frame DAC artifacts on iOS.
  audioCtx.suspend().catch(() => {})

  // Pre-decode click samples while user is still typing tasks
  void loadClickBuffers(audioCtx)
}

// Bootstrap on first touch/click so samples are decoded before first spin
if (typeof document !== 'undefined') {
  document.addEventListener('touchstart', () => { _init() }, { once: true, passive: true })
  document.addEventListener('click', () => { _init() }, { once: true })
}

// Call synchronously inside the spin button click handler (user gesture).
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

// Call when the spin ends — closes the iOS audio session entirely.
export function suspendAudioContext(): void {
  if (audioCtx && audioCtx.state === 'running') {
    audioCtx.suspend().catch(() => {})
  }
  if (audioEl && !audioEl.paused) {
    audioEl.pause()
    audioElReady = false
  }
}

export function playTick(velocity: number): void {
  if (!audioCtx || !audioElReady) return
  if (audioCtx.state !== 'running') return

  const now = audioCtx.currentTime * 1000
  if (now - lastTickTime < MIN_TICK_INTERVAL_MS) return
  lastTickTime = now

  // Fall back to synth if samples not yet decoded (< 200ms window after first touch)
  if (!decodedBuffers) {
    _playSynth(velocity)
    return
  }

  const t = audioCtx.currentTime
  const dest = getDestination()

  // Pick a random sample for natural variety
  const buf = decodedBuffers[Math.floor(Math.random() * decodedBuffers.length)]
  const src = audioCtx.createBufferSource()
  src.buffer = buf

  // Slight pitch variation so consecutive clicks don't sound identical
  src.playbackRate.value = 0.9 + Math.random() * 0.2  // ±10%

  // Volume scales with velocity: quieter as wheel slows to a stop
  const gain = audioCtx.createGain()
  const vol = 0.55 + Math.min(velocity / 0.04, 1) * 0.4  // 0.55–0.95
  gain.gain.setValueAtTime(vol, t)

  src.connect(gain)
  gain.connect(dest)
  src.start(t)
}

// Synth fallback — used only in the brief window before decodeAudioData resolves
function _playSynth(velocity: number): void {
  if (!audioCtx) return
  const t = audioCtx.currentTime
  const dest = getDestination()

  const size = Math.floor(audioCtx.sampleRate * 0.006)
  const buf = audioCtx.createBuffer(1, size, audioCtx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < size; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (size * 0.15))
  }
  const filt = audioCtx.createBiquadFilter()
  filt.type = 'bandpass'
  filt.frequency.value = 1200 + velocity * 12000
  filt.Q.value = 1.2
  const gain = audioCtx.createGain()
  gain.gain.setValueAtTime(0.7, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
  const src = audioCtx.createBufferSource()
  src.buffer = buf
  src.connect(filt)
  filt.connect(gain)
  gain.connect(dest)
  src.start(t)
}
