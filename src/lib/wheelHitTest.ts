const TAU = Math.PI * 2

/**
 * Pure hit-testing helper — given a click point relative to the wheel center
 * (dx, dy in canvas px) and the wheel's current rotation `angle`, returns the
 * slice index under that point, or null if outside the wheel radius or the
 * wheel is empty. Mirrors the exact angle math used when drawing slices in
 * WheelCanvas.tsx (`baseStartAngle = -TAU/4 + angle`, `sliceAngle = TAU / count`).
 */
export function hitTestSlice(
  dx: number,
  dy: number,
  radius: number,
  count: number,
  angle: number
): number | null {
  if (count === 0) return null
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > radius) return null

  const sliceAngle = TAU / count
  const baseStartAngle = -TAU / 4 + angle
  const clickAngle = Math.atan2(dy, dx)

  // Normalize (clickAngle - baseStartAngle) into [0, TAU)
  let rel = (clickAngle - baseStartAngle) % TAU
  if (rel < 0) rel += TAU

  const index = Math.floor(rel / sliceAngle)
  return index >= 0 && index < count ? index : null
}
