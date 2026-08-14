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

// Outcome of a batch append (brain dump / Google import), so the UI can give
// honest overflow feedback instead of silently dropping tasks past the cap.
export interface AppendResult {
  added: number
  dropped: number
}

export interface AppStore {
  appState: AppState
  tasks: Task[]
  completedCount: number
  selectedTask: Task | null
  winningSliceIndex: number | null
}

// ── Google Tasks integration ──────────────────────────────────────────────────

export interface GoogleTask {
  id: string
  title: string
  due?: string          // ISO 8601 date string, e.g. "2024-01-15T00:00:00.000Z"
  listId: string
  listTitle: string
  status: 'needsAction' | 'completed'
}

export type GoogleTaskBucket = 'overdue' | 'today' | 'thisWeek' | 'later' | 'noDue'

export type GoogleAuthState = 'idle' | 'loading' | 'authenticated' | 'error'

export interface GoogleTasksState {
  authState: GoogleAuthState
  tasks: GoogleTask[]
  error: string | null
  isLoading: boolean
}
