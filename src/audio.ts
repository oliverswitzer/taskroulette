// Audio engine for TaskRoulette
//
// iOS routing: audioCtx.destination → RINGER channel (silenced by mute switch).
// We route through MediaStreamAudioDestinationNode → <audio> to use the MEDIA
// channel instead (respects volume buttons, NOT silent switch).
//
// KEY INVARIANT: audioEl is started once and NEVER paused.
// Pausing <audio srcObject=MediaStream> causes the browser to buffer the last
// ~200ms of rendered audio internally. On the next play(), that buffer replays
// before the new sound — producing ghost tick echoes and partial clip repeats.
// AudioContext suspend() alone silences the stream; the audioEl reads zeros.

import { logAudioEvent, liveState } from './audioDebug'

let audioCtx: AudioContext | null = null
let mediaStreamDest: MediaStreamAudioDestinationNode | null = null
let audioEl: HTMLAudioElement | null = null
let lastTickTime = 0
const MIN_TICK_INTERVAL_MS = 18
const _decodedBuffers: Map<string, AudioBuffer> = new Map()

// Shared suspend timer — last sound always wins, prevents older sound's timer
// from cutting off a newer sound mid-play.
let _suspendTimer: ReturnType<typeof setTimeout> | null = null

function _scheduleSuspend(delayMs: number): void {
  if (_suspendTimer !== null) clearTimeout(_suspendTimer)
  _suspendTimer = setTimeout(() => {
    _suspendTimer = null
    logAudioEvent(`_scheduleSuspend fired (${delayMs}ms)`)
    audioCtx?.suspend().catch(() => {})
    // NOTE: audioEl is NOT paused here — see invariant above
    _syncLiveState()
  }, delayMs)
}

function _syncLiveState(): void {
  liveState.ctxState = audioCtx?.state ?? 'none'
  liveState.audioElPaused = audioEl?.paused ?? true
}

function getDestination(): AudioNode {
  return mediaStreamDest ?? audioCtx!.destination
}

function _init(): void {
  if (audioCtx) return
  audioCtx = new AudioContext()
  logAudioEvent(`_init: ctx created, sampleRate=${audioCtx.sampleRate}`)

  try {
    mediaStreamDest = audioCtx.createMediaStreamDestination()
    audioEl = new Audio()
    audioEl.srcObject = mediaStreamDest.stream
    // Play once, never pause — browser buffers on pause and replays on next play()
    audioEl.play()
      .then(() => {
        logAudioEvent('audioEl.play() resolved')
        _syncLiveState()
      })
      .catch(e => logAudioEvent(`audioEl.play() rejected: ${e}`))
  } catch (e) {
    logAudioEvent(`MediaStreamDest failed (${e}), falling back to ctx.destination`)
    mediaStreamDest = null
    audioEl = null
  }

  audioCtx.suspend().catch(() => {})
  logAudioEvent('_init: ctx suspended')
  _syncLiveState()
}

async function _getBuffer(url: string, key: string): Promise<AudioBuffer | null> {
  if (_decodedBuffers.has(key)) return _decodedBuffers.get(key)!
  if (!audioCtx) return null
  try {
    logAudioEvent(`fetch: ${key}`)
    const res = await fetch(url)
    const arrayBuf = await res.arrayBuffer()
    const buf = await audioCtx.decodeAudioData(arrayBuf)
    _decodedBuffers.set(key, buf)
    logAudioEvent(`decoded: ${key} (${buf.duration.toFixed(2)}s)`)
    return buf
  } catch (e) {
    logAudioEvent(`error fetching ${key}: ${e}`)
    return null
  }
}

function _playBuffer(buf: AudioBuffer, volume = 1.0): void {
  if (!audioCtx) return
  liveState.activeNodes++
  const src = audioCtx.createBufferSource()
  src.buffer = buf
  const gain = audioCtx.createGain()
  gain.gain.value = volume
  src.connect(gain)
  gain.connect(getDestination())
  src.onended = () => {
    liveState.activeNodes--
    src.disconnect()
    gain.disconnect()
  }
  src.start()
}

// Bootstrap on first gesture — start audioEl playing so it's ready
let _bootstrapped = false
if (typeof document !== 'undefined') {
  const _bootstrap = () => {
    if (_bootstrapped) return
    _bootstrapped = true
    logAudioEvent('first gesture → _init + preload')
    _init()
    _getBuffer('/audio/task-complete.mp3', 'complete').catch(() => {})
    _getBuffer('/audio/wheel-lands.mp3', 'lands').catch(() => {})
    _getBuffer('/audio/crowd-applause.mp3', 'crowd').catch(() => {})
  }
  document.addEventListener('touchstart', _bootstrap, { once: true, passive: true })
  document.addEventListener('click', _bootstrap, { once: true })
}

// ── Public API ────────────────────────────────────────────────────────────────

// Call synchronously inside spin gesture to unlock AudioContext on iOS
export function resumeAudioContext(): void {
  logAudioEvent(`resumeAudioContext (ctx=${audioCtx?.state ?? 'null'})`)
  _init()
  if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {})
  // Re-kick audioEl in case iOS backgrounded it (only works from gesture ctx)
  if (audioEl?.paused) {
    audioEl.play().catch(e => logAudioEvent(`resumeAudioContext: audioEl re-kick failed: ${e}`))
  }
  _syncLiveState()
}

// Call between spins to silence the stream. audioEl is NOT paused.
export function suspendAudioContext(): void {
  logAudioEvent(`suspendAudioContext (ctx=${audioCtx?.state ?? 'null'})`)
  if (_suspendTimer !== null) { clearTimeout(_suspendTimer); _suspendTimer = null }
  audioCtx?.suspend().catch(() => {})
  _syncLiveState()
}

export function playCompletionDing(): void {
  logAudioEvent('playCompletionDing')
  _init()
  audioCtx?.resume().catch(() => {})
  _getBuffer('/audio/task-complete.mp3', 'complete').then(buf => {
    if (buf) { logAudioEvent('playCompletionDing → _playBuffer'); _playBuffer(buf, 1.0) }
    _scheduleSuspend(2500)
  })
  _syncLiveState()
}

export function playWheelLands(): void {
  logAudioEvent('playWheelLands')
  _init()
  audioCtx?.resume().catch(() => {})
  _getBuffer('/audio/wheel-lands.mp3', 'lands').then(buf => {
    if (buf) { logAudioEvent('playWheelLands → _playBuffer'); _playBuffer(buf, 0.85) }
    _scheduleSuspend(2500)
  })
  _syncLiveState()
}

export function playCrowdApplause(): void {
  logAudioEvent('playCrowdApplause')
  _init()
  audioCtx?.resume().catch(() => {})
  _getBuffer('/audio/crowd-applause.mp3', 'crowd').then(buf => {
    if (buf) { logAudioEvent('playCrowdApplause → _playBuffer'); _playBuffer(buf, 1.0) }
    _scheduleSuspend(11000)
  })
  _syncLiveState()
}

// STUBBED for debugging — remove stub to restore tick sounds
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function playTick(_velocity: number): void {
  return
}
