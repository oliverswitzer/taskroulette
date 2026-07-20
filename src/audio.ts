// Mechanical peg-click tick — tuned for a real prize wheel ratchet feel
// Combines a sharp transient (attack) with a short resonant body
//
// iOS routing: Web Audio's audioCtx.destination routes to the RINGER channel
// (silenced by mute switch). We pipe through MediaStreamAudioDestinationNode →
// <audio> element to use the MEDIA channel instead (volume buttons, not mute).
//
// KEY INVARIANT: audioEl is NEVER paused after first play. The browser buffers
// MediaStream audio on pause and replays it on the next play() call — producing
// ghost echoes of tick sounds. AudioContext suspend/resume is sufficient to
// silence the stream; the <audio> element just hears zeros and stays quiet.

let audioCtx: AudioContext | null = null
let mediaStreamDest: MediaStreamAudioDestinationNode | null = null
let audioEl: HTMLAudioElement | null = null
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
    // NOTE: never pause audioEl — see invariant above
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
    // Play once and never pause — browser buffers MediaStream audio on pause
    // and replays it on the next play(), producing ghost echoes.
    audioEl.play().catch(() => {})
  } catch {
    // MediaStreamAudioDestinationNode not supported — fall back to default destination
    mediaStreamDest = null
    audioEl = null
  }

  // Start suspended — only resume when actually spinning.
  audioCtx.suspend().catch(() => {})
}

// Bootstrap on the first touch/click — fires well before the spin button,
// so audioEl.play() has resolved long before the user can tap Spin.
// Also pre-loads all sample buffers so they're decoded and cached before
// any gesture needs them (avoids iOS gesture-context timeout on first play).
function _preloadAllBuffers(): void {
  _getBuffer('/audio/task-complete.mp3', 'complete').catch(() => {})
  _getBuffer('/audio/wheel-lands.mp3', 'lands').catch(() => {})
  _getBuffer('/audio/crowd-applause.mp3', 'crowd').catch(() => {})
}
if (typeof document !== 'undefined') {
  document.addEventListener('touchstart', () => { _init(); _preloadAllBuffers() }, { once: true, passive: true })
  document.addEventListener('click', () => { _init(); _preloadAllBuffers() }, { once: true })
}

// Call synchronously inside the spin button click handler (user gesture).
// Resumes the suspended context + re-kicks audioEl.play() if needed (iOS
// can suspend <audio> when app backgrounds; re-kick in gesture context).
export function resumeAudioContext(): void {
  _init()
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  // Re-kick audioEl in case iOS suspended it during backgrounding
  if (audioEl && audioEl.paused) {
    audioEl.play().catch(() => {})
  }
}

// Call when the spin ends — suspends the AudioContext only.
// audioEl is NOT paused — see invariant at top of file.
export function suspendAudioContext(): void {
  // Cancel any pending auto-suspend from a previous sound
  if (_suspendTimer !== null) { clearTimeout(_suspendTimer); _suspendTimer = null }
  if (audioCtx && audioCtx.state === 'running') {
    audioCtx.suspend().catch(() => {})
  }
}

// Task completion sound — called from the checkbox handler (gesture context).
export function playCompletionDing(): void {
  _init()
  if (!audioCtx) return
  audioCtx.resume().catch(() => {})
  _getBuffer('/audio/task-complete.mp3', 'complete').then(buf => {
    if (buf) _playBuffer(buf, 1.0)
    // 2.5s — clip is 2s, give 500ms headroom; cancels any older suspend timer
    _scheduleSuspend(2500)
  })
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

// Play when wheel lands on a task (called just before TASK_CARD transition).
export function playWheelLands(): void {
  _init()
  if (!audioCtx) return
  audioCtx.resume().catch(() => {})
  _getBuffer('/audio/wheel-lands.mp3', 'lands').then(buf => {
    if (buf) _playBuffer(buf, 0.85)
    // 2.5s — clip is 2s; cancels any older suspend timer
    _scheduleSuspend(2500)
  })
}

// Play crowd applause when all tasks are done (AllDoneScreen mount).
export function playCrowdApplause(): void {
  _init()
  if (!audioCtx) return
  audioCtx.resume().catch(() => {})
  _getBuffer('/audio/crowd-applause.mp3', 'crowd').then(buf => {
    if (buf) _playBuffer(buf, 1.0)
    // 11s — clip is 10s; cancels any older suspend timer
    _scheduleSuspend(11000)
  })
}

export function playTick(velocity: number): void {
  // Gate only on context state — audioElReady removed (was causing ghost echoes
  // via the pause/play cycle; context state is the authoritative gate now)
  if (!audioCtx) return
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
  // Disconnect all tick nodes on end — orphaned nodes accumulate and contribute
  // to the noise floor that gets replayed via the MediaStream buffer.
  clickSource.onended = () => {
    clickSource.disconnect()
    clickFilter.disconnect()
    clickGain.disconnect()
  }
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
  osc.onended = () => {
    osc.disconnect()
    bodyGain.disconnect()
  }
  osc.start(t)
  osc.stop(t + 0.09)
}
