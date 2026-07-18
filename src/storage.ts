import type { Task, AppState } from './types'

const KEYS = {
  tasks: 'tr-tasks',
  appState: 'tr-app-state',
  completedCount: 'tr-completed-count',
  selectedTaskId: 'tr-selected-task-id',
  wheelAngle: 'tr-wheel-angle',
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
// TASK_CARD is now allowed when a selectedTaskId is persisted.
// Without it, TASK_CARD → WHEEL_IDLE (graceful fallback).
const SAFE_STATES: Record<string, AppState> = {
  DUMP: 'DUMP',
  LIST_EDIT: 'LIST_EDIT',
  WHEEL_IDLE: 'WHEEL_IDLE',
  ALL_DONE: 'ALL_DONE',
  TASK_CARD: 'TASK_CARD', // allowed — caller must verify selectedTaskId exists
  // Transient without recoverable state
  PARSING: 'DUMP',
  WHEEL_SPINNING: 'WHEEL_IDLE',
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

export function saveSelectedTask(taskId: string | null, angle: number): void {
  try {
    if (taskId !== null) {
      localStorage.setItem(KEYS.selectedTaskId, taskId)
      localStorage.setItem(KEYS.wheelAngle, String(angle))
    } else {
      localStorage.removeItem(KEYS.selectedTaskId)
      localStorage.removeItem(KEYS.wheelAngle)
    }
  } catch { /* ignore */ }
}

export function loadSelectedTask(): { taskId: string; angle: number } | null {
  try {
    const taskId = localStorage.getItem(KEYS.selectedTaskId)
    const angle = localStorage.getItem(KEYS.wheelAngle)
    if (!taskId) return null
    return { taskId, angle: angle ? parseFloat(angle) : 0 }
  } catch {
    return null
  }
}

export function clearAll(): void {
  try {
    localStorage.removeItem(KEYS.tasks)
    localStorage.removeItem(KEYS.appState)
    localStorage.removeItem(KEYS.completedCount)
    localStorage.removeItem(KEYS.selectedTaskId)
    localStorage.removeItem(KEYS.wheelAngle)
  } catch { /* ignore */ }
}
