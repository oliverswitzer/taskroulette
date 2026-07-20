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
// silence the stream; the <audio> element just hears zeros from a suspended
// context and stays quiet.

import { logAudioEvent, setAnalyser, liveState } from './audioDebug'

let audioCtx: AudioContext | null = null
let mediaStreamDest: MediaStreamAudioDestinationNode | null = null
let audioEl: HTMLAudioElement | null = null
let lastTickTime = 0
const MIN_TICK_INTERVAL_MS = 18

// Shared suspend timer — always cancelled + rescheduled by each new sound.
// Prevents an older sound's suspend from killing a newer sound mid-play.
let _suspendTimer: ReturnType<typeof setTimeout> | null = null

function _syncLiveState() {
  liveState.ctxState = audioCtx?.state ?? 'none'
  liveState.audioElPaused = audioEl?.paused ?? true
}

function _scheduleSuspend(delayMs: number): void {
  if (_suspendTimer !== null) clearTimeout(_suspendTimer)
  _suspendTimer = setTimeout(() => {
    _suspendTimer = null
    logAudioEvent(`_scheduleSuspend fired after ${delayMs}ms → ctx.suspend() only`)
    // Suspend context only — never pause audioEl (see invariant at top)
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend().catch(() => {})
    _syncLiveState()
  }, delayMs)
}

function getDestination(): AudioNode {
  if (mediaStreamDest) return mediaStreamDest
  return audioCtx!.destination
}

let _initDone = false
function _init(): void {
  if (_initDone) return
  _initDone = true
  audioCtx = new AudioContext()
  logAudioEvent(`_init: ctx created, sampleRate=${audioCtx.sampleRate}`)

  try {
    mediaStreamDest = audioCtx.createMediaStreamDestination()

    // Tap an AnalyserNode as a silent monitor on the graph
    const analyserNode = audioCtx.createAnalyser()
    analyserNode.fftSize = 1024
    analyserNode.connect(audioCtx.destination) // silent — just for waveform metering
    setAnalyser(analyserNode)

    audioEl = new Audio()
    audioEl.srcObject = mediaStreamDest.stream
    // Play once and NEVER pause — pausing buffers MediaStream audio and
    // replays it on the next play(), producing ghost tick echoes.
    audioEl.play()
      .then(() => {
        logAudioEvent('audioEl.play() resolved — will not pause again')
        _syncLiveState()
      })
      .catch(e => logAudioEvent(`audioEl.play() rejected: ${e}`))
  } catch (e) {
    logAudioEvent(`MediaStreamDest failed: ${e} — fallback to ctx.destination`)
    mediaStreamDest = null
    audioEl = null
  }

  // Start suspended — resume only when spinning
  audioCtx.suspend().catch(() => {})
  logAudioEvent('_init: ctx suspended')
  _syncLiveState()
}

// Prevent duplicate concurrent fetches for the same key
const _pendingFetches: Map<string, Promise<AudioBuffer | null>> = new Map()
const _decodedBuffers: Map<string, AudioBuffer> = new Map()

// Bootstrap on first gesture — guarded so touchstart + click both firing
// on the same tap only runs init + preload once.
let _bootstrapped = false
function _bootstrap() {
  if (_bootstrapped) return
  _bootstrapped = true
  logAudioEvent('bootstrap: _init + preload')
  _init()
  _preloadAllBuffers()
}
if (typeof document !== 'undefined') {
  document.addEventListener('touchstart', _bootstrap, { once: true, passive: true })
  document.addEventListener('click', _bootstrap, { once: true })
}

function _preloadAllBuffers(): void {
  _getBuffer('/audio/task-complete.mp3', 'complete').catch(() => {})
  _getBuffer('/audio/wheel-lands.mp3', 'lands').catch(() => {})
  _getBuffer('/audio/crowd-applause.mp3', 'crowd').catch(() => {})
}

