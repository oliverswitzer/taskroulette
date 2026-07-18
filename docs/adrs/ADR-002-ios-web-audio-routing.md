# ADR-002 — iOS Web Audio: MediaStream Routing + Session Lifecycle

**Status:** Accepted  
**Date:** 2025-07-18  
**Authors:** Hermes (diagnostic) + Oliver (product)

---

## Context

TaskRoulette plays mechanical peg-click sounds every time the prize wheel passes a slice boundary. The audio synthesis is done with the Web Audio API (bandpass-filtered noise burst + triangle oscillator). On desktop Chromium this worked immediately. On iOS Chrome (and Safari) it did not — users reported silence or faint background clicking when no spin was active.

This ADR documents what was wrong, how it was diagnosed, and the final architecture.

---

## Investigation timeline

### Phase 1 — Silent audio on iOS (wrong channel)

**Symptom:** App loaded over HTTP (`http://clawlivers-mac-mini.tail60e2f.ts.net:5173`). Tapping Spin produced zero audio on iOS. Desktop worked fine.

**First hypothesis:** AudioContext blocked on insecure origin. Fixed by adding Tailscale TLS cert and serving Vite over HTTPS.

**Result:** Still silent.

### Phase 2 — Wrong audio channel (ringer vs media)

**Discovery:** A debug page (`audio-debug.html`) with 6 isolated tests revealed that `AudioContext.state` was `running`, synthesis code executed without errors, but zero sound was produced.

**Root cause:** iOS has two separate audio channels:

| Channel | Controlled by | Examples |
|---|---|---|
| **Ringer** | Mute switch + Settings → Sounds → Ringer volume | System sounds, `audioCtx.destination` |
| **Media** | Volume buttons on side of phone | Music, video, `<audio>`, `<video>` |

`audioCtx.destination` routes to the **ringer channel**. If the phone is on silent or ringer volume is zero, Web Audio produces zero audible output — even though the context is running and nodes are scheduled.

**Fix:** Route all synthesis output through `MediaStreamAudioDestinationNode → <audio>.srcObject`. The `<audio>` element uses the media channel, which is what the volume buttons control.

```
synthesis nodes → MediaStreamAudioDestinationNode → <audio>.srcObject → speaker
```

### Phase 3 — Delayed audio burst on first spin

**Symptom:** After the MediaStream routing fix, the first 4-5 taps of the spin button produced silence. Then all queued ticks fired simultaneously as a burst.

**Root cause:** `audioEl.play()` is async — it returns a Promise that takes 100–500ms to resolve on iOS before the `<audio>` element is actually producing output. Nodes scheduled during that window connect to `mediaStreamDest` successfully, but `mediaStreamDest.stream` has no active consumer yet, so they go nowhere. When `play()` finally resolves, nothing fires retroactively — the scheduled nodes have already expired.

**Fix:** Two-part:
1. Bootstrap audio on the first `touchstart` anywhere on the page (fires when typing tasks, long before the spin button)
2. Gate `playTick()` on an `audioElReady` flag that's only set `true` after `audioEl.play()` resolves

By the time the user navigates through dump → parse → list edit → wheel, `play()` has long since resolved.

### Phase 4 — Background clicking between spins

**Symptom:** After fixes 1-3, audio worked during spins but users reported faint clicking sounds when the wheel was idle.

**Hypothesis A:** Spurious `playTick()` calls from a dep-array bug. The peg-detection `useEffect` had `tickerDeflection` in its dependencies. The effect writes `tickerDeflection` but never reads it — so every bounce re-ran the effect, comparing a stale `lastAngleRef` to the current angle, which looked like a slice crossing and fired a ghost tick.

**Hypothesis B:** The `<audio>` element staying active between spins. iOS keeps a hardware audio pipeline open for any playing `<audio>` element. A suspended AudioContext still produces silence frames on the stream — and on some devices the DAC produces faint buffer-boundary clicks from those silence frames.

