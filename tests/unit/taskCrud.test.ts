import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTasks } from '../../src/hooks/useTasks'
import { MAX_TASKS } from '../../src/constants'

// Mock storage so we don't touch localStorage
vi.mock('../../src/storage', () => ({
  saveTasks: vi.fn(),
  loadTasks: vi.fn(() => []),
}))

describe('useTasks — addTask', () => {
  it('adds a task with unique id, correct text, position=active count, completed=false', () => {
    const { result } = renderHook(() => useTasks())
    act(() => { result.current.addTask('Buy milk') })
    const tasks = result.current.tasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0].text).toBe('Buy milk')
    expect(tasks[0].completed).toBe(false)
    expect(tasks[0].position).toBe(0)
    expect(tasks[0].id).toBeTruthy()
  })

  it('assigns unique ids to multiple tasks', () => {
    const { result } = renderHook(() => useTasks())
    act(() => { result.current.addTask('Task A') })
    act(() => { result.current.addTask('Task B') })
    const ids = result.current.tasks.map(t => t.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('sets position = active task count at time of insertion', () => {
    const { result } = renderHook(() => useTasks())
    act(() => { result.current.addTask('First') })
    act(() => { result.current.addTask('Second') })
    expect(result.current.tasks[0].position).toBe(0)
    expect(result.current.tasks[1].position).toBe(1)
  })

  it('does not add task when active tasks >= MAX_TASKS', () => {
    const initial = Array.from({ length: MAX_TASKS }, (_, i) => ({
      id: `id-${i}`,
      text: `Task ${i}`,
      position: i,
      completed: false,
    }))
    const { result } = renderHook(() => useTasks(initial))
    act(() => { result.current.addTask('One more') })
    expect(result.current.tasks).toHaveLength(MAX_TASKS)
  })

  it('canAddMore is false when active task count === MAX_TASKS', () => {
    const initial = Array.from({ length: MAX_TASKS }, (_, i) => ({
      id: `id-${i}`,
      text: `Task ${i}`,
      position: i,
      completed: false,
    }))
    const { result } = renderHook(() => useTasks(initial))
    expect(result.current.canAddMore).toBe(false)
  })

  it('canAddMore is true when active tasks < MAX_TASKS', () => {
    const { result } = renderHook(() => useTasks())
    expect(result.current.canAddMore).toBe(true)
  })

  it('active tasks never exceed MAX_TASKS', () => {
    const { result } = renderHook(() => useTasks())
    for (let i = 0; i < MAX_TASKS + 5; i++) {
      act(() => { result.current.addTask(`Task ${i}`) })
    }
    expect(result.current.activeTasks.length).toBeLessThanOrEqual(MAX_TASKS)
  })
})

describe('useTasks — editTask', () => {
  it('updates text of existing task by id', () => {
    const initial = [{ id: 'abc', text: 'Old text', position: 0, completed: false }]
    const { result } = renderHook(() => useTasks(initial))
    act(() => { result.current.editTask('abc', 'New text') })
    expect(result.current.tasks[0].text).toBe('New text')
  })

  it('does nothing for unknown id', () => {
    const initial = [{ id: 'abc', text: 'Original', position: 0, completed: false }]
    const { result } = renderHook(() => useTasks(initial))
    act(() => { result.current.editTask('unknown', 'Changed') })
    expect(result.current.tasks[0].text).toBe('Original')
  })

  it('trims whitespace from text', () => {
    const initial = [{ id: 'abc', text: 'Old', position: 0, completed: false }]
    const { result } = renderHook(() => useTasks(initial))
    act(() => { result.current.editTask('abc', '  Trimmed  ') })
    expect(result.current.tasks[0].text).toBe('Trimmed')
  })
})

describe('useTasks — deleteTask', () => {
  it('removes task by id', () => {
    const initial = [
      { id: 'a', text: 'Task A', position: 0, completed: false },
      { id: 'b', text: 'Task B', position: 1, completed: false },
    ]
    const { result } = renderHook(() => useTasks(initial))
    act(() => { result.current.deleteTask('a') })
    expect(result.current.tasks).toHaveLength(1)
    expect(result.current.tasks[0].id).toBe('b')
  })

  it('does nothing for unknown id', () => {
    const initial = [{ id: 'a', text: 'Task A', position: 0, completed: false }]
    const { result } = renderHook(() => useTasks(initial))
    act(() => { result.current.deleteTask('unknown') })
    expect(result.current.tasks).toHaveLength(1)
  })
})

describe('useTasks — completeTask', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('marks task as completed=true', () => {
    const initial = [{ id: 'a', text: 'Task A', position: 0, completed: false }]
    const { result } = renderHook(() => useTasks(initial))
    act(() => { result.current.completeTask('a') })
    expect(result.current.tasks[0].completed).toBe(true)
  })

  it('does not change position of remaining tasks', () => {
    const initial = [
      { id: 'a', text: 'Task A', position: 0, completed: false },
      { id: 'b', text: 'Task B', position: 1, completed: false },
    ]
    const { result } = renderHook(() => useTasks(initial))
    act(() => { result.current.completeTask('a') })
    // position fields must be unchanged
    expect(result.current.tasks[0].position).toBe(0)
    expect(result.current.tasks[1].position).toBe(1)
  })

  it('completed tasks do not count toward active task limit', () => {
    const initial = Array.from({ length: MAX_TASKS }, (_, i) => ({
      id: `id-${i}`,
      text: `Task ${i}`,
      position: i,
      completed: false,
    }))
    const { result } = renderHook(() => useTasks(initial))
    act(() => { result.current.completeTask('id-0') })
    // now one is completed, canAddMore should be true
    expect(result.current.canAddMore).toBe(true)
  })
})
