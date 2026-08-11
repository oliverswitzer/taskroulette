import { describe, it, expect } from 'vitest'
import { hitTestSlice } from '../../src/lib/wheelHitTest'

describe('hitTestSlice', () => {
  const radius = 100

  it('returns null when wheel has zero tasks', () => {
    expect(hitTestSlice(10, 10, radius, 0, 0)).toBeNull()
  })

  it('returns null when click point is outside the wheel radius', () => {
    expect(hitTestSlice(200, 200, radius, 4, 0)).toBeNull()
  })

  it('identifies the first slice (top, angle=0) for a 4-slice wheel with no rotation', () => {
    // baseStartAngle = -TAU/4 (pointing up, "12 o'clock"), sliceAngle = TAU/4 (90°)
    // Slice 0 spans from -90° to 0° (canvas angle convention, y-down).
    // A point straight up from center (dx=0, dy=-50) sits at clickAngle = -90°,
    // which is exactly the start of slice 0.
    const index = hitTestSlice(0, -50, radius, 4, 0)
    expect(index).toBe(0)
  })

  it('identifies different slices as the click angle sweeps around a 4-slice wheel', () => {
    // Sample one point comfortably inside each of the 4 quadrants (slices), unrotated.
    // Slice boundaries at angle=0 are at canvas angles: -90°, 0°, 90°, 180°(=-180°)
    const midSlice0 = hitTestSlice(35, -35, radius, 4, 0)  // ~-45°, mid of slice 0
    const midSlice1 = hitTestSlice(50, 20, radius, 4, 0)   // ~22°, mid of slice 1
    const midSlice2 = hitTestSlice(-35, 35, radius, 4, 0)  // ~135°, mid of slice 2
    const midSlice3 = hitTestSlice(-50, -20, radius, 4, 0) // ~-158°, mid of slice 3

    expect(midSlice0).toBe(0)
    expect(midSlice1).toBe(1)
    expect(midSlice2).toBe(2)
    expect(midSlice3).toBe(3)

    // All four should be distinct slices
    expect(new Set([midSlice0, midSlice1, midSlice2, midSlice3]).size).toBe(4)
  })

  it('rotating the wheel by a full slice shifts which slice a fixed point hits', () => {
    const sliceAngle = (Math.PI * 2) / 4
    const unrotated = hitTestSlice(0, -50, radius, 4, 0)
    const rotatedByOneSlice = hitTestSlice(0, -50, radius, 4, sliceAngle)
    expect(unrotated).toBe(0)
    // Rotating the wheel forward by one slice means the point that used to be
    // in slice 0 is now in the slice that was previously "behind" it.
    expect(rotatedByOneSlice).not.toBe(unrotated)
  })

  it('a point exactly at the center (dist=0) still resolves to a valid slice', () => {
    const index = hitTestSlice(0, 0, radius, 3, 0)
    expect(index).not.toBeNull()
    expect(index).toBeGreaterThanOrEqual(0)
    expect(index).toBeLessThan(3)
  })

  it('handles negative rotation angles correctly (wheel spun the other way)', () => {
    const index = hitTestSlice(0, -50, radius, 4, -Math.PI / 2)
    expect(index).not.toBeNull()
    expect(index).toBeGreaterThanOrEqual(0)
    expect(index).toBeLessThan(4)
  })
})
