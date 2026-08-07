import { describe, it, expect } from 'vitest'
import { generateId } from '../../src/lib/id'

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(generateId()).toBeTruthy()
    expect(typeof generateId()).toBe('string')
  })

  // Regression: importing multiple Google tasks calls the ID generator in a
  // synchronous loop. With String(Date.now()) alone, every iteration in the
  // same millisecond returned the SAME id, so deleting one imported task
  // deleted the entire batch (delete filters by id). Guard against that.
  it('produces unique ids when called many times in a tight synchronous loop', () => {
    const ids = Array.from({ length: 1000 }, () => generateId())
    expect(new Set(ids).size).toBe(1000)
  })

  it('simulates a Google Tasks batch import: 10 tasks added in the same tick all get distinct ids', () => {
    // Mirrors handleGoogleImport -> onAddTask forEach loop in App/ListEditScreen
    const batch = ['Task A', 'Task B', 'Task C', 'Task D', 'Task E',
      'Task F', 'Task G', 'Task H', 'Task I', 'Task J']
    const tasks = batch.map(text => ({ id: generateId(), text }))

    const ids = tasks.map(t => t.id)
    expect(new Set(ids).size).toBe(batch.length)

    // Deleting ONE task (by id) must leave the rest intact — this is the
    // behavior the collision bug broke.
    const target = tasks[3].id
    const remaining = tasks.filter(t => t.id !== target)
    expect(remaining).toHaveLength(batch.length - 1)
    expect(remaining.some(t => t.id === target)).toBe(false)
  })
})
