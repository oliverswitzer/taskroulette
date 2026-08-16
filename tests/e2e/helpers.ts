import { Locator } from '@playwright/test'

/**
 * Waits for an element's bounding box to stop changing — used after
 * triggering a framer-motion spring/transition animation, instead of a
 * fixed `waitForTimeout` guess. A flat sleep either:
 *   - races the DOM if too short (reads a mid-animation frame, causing
 *     flaky pixel-position assertions), or
 *   - wastes time if generous enough to always be safe, which also means
 *     it gets proportionally MORE wasteful/flaky under CPU contention
 *     (e.g. parallel workers), since the same animation takes longer to
 *     finish rendering when the CPU is shared.
 *
 * Requires 3 consecutive identical reads (not just 2) with a real gap
 * between them, so a single lucky same-frame double-read under load
 * doesn't get mistaken for "settled".
 */
export async function waitForBoundingBoxToSettle(
  locator: Locator,
  opts: { timeout?: number; axis?: 'x' | 'y' } = {}
): Promise<void> {
  const { timeout = 6000, axis = 'y' } = opts
  const deadline = Date.now() + timeout
  let stableCount = 0
  let lastValue: number | null = null

  while (Date.now() < deadline) {
    const box = await locator.boundingBox()
    const value = box ? box[axis] : null

    if (value !== null && lastValue !== null && Math.abs(value - lastValue) < 0.5) {
      stableCount++
      // Require 5 consecutive stable reads (not 3) — under heavy CPU
      // contention (e.g. two full browser projects running concurrently in
      // the full suite), a dropped/throttled frame can look "stable" for
      // one or two 100ms windows and then resume moving, which produced an
      // occasional flake with a lower threshold.
      if (stableCount >= 5) return
    } else {
      stableCount = 0
    }
    lastValue = value
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  throw new Error(
    `waitForBoundingBoxToSettle: bounding box on axis "${axis}" did not settle within ${timeout}ms`
  )
}
