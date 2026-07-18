export function saveTasks(_tasks: import('./types').Task[]): void {}
export function loadTasks(): import('./types').Task[] { return [] }
export function saveAppState(_state: import('./types').AppState): void {}
export function loadAppState(): import('./types').AppState | null { return null }
export function clearAll(): void {}
