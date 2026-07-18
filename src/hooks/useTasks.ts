import type { Task } from '../types'
export function useTasks() {
  return {
    tasks: [] as Task[],
    addTask: (_text: string) => {},
    editTask: (_id: string, _text: string) => {},
    deleteTask: (_id: string) => {},
    completeTask: (_id: string) => {},
    canAddMore: false,
    completedCount: 0
  }
}
