import { describe, it, expect } from 'vitest'
import { generateId } from '../../src/lib/id'

/**
 * Regression: "completing the one non-Google task showed the ALL_DONE screen
 * even though Google tasks remained."
 *
 * App.tsx handleTaskComplete marks a task done via
 *   tasks.map(t => t.id === selectedTask.id ? { ...t, completed: true } : t)
 * then decides the session is over with
 *   updated.filter(t => !t.completed).length === 0  -> ALL_DONE
 *
 * That logic is correct GIVEN unique ids. The bug was that batch-imported
 * Google tasks + a manually-added task could share the same String(Date.now())
 * id (the collision fixed in src/lib/id.ts). Completing one flipped every
 * colliding task to completed, so `remaining` became empty and the app wrongly
 * jumped to ALL_DONE after a single check-off.
 *
 * These tests encode the exact user scenario against the real generateId() to
 * prove unique ids keep the completion gate honest, and document the old
 * colliding-id failure mode so the invariant can't silently regress.
 *
 * Note: this mirrors App.tsx handleTaskComplete's pure core (the handler itself
 * closes over component state and isn't unit-testable in isolation). The
 * mirrored logic matches App.tsx line-for-line as of this commit.
 */

interface T { id: string; completed: boolean }

// Mirrors App.tsx handleTaskComplete's pure core.
function completeById(tasks: T[], targetId: string): { updated: T[]; remaining: T[] } {
  const updated = tasks.map(t => (t.id === targetId ? { ...t, completed: true } : t))
  const remaining = updated.filter(t => !t.completed)
  return { updated, remaining }
}

describe('task completion gate (ALL_DONE)', () => {
  it('completing one task in a same-tick batch does NOT complete the others', () => {
    // The real bug scenario: several Google tasks + one manual task, all
    // created in the same synchronous burst (same millisecond).
    const tasks: T[] = [
      { id: generateId(), completed: false }, // google 1
      { id: generateId(), completed: false }, // google 2
      { id: generateId(), completed: false }, // google 3
      { id: generateId(), completed: false }, // manual (the one checked off)
    ]
    const manual = tasks[3]

    const { updated, remaining } = completeById(tasks, manual.id)

    // Only the manual task should be completed.
    expect(updated.filter(t => t.completed)).toHaveLength(1)
    expect(updated.find(t => t.id === manual.id)!.completed).toBe(true)
    // The three Google tasks remain active -> NOT all done.
    expect(remaining).toHaveLength(3)
  })

  it('reports all done only when every task is genuinely completed', () => {
    const tasks: T[] = [
      { id: generateId(), completed: true },
      { id: generateId(), completed: false },
    ]
    const target = tasks[1]
    const { remaining } = completeById(tasks, target.id)
    expect(remaining).toHaveLength(0)
  })

  it('single-task list correctly reports all done after its completion', () => {
    const only: T = { id: generateId(), completed: false }
    const { remaining } = completeById([only], only.id)
    expect(remaining).toHaveLength(0)
  })

  // Documents the OLD failure mode explicitly: colliding ids break the gate.
  it('DOCUMENTS the old bug: colliding ids make one completion mark all done', () => {
    const collidingId = '1700000000000' // what String(Date.now()) produced for all
    const tasks: T[] = [
      { id: collidingId, completed: false },
      { id: collidingId, completed: false },
      { id: collidingId, completed: false },
    ]
    const { remaining } = completeById(tasks, collidingId)
    // Buggy behavior the generateId() fix prevents by never producing
    // colliding ids in the first place.
    expect(remaining).toHaveLength(0)
  })
})
