import { useState, useCallback } from 'react'
import type { Task } from '../types'
import { MAX_TASKS } from '../constants'
import { saveTasks } from '../storage'
import { generateId } from '../lib/id'

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

  // Batch-append parsed tasks, capped ONCE against the current active count.
  // Returns how many were actually added vs. dropped so the caller can show
  // honest overflow feedback ("Added 8, you hit your 20-task limit") instead
  // of silently truncating — the failure mode of looping single addTask calls.
  const addTasks = useCallback((texts: string[]): { added: number; dropped: number } => {
    const cleaned = texts.map(t => t.trim()).filter(t => t.length > 0)
    let result = { added: 0, dropped: 0 }
    setTasks(prev => {
      const active = prev.filter(t => !t.completed)
      const room = Math.max(0, MAX_TASKS - active.length)
      const toAdd = cleaned.slice(0, room)
      result = { added: toAdd.length, dropped: cleaned.length - toAdd.length }
      if (toAdd.length === 0) return prev
      const newTasks: Task[] = toAdd.map((text, i) => ({
        id: generateId(),
        text,
        position: active.length + i,
        completed: false,
      }))
      const updated = [...prev, ...newTasks]
      saveTasks(updated)
      return updated
    })
    return result
  }, [])

  return {
    tasks,
    activeTasks,
    addTask,
    addTasks,
    editTask,
    deleteTask,
    completeTask,
    setAllTasks,
    canAddMore,
    completedCount,
  }
}
