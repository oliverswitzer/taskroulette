import type { Task, AppState } from './types'

const KEYS = {
  tasks: 'tr-tasks',
  appState: 'tr-app-state',
  completedCount: 'tr-completed-count',
} as const

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(KEYS.tasks, JSON.stringify(tasks))
  } catch {
    /* ignore */
  }
}

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(KEYS.tasks)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed as Task[]
  } catch {
    return []
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(KEYS.appState, state)
  } catch {
    /* ignore */
  }
}

// States that are safe to restore on cold boot.
// Transient states (WHEEL_SPINNING, TASK_CARD, PARSING) have ephemeral
// runtime data (selectedTask, physics) that isn't persisted — restoring
// them causes blank screens. Map them back to the nearest safe state.
const SAFE_STATES: Record<string, AppState> = {
  DUMP: 'DUMP',
  LIST_EDIT: 'LIST_EDIT',
  WHEEL_IDLE: 'WHEEL_IDLE',
  ALL_DONE: 'ALL_DONE',
  // Transient — remap to safe equivalents
  PARSING: 'DUMP',
  WHEEL_SPINNING: 'WHEEL_IDLE',
  TASK_CARD: 'WHEEL_IDLE',
}

export function loadAppState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEYS.appState)
    if (!raw) return null
    return SAFE_STATES[raw] ?? null
  } catch {
    return null
  }
}

export function saveCompletedCount(count: number): void {
  try {
    localStorage.setItem(KEYS.completedCount, String(count))
  } catch {
    /* ignore */
  }
}

export function loadCompletedCount(): number {
  try {
    const raw = localStorage.getItem(KEYS.completedCount)
    return raw ? parseInt(raw, 10) : 0
  } catch {
    return 0
  }
}

export function clearAll(): void {
  try {
    localStorage.removeItem(KEYS.tasks)
    localStorage.removeItem(KEYS.appState)
    localStorage.removeItem(KEYS.completedCount)
  } catch {
    /* ignore */
  }
}
