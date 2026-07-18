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
  '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'
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
