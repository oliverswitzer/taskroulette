import { useState, useCallback } from 'react'
import type { Task } from '../types'
import { MAX_TASKS } from '../constants'
import { saveTasks } from '../storage'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function useTasks(initialTasks: Task[] = []) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)

  const activeTasks = tasks.filter(t => !t.completed)
  const completedCount = tasks.filter(t => t.completed).length
  const canAddMore = activeTasks.length < MAX_TASKS

  const addTask = useCallback((text: string) => {
    setTasks(prev => {
      const active = prev.filter(t => !t.completed)
      if (active.length >= MAX_TASKS) return prev
      const newTask: Task = {
        id: generateId(),
        text: text.trim(),
        position: active.length,
        completed: false,
      }
      const updated = [...prev, newTask]
      saveTasks(updated)
      return updated
    })
  }, [])

  const editTask = useCallback((id: string, text: string) => {
    setTasks(prev => {
      const updated = prev.map(t => (t.id === id ? { ...t, text: text.trim() } : t))
      saveTasks(updated)
      return updated
    })
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id)
      saveTasks(updated)
      return updated
    })
  }, [])

  const completeTask = useCallback((id: string) => {
    setTasks(prev => {
      const updated = prev.map(t => (t.id === id ? { ...t, completed: true } : t))
      saveTasks(updated)
      return updated
    })
  }, [])

  const setAllTasks = useCallback((newTasks: Task[]) => {
    setTasks(newTasks)
    saveTasks(newTasks)
  }, [])

  return {
    tasks,
    activeTasks,
    addTask,
    editTask,
    deleteTask,
    completeTask,
    setAllTasks,
    canAddMore,
    completedCount,
  }
}
