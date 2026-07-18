export interface Task {
  id: string
  text: string
  position: number // fixed wheel position, 0-indexed
  completed: boolean
}

export type AppState =
  | 'DUMP'
  | 'PARSING'
  | 'LIST_EDIT'
  | 'WHEEL_IDLE'
  | 'WHEEL_SPINNING'
  | 'TASK_CARD'
  | 'ALL_DONE'

export interface PhysicsState {
  angle: number         // radians, current rotation
  velocity: number      // radians/ms, always >= 0
  isSpinning: boolean
  startTime: number     // ms timestamp, for 5s hard cap
  winningSliceIndex: number | null
}

export interface WheelConfig {
  tasks: Task[]
  selectedIndex: number | null
}

export interface AppStore {
  appState: AppState
  tasks: Task[]
  completedCount: number
  selectedTask: Task | null
  winningSliceIndex: number | null
}
