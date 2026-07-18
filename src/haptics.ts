/**
 * haptics.ts
 *
 * Wraps ios-vibrator-pro-max for TaskRoulette's 3 haptic touch points:
 *   1. Spin button press  — double-tap "launch" feel
 *   2. Wheel lands        — stutter-then-thud like a real wheel stopping
 *   3. Task complete      — rapid taps + long reward buzz
 *
 * The library works by toggling hidden <input type="checkbox"> elements
 * at high frequency, tricking the iOS Taptic Engine into firing.
 *
 * IMPORTANT: Every call here MUST originate from a click/tap handler
 * (synchronously, not from a RAF loop or setTimeout callback).
 * iOS 18.4+ revokes the gesture grant after ~1 second.
 *
 * On Android / desktop, navigator.vibrate() is used as a fallback.
 * On unsupported platforms the calls are silently no-ops.
 */

// Dynamic import so the library is only loaded when first needed.
// ios-vibrator-pro-max patches navigator.vibrate() on iOS.
let vibrationReady = false

async function ensureInit(): Promise<void> {
  if (vibrationReady) return
  try {
    // The library's default export is an async init function
    const mod = await import('ios-vibrator-pro-max')
    const init = mod.default ?? mod
    if (typeof init === 'function') {
      await init()
    }
    vibrationReady = true
  } catch {
    // Library unavailable (e.g. SSR, Node, old browser) — fall through to
    // native navigator.vibrate() which still works on Android.
    vibrationReady = true
  }
}

// Fire-and-forget wrapper so callers don't need to await
function vibrate(pattern: number[]): void {
  ensureInit().then(() => {
    try {
      navigator.vibrate?.(pattern)
    } catch {
      // Silently ignore — vibration is always best-effort
    }
  })
}

/**
 * Spin launch — called synchronously inside the spin button's onClick.
 * Pattern: two quick pulses (double-tap "launch" feel).
 */
export function hapticSpinLaunch(): void {
  vibrate([30, 20, 30])
}

/**
 * Wheel lands — called when the wheel stops and a winner is determined.
 * Must be inside a click handler chain (e.g. the spin button click that
 * eventually calls onTaskSelected). If called from a timeout/RAF it will
 * be silently ignored by iOS.
 *
 * Pattern: stutter → pause → solid thud, like a real wheel decelerating.
 */
export function hapticWheelLand(): void {
  vibrate([15, 10, 15, 10, 80])
}

/**
 * Task complete — called when the user taps the checkmark.
 * Must be inside the checkbox/button onClick handler.
 *
 * Pattern: rapid light taps then a long reward buzz.
 */
export function hapticTaskComplete(): void {
  vibrate([10, 8, 10, 8, 10, 8, 140])
}
