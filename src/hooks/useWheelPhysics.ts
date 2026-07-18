import { useState, useRef, useCallback } from 'react'
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

export function useWheelPhysics(sliceCount: number) {
  const [physics, setPhysics] = useState<PhysicsState>({
    angle: 0,
    velocity: 0,
    isSpinning: false,
    startTime: 0,
    winningSliceIndex: null,
  })
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  const startSpin = useCallback(
    (inputVelocity: number, onComplete: (index: number) => void) => {
      const clampedVelocity = clampInputVelocity(inputVelocity)

      let didStart = false
      setPhysics(prev => {
        if (prev.isSpinning) return prev // no double spin
        didStart = true
        return {
          ...prev,
          velocity: clampedVelocity,
          isSpinning: true,
          startTime: performance.now(),
          winningSliceIndex: null,
        }
      })

      if (!didStart) return

      let localAngle = 0
      let localVelocity = clampedVelocity
      let localStartTime = 0
      let initialized = false

      const animate = (timestamp: number) => {
        setPhysics(prev => {
          if (!prev.isSpinning) return prev

          if (!initialized) {
            initialized = true
            localStartTime = prev.startTime
            localAngle = prev.angle
            localVelocity = prev.velocity
            lastTimeRef.current = timestamp
            rafRef.current = requestAnimationFrame(animate)
            return prev
          }

          const deltaTime = timestamp - lastTimeRef.current
          lastTimeRef.current = timestamp

          localVelocity = decayVelocity(localVelocity)
          localAngle = localAngle + localVelocity * deltaTime

          const elapsed = timestamp - localStartTime

          if (shouldStop(localVelocity, elapsed)) {
            const winningIndex = calculateWinner(localAngle, sliceCount)
            setTimeout(() => onComplete(winningIndex), 0)
            return {
              angle: localAngle,
              velocity: 0,
              isSpinning: false,
              startTime: 0,
              winningSliceIndex: winningIndex,
            }
          }

          rafRef.current = requestAnimationFrame(animate)
          return { ...prev, angle: localAngle, velocity: localVelocity }
        })
      }

      rafRef.current = requestAnimationFrame(animate)
    },
    [sliceCount],
  )

  const resetPhysics = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setPhysics({ angle: 0, velocity: 0, isSpinning: false, startTime: 0, winningSliceIndex: null })
  }, [])

  return { physics, startSpin, resetPhysics }
}
