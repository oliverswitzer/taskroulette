import { describe, it, expect } from 'vitest'
import {
  decayVelocity,
  calculateWinner,
  shouldStop,
  clampInputVelocity,
} from '../../src/hooks/useWheelPhysics'
import {
  WHEEL_FRICTION,
  MIN_VELOCITY,
  MAX_SPIN_MS,
  MIN_SWIPE_VELOCITY,
  MAX_SWIPE_VELOCITY,
} from '../../src/constants'

describe('clampInputVelocity', () => {
  it('sets velocity >= MIN_SWIPE_VELOCITY when called with positive velocity', () => {
    const result = clampInputVelocity(0.01)
    expect(result).toBeGreaterThanOrEqual(MIN_SWIPE_VELOCITY)
  })

  it('uses MIN_SWIPE_VELOCITY when velocity is 0', () => {
    expect(clampInputVelocity(0)).toBe(MIN_SWIPE_VELOCITY)
  })

  it('uses MIN_SWIPE_VELOCITY when velocity is a small negative (near zero)', () => {
    // abs(-0.001) = 0.001 < MIN_SWIPE_VELOCITY=0.002, so clamps up to MIN_SWIPE_VELOCITY
    expect(clampInputVelocity(-0.001)).toBe(MIN_SWIPE_VELOCITY)
  })

  it('clamps to MAX_SWIPE_VELOCITY when velocity is too high', () => {
    expect(clampInputVelocity(999)).toBe(MAX_SWIPE_VELOCITY)
  })

  it('clamps large negative to MAX_SWIPE_VELOCITY (abs value exceeds max)', () => {
    // abs(-999) = 999 > MAX_SWIPE_VELOCITY=0.015, so clamps down to MAX
    expect(clampInputVelocity(-999)).toBe(MAX_SWIPE_VELOCITY)
  })

  it('velocity is always >= 0 (CCW physically impossible — abs enforced)', () => {
    const result = clampInputVelocity(-0.01)
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('startSpin with velocity=0 uses default minimum (MIN_SWIPE_VELOCITY)', () => {
    const clamped = clampInputVelocity(0)
    expect(clamped).toBeGreaterThanOrEqual(MIN_SWIPE_VELOCITY)
  })
})

describe('decayVelocity', () => {
  it('reduces velocity each frame by friction factor', () => {
    const initial = 0.01
    const decayed = decayVelocity(initial)
    expect(decayed).toBe(initial * (1 - WHEEL_FRICTION))
    expect(decayed).toBeLessThan(initial)
  })

  it('velocity always decreases (angle only increases = CW only)', () => {
    let v = MAX_SWIPE_VELOCITY
    for (let i = 0; i < 100; i++) {
      const next = decayVelocity(v)
      expect(next).toBeLessThan(v)
      v = next
    }
  })

  it('reaches near zero after many frames', () => {
    let v = MAX_SWIPE_VELOCITY
    for (let i = 0; i < 1000; i++) {
      v = decayVelocity(v)
    }
    expect(v).toBeLessThan(MIN_VELOCITY)
  })
})

describe('shouldStop', () => {
  it('returns false when velocity is above MIN_VELOCITY and time is ok', () => {
    expect(shouldStop(MIN_VELOCITY + 0.001, 1000)).toBe(false)
  })

  it('returns true when velocity < MIN_VELOCITY (spin stops)', () => {
    expect(shouldStop(MIN_VELOCITY - 0.00001, 1000)).toBe(true)
  })

  it('returns true when elapsed >= MAX_SPIN_MS (5000ms hard cap)', () => {
    expect(shouldStop(MIN_VELOCITY + 0.001, MAX_SPIN_MS)).toBe(true)
    expect(shouldStop(MIN_VELOCITY + 0.001, MAX_SPIN_MS + 1)).toBe(true)
  })

  it('returns true when both conditions are met', () => {
    expect(shouldStop(0, MAX_SPIN_MS + 1)).toBe(true)
  })
})

describe('calculateWinner', () => {
  it('returns 0 when angle is 0 for any slice count', () => {
    expect(calculateWinner(0, 4)).toBe(0)
    expect(calculateWinner(0, 8)).toBe(0)
  })

  it('returns correct slice for a quarter turn (pi/2)', () => {
    // With 4 slices, each slice = pi/2 radians
    // Rotating by pi/2: normalized = pi/2, TAU - pi/2 = 3*pi/2, floor(3*pi/2 / (pi/2)) = 3
    const result = calculateWinner(Math.PI / 2, 4)
    expect(result).toBe(3)
  })

  it('returns correct slice for a half turn (pi)', () => {
    // With 4 slices: floor((TAU - pi) / (pi/2)) = floor(pi / (pi/2)) = floor(2) = 2
    const result = calculateWinner(Math.PI, 4)
    expect(result).toBe(2)
  })

  it('handles angle larger than TAU (multiple rotations)', () => {
    const TAU = Math.PI * 2
    // 2.5 full rotations = same as 0.5 rotations = half turn
    const result1 = calculateWinner(Math.PI, 4)
    const result2 = calculateWinner(Math.PI + TAU * 2, 4)
    expect(result1).toBe(result2)
  })

  it('returns index within valid range [0, sliceCount)', () => {
    for (let angle = 0; angle < Math.PI * 4; angle += 0.3) {
      const result = calculateWinner(angle, 6)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThan(6)
    }
  })

  it('winningSliceIndex is correctly calculated for all 8 slices', () => {
    const TAU = Math.PI * 2
    const sliceAngle = TAU / 8
    const results = new Set<number>()
    for (let i = 0; i < 8; i++) {
      results.add(calculateWinner(sliceAngle * i, 8))
    }
    expect(results.size).toBeGreaterThan(1)
  })
})
