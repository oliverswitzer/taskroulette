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

export function loadAppState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEYS.appState)
    return raw as AppState | null
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