**Diagnostic:** A Playwright spec (`audio-diagnostic.spec.ts`) instrumented `AudioBufferSourceNode.prototype.start` to log every tick call with timestamps and AudioContext state. Results:

```
IDLE  (3s) : 0 ticks  ✓
SPIN       : 21 ticks, min interval 41ms ✓
POST-SPIN  : 0 ticks  ✓
```

**Conclusion:** Both hypotheses were true. Fixed both:
- Removed `tickerDeflection` from the peg-detection dep array (it's a write-only dep)
- `suspendAudioContext()` now also calls `audioEl.pause()` + resets `audioElReady = false`

---

## Final architecture

```
User tap (gesture context)
  └─ resumeAudioContext()
       ├─ _init() [if first time]
       │    ├─ new AudioContext() → starts suspended
       │    ├─ createMediaStreamDestination()
       │    └─ new Audio() → srcObject = stream
       ├─ audioCtx.resume()
       └─ audioEl.play() → audioElReady = true (async)

RAF loop (wheel spinning)
  └─ playTick(velocity)
       ├─ guard: audioElReady && ctx.state === 'running'
       ├─ rate limit: MIN_TICK_INTERVAL_MS = 18ms
       ├─ Layer 1: bandpass-filtered noise burst (transient click)
       └─ Layer 2: triangle oscillator (woody resonance)
              both connect to → mediaStreamDest → audioEl → speaker (media channel)

Spin ends
  └─ suspendAudioContext()
       ├─ audioCtx.suspend()
       ├─ audioEl.pause()
       └─ audioElReady = false
```

**Bootstrap listener** (fires once at module load, before any user interaction):

```ts
document.addEventListener('touchstart', () => { _init() }, { once: true, passive: true })
document.addEventListener('click',      () => { _init() }, { once: true })
```

This ensures `audioEl.play()` has ~500ms to resolve before the user can possibly reach the spin button.

---

## Key invariants

| Invariant | Why it matters |
|---|---|
| `resumeAudioContext()` must be called in the same synchronous tick as the user tap | iOS revokes gesture context after microtask boundary |
| `audioEl.play()` must also be in gesture context | iOS requires user gesture to start `<audio>` playback |
| `playTick()` is never called from a gesture context | It runs in a RAF loop — calling `resume()` there silently fails |
| `audioElReady` gates `playTick()` | Prevents node scheduling before the stream has an active consumer |
| `audioEl.pause()` on spin end | Closes iOS hardware audio session; prevents silence-frame DAC artifacts |
| Context starts `suspended` after `_init()` | Prevents the idle stream from emitting frames between spins |

---

## What was removed

These were created during investigation and are no longer needed:

- `public/audio-debug.html` — manual browser test page with 6 isolation tests
- `scripts/audio-capture.ts` — Playwright script attempting WAV capture via AnalyserNode
- `tests/e2e/audio-diagnostic.spec.ts` — automated tick logger (kept for regression only)

The `initAudioContext` export was removed from `audio.ts`. `resumeAudioContext()` calls `_init()` internally — callers no longer need to manage initialization separately.

---

## Alternatives considered

| Approach | Why rejected |
|---|---|
| Use `<audio>` with a `.mp3` file (always-looping silence) | Wasteful, still keeps session alive |
| `navigator.mediaDevices.getUserMedia` mic unlock trick | Requires mic permission, ugly UX |
| Use `webkitAudioContext` fallback | Same channel routing problem on iOS |
| Route to `audioCtx.destination` directly | Ringer channel — silenced by mute switch |
| `AudioContext` with `latencyHint: 'playback'` | Doesn't affect channel routing |

---

## References

- [WebAudio on iOS — ringer vs media channel](https://developer.apple.com/library/archive/qa/qa1888/_index.html)
- [MDN: MediaStreamAudioDestinationNode](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioDestinationNode)
- [WebAudio autoplay policy on iOS](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/)
- Diagnostic spec: `tests/e2e/audio-diagnostic.spec.ts`
- Implementation: `src/audio.ts`
