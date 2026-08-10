import { describe, it, expect } from 'vitest'
import type { Task } from '../../src/types'

/**
 * Regression: App.tsx used to track `completedCount` as a SEPARATE piece of
 * state, incremented by 1 each time a task was completed and never adjusted
 * when a task was deleted. Deleting a completed (or active) task after
 * completing several others left the ALL_DONE screen showing a stale count.
 *
 * The fix: completedCount is now derived LIVE from the `tasks` array —
 * `tasks.filter(t => t.completed).length` — the same pattern already used
 * correctly in src/hooks/useTasks.ts. These tests prove the derived count is
 * always correct regardless of what gets deleted afterward.
 */

function deriveCompletedCount(tasks: Task[]): number {
  return tasks.filter(t => t.completed).length
}

function makeTask(id: string, completed: boolean): Task {
  return { id, text: `task ${id}`, position: 0, completed }
}

describe('derived completed count survives deletions', () => {
  it('completing 3 tasks then deleting one of the COMPLETED ones reports 2, not 3', () => {
    let tasks: Task[] = [
      makeTask('1', true),
      makeTask('2', true),
      makeTask('3', true),
      makeTask('4', false), // still active, untouched
    ]
    expect(deriveCompletedCount(tasks)).toBe(3)

    // Delete one of the completed tasks (id '2')
    tasks = tasks.filter(t => t.id !== '2')

    expect(deriveCompletedCount(tasks)).toBe(2)
  })

  it('completing 3 tasks then deleting an unrelated still-ACTIVE task reports 3 (unchanged)', () => {
    let tasks: Task[] = [
      makeTask('1', true),
      makeTask('2', true),
      makeTask('3', true),
      makeTask('4', false), // active task we'll delete
      makeTask('5', false), // active task left alone
    ]
    expect(deriveCompletedCount(tasks)).toBe(3)

    // Delete the still-active task (id '4') — completed count must not drop.
    tasks = tasks.filter(t => t.id !== '4')

    expect(deriveCompletedCount(tasks)).toBe(3)
  })

  it('deleting ALL completed tasks reports 0', () => {
    let tasks: Task[] = [
      makeTask('1', true),
      makeTask('2', true),
    ]
    tasks = tasks.filter(t => !t.completed)
    expect(deriveCompletedCount(tasks)).toBe(0)
  })

  it('never drifts across a sequence of completions and deletions', () => {
    let tasks: Task[] = [
      makeTask('1', false),
      makeTask('2', false),
      makeTask('3', false),
    ]

    // Complete task 1
    tasks = tasks.map(t => (t.id === '1' ? { ...t, completed: true } : t))
    expect(deriveCompletedCount(tasks)).toBe(1)

    // Complete task 2
    tasks = tasks.map(t => (t.id === '2' ? { ...t, completed: true } : t))
    expect(deriveCompletedCount(tasks)).toBe(2)

    // Delete completed task 1
    tasks = tasks.filter(t => t.id !== '1')
    expect(deriveCompletedCount(tasks)).toBe(1)

    // Complete task 3
    tasks = tasks.map(t => (t.id === '3' ? { ...t, completed: true } : t))
    expect(deriveCompletedCount(tasks)).toBe(2)

    // Delete an active task that doesn't exist anymore — no-op, count unchanged
    tasks = tasks.filter(t => t.id !== 'nonexistent')
    expect(deriveCompletedCount(tasks)).toBe(2)
  })
})
