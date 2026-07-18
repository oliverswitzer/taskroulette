import { useState, useRef, useCallback, useEffect } from 'react'
import {
  WHEEL_FRICTION,
  MIN_VELOCITY,
  MAX_SPIN_MS,
  MAX_SWIPE_VELOCITY,
  MIN_SWIPE_VELOCITY,
} from '../constants'
import type { PhysicsState } from '../types'

// ─── Pure physics functions — testable without React ──────────────────────────

export function decayVelocity(velocity: number): number {
  return velocity * (1 - WHEEL_FRICTION)
}

export function calculateWinner(angle: number, sliceCount: number): number {
  const TAU = Math.PI * 2
  const sliceAngle = TAU / sliceCount
  const normalized = ((angle % TAU) + TAU) % TAU
  return Math.floor(((TAU - normalized) % TAU) / sliceAngle) % sliceCount
}

export function shouldStop(velocity: number, elapsedMs: number): boolean {
  return velocity < MIN_VELOCITY || elapsedMs >= MAX_SPIN_MS
}

export function clampInputVelocity(v: number): number {
  return Math.min(Math.max(Math.abs(v), MIN_SWIPE_VELOCITY), MAX_SWIPE_VELOCITY)
}

// ─── React hook ───────────────────────────────────────────────────────────────
// Uses refs for all mutable animation state to avoid stale closure bugs
// in requestAnimationFrame loops (especially in test/headless environments).

export function useWheelPhysics(sliceCount: number) {
  const [physics, setPhysics] = useState<PhysicsState>({
    angle: 0,
    velocity: 0,
    isSpinning: false,
    startTime: 0,
    winningSliceIndex: null,
  })

  // Refs hold the live values — no closure staleness
  const angleRef = useRef(0)
  const velocityRef = useRef(0)
  const isSpinningRef = useRef(false)
  const startTimeRef = useRef(0)
  const lastTimestampRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const sliceCountRef = useRef(sliceCount)
  const onCompleteRef = useRef<((index: number) => void) | null>(null)

  // Keep sliceCount ref current
  useEffect(() => {
    sliceCountRef.current = sliceCount
  }, [sliceCount])

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const animate = useCallback((timestamp: number) => {
    if (!isSpinningRef.current) return

    if (lastTimestampRef.current === 0) {
      lastTimestampRef.current = timestamp
      rafRef.current = requestAnimationFrame(animate)
      return
    }

    const deltaTime = Math.min(timestamp - lastTimestampRef.current, 50) // cap at 50ms to handle tab-switch gaps
    lastTimestampRef.current = timestamp

    // Time-based friction decay — frame-rate independent
    // Each ms: velocity *= (1 - WHEEL_FRICTION)^(deltaTime/16.67)
    const frictionFactor = Math.pow(1 - WHEEL_FRICTION, deltaTime / 16.67)
    velocityRef.current = velocityRef.current * frictionFactor
    // Advance angle
    angleRef.current = angleRef.current + velocityRef.current * deltaTime

    const elapsed = timestamp - startTimeRef.current

    if (shouldStop(velocityRef.current, elapsed)) {
      // Spin complete
      isSpinningRef.current = false
      const winner = calculateWinner(angleRef.current, sliceCountRef.current)

      setPhysics({
        angle: angleRef.current,
        velocity: 0,
        isSpinning: false,
        startTime: 0,
        winningSliceIndex: winner,
      })

      stopAnimation()

      // Notify caller on next tick so state has settled
      const cb = onCompleteRef.current
      if (cb) {
        setTimeout(() => cb(winner), 0)
      }
    } else {
      // Still spinning — update display state
      setPhysics({
        angle: angleRef.current,
        velocity: velocityRef.current,
        isSpinning: true,
        startTime: startTimeRef.current,
        winningSliceIndex: null,
      })
      rafRef.current = requestAnimationFrame(animate)
    }
  }, [stopAnimation])

  const startSpin = useCallback(
    (inputVelocity: number, onComplete: (index: number) => void) => {
      if (isSpinningRef.current) return // no double spin

      const clampedVelocity = clampInputVelocity(inputVelocity)

      // Update refs
      isSpinningRef.current = true
      velocityRef.current = clampedVelocity
      startTimeRef.current = performance.now()
      lastTimestampRef.current = 0
      onCompleteRef.current = onComplete

      setPhysics(prev => ({
        ...prev,
        velocity: clampedVelocity,
        isSpinning: true,
        startTime: startTimeRef.current,
        winningSliceIndex: null,
      }))

      stopAnimation()
      rafRef.current = requestAnimationFrame(animate)
    },
    [animate, stopAnimation]
  )

  const resetPhysics = useCallback(() => {
    stopAnimation()
    isSpinningRef.current = false
    velocityRef.current = 0
    angleRef.current = 0
    startTimeRef.current = 0
    lastTimestampRef.current = 0
    setPhysics({
      angle: 0,
      velocity: 0,
      isSpinning: false,
      startTime: 0,
      winningSliceIndex: null,
    })
  }, [stopAnimation])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAnimation()
  }, [stopAnimation])

  return { physics, startSpin, resetPhysics }
}