// Call synchronously inside the spin button click handler (user gesture).
// Resumes the suspended context. audioEl.play() only called if iOS backgrounded it.
export function resumeAudioContext(): void {
  logAudioEvent(`resumeAudioContext (ctx=${audioCtx?.state ?? 'null'}, elPaused=${audioEl?.paused})`)
  _init()
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  // Only re-kick audioEl if iOS backgrounded/suspended it
  if (audioEl && audioEl.paused) {
    logAudioEvent('resumeAudioContext: re-kicking audioEl (was paused by iOS)')
    audioEl.play().catch(e => logAudioEvent(`resumeAudioContext: audioEl.play() rejected: ${e}`))
  }
  _syncLiveState()
}

// Call when the spin ends — suspends AudioContext ONLY.
// audioEl is intentionally NOT paused — see invariant at top of file.
export function suspendAudioContext(): void {
  logAudioEvent(`suspendAudioContext called (ctx=${audioCtx?.state ?? 'null'}) — ctx only, audioEl stays playing`)
  if (_suspendTimer !== null) { clearTimeout(_suspendTimer); _suspendTimer = null }
  if (audioCtx && audioCtx.state === 'running') {
    audioCtx.suspend().catch(() => {})
  }
  // NOT pausing audioEl — it just reads silence from the suspended context
  _syncLiveState()
}

async function _getBuffer(url: string, key: string): Promise<AudioBuffer | null> {
  if (_decodedBuffers.has(key)) return _decodedBuffers.get(key)!
  // Deduplicate concurrent fetches for the same key
  if (_pendingFetches.has(key)) return _pendingFetches.get(key)!
  if (!audioCtx) return null

  logAudioEvent(`_getBuffer fetch: ${key}`)
  const promise = (async () => {
    try {
      const res = await fetch(url)
      const arrayBuf = await res.arrayBuffer()
      const buf = await audioCtx!.decodeAudioData(arrayBuf)
      _decodedBuffers.set(key, buf)
      _pendingFetches.delete(key)
      logAudioEvent(`_getBuffer decoded: ${key} (${buf.duration.toFixed(2)}s)`)
      return buf
    } catch (e) {
      _pendingFetches.delete(key)
      logAudioEvent(`_getBuffer error ${key}: ${e}`)
      return null
    }
  })()

  _pendingFetches.set(key, promise)
  return promise
}

function _playBuffer(buf: AudioBuffer, volume = 1.0): void {
  if (!audioCtx) return
  liveState.activeNodes++
  const src = audioCtx.createBufferSource()
  src.buffer = buf
  const gainNode = audioCtx.createGain()
  gainNode.gain.value = volume
  src.connect(gainNode)
  gainNode.connect(getDestination())
  src.onended = () => {
    liveState.activeNodes--
    src.disconnect()
    gainNode.disconnect()
  }
  src.start(audioCtx.currentTime)
}

export function playCompletionDing(): void {
  logAudioEvent('playCompletionDing called')
  _init()
  if (!audioCtx) return
  audioCtx.resume().catch(() => {})
  _getBuffer('/audio/task-complete.mp3', 'complete').then(buf => {
    if (buf) { logAudioEvent('playCompletionDing: _playBuffer'); _playBuffer(buf, 1.0) }
    _scheduleSuspend(2500)
  })
}

export function playWheelLands(): void {
  logAudioEvent('playWheelLands called')
  _init()
  if (!audioCtx) return
  audioCtx.resume().catch(() => {})
  _getBuffer('/audio/wheel-lands.mp3', 'lands').then(buf => {
    if (buf) { logAudioEvent('playWheelLands: _playBuffer'); _playBuffer(buf, 0.85) }
    _scheduleSuspend(2500)
  })
}

export function playCrowdApplause(): void {
  logAudioEvent('playCrowdApplause called')
  _init()
  if (!audioCtx) return
  audioCtx.resume().catch(() => {})
  _getBuffer('/audio/crowd-applause.mp3', 'crowd').then(buf => {
    if (buf) { logAudioEvent('playCrowdApplause: _playBuffer'); _playBuffer(buf, 1.0) }
    _scheduleSuspend(11000)
  })
}

export function playTick(velocity: number): void {
  if (!audioCtx) return
  if (audioCtx.state !== 'running') return

  const now = audioCtx.currentTime * 1000
  if (now - lastTickTime < MIN_TICK_INTERVAL_MS) return
  lastTickTime = now
  liveState.tickCount++

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
