import type { PhysicsState } from '../types'
export function useWheelPhysics(_sliceCount: number) {
  return {
    physics: null as PhysicsState | null,
    startSpin: (_velocity: number) => {},
    resetPhysics: () => {}
  }
}
