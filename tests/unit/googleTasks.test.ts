import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getTaskBucket,
  groupTasksByBucket,
  sortTasksByDue,
  filterDueSoon,
  formatDueDate,
} from '../../src/googleTasks'
import type { GoogleTask } from '../../src/types'

// Freeze "now" to a known date for all tests
const NOW = new Date('2024-06-15T12:00:00.000Z') // Saturday, June 15 2024

function makeTask(overrides: Partial<GoogleTask> = {}): GoogleTask {
  return {
    id: 'task-1',
    title: 'Test task',
    listId: 'list-1',
    listTitle: 'My Tasks',
    status: 'needsAction',
    ...overrides,
  }
}

describe('getTaskBucket', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  it('returns "noDue" for tasks without a due date', () => {
    const task = makeTask()
    expect(getTaskBucket(task)).toBe('noDue')
  })

  it('returns "overdue" for tasks due before today', () => {
    const task = makeTask({ due: '2024-06-14T00:00:00.000Z' })
    expect(getTaskBucket(task)).toBe('overdue')
  })

  it('returns "today" for tasks due today', () => {
    // Due date is same calendar day as NOW (June 15)
    const task = makeTask({ due: '2024-06-15T00:00:00.000Z' })
    expect(getTaskBucket(task)).toBe('today')
  })

  it('returns "thisWeek" for tasks due in the next 7 days', () => {
    const task = makeTask({ due: '2024-06-18T00:00:00.000Z' })
    expect(getTaskBucket(task)).toBe('thisWeek')
  })

  it('returns "later" for tasks due beyond 7 days', () => {
    const task = makeTask({ due: '2024-07-01T00:00:00.000Z' })
    expect(getTaskBucket(task)).toBe('later')
  })
})

describe('groupTasksByBucket', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  it('groups tasks into correct buckets', () => {
    const tasks: GoogleTask[] = [
      makeTask({ id: '1', due: '2024-06-14T00:00:00.000Z' }), // overdue
      makeTask({ id: '2', due: '2024-06-15T00:00:00.000Z' }), // today
      makeTask({ id: '3', due: '2024-06-18T00:00:00.000Z' }), // thisWeek
      makeTask({ id: '4', due: '2024-07-01T00:00:00.000Z' }), // later
      makeTask({ id: '5' }), // noDue
    ]
    const groups = groupTasksByBucket(tasks)
    expect(groups.get('overdue')).toHaveLength(1)
    expect(groups.get('today')).toHaveLength(1)
    expect(groups.get('thisWeek')).toHaveLength(1)
    expect(groups.get('later')).toHaveLength(1)
    expect(groups.get('noDue')).toHaveLength(1)
  })

  it('returns empty arrays for buckets with no tasks', () => {
    const groups = groupTasksByBucket([])
    for (const bucket of ['overdue', 'today', 'thisWeek', 'later', 'noDue'] as const) {
      expect(groups.get(bucket)).toHaveLength(0)
    }
  })
})

describe('sortTasksByDue', () => {
  it('sorts tasks by due date ascending, null/undefined last', () => {
    const tasks: GoogleTask[] = [
      makeTask({ id: '3', due: '2024-06-20T00:00:00.000Z' }),
      makeTask({ id: '1', due: '2024-06-14T00:00:00.000Z' }),
      makeTask({ id: '4' }), // no due
      makeTask({ id: '2', due: '2024-06-15T00:00:00.000Z' }),
    ]
    const sorted = sortTasksByDue(tasks)
    expect(sorted.map(t => t.id)).toEqual(['1', '2', '3', '4'])
  })
})

describe('filterDueSoon', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  it('returns only overdue, today, and thisWeek tasks', () => {
    const tasks: GoogleTask[] = [
      makeTask({ id: 'overdue', due: '2024-06-14T00:00:00.000Z' }),
      makeTask({ id: 'today', due: '2024-06-15T00:00:00.000Z' }),
      makeTask({ id: 'week', due: '2024-06-18T00:00:00.000Z' }),
      makeTask({ id: 'later', due: '2024-07-01T00:00:00.000Z' }),
      makeTask({ id: 'noDue' }),
    ]
    const filtered = filterDueSoon(tasks)
    expect(filtered.map(t => t.id).sort()).toEqual(['overdue', 'today', 'week'])
  })
})

describe('formatDueDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  it('returns empty string for undefined', () => {
    expect(formatDueDate(undefined)).toBe('')
  })

  it('returns "Today" for today', () => {
    expect(formatDueDate('2024-06-15T00:00:00.000Z')).toBe('Today')
  })

  it('returns "N days overdue" for overdue tasks', () => {
    expect(formatDueDate('2024-06-14T00:00:00.000Z')).toBe('1 day overdue')
    expect(formatDueDate('2024-06-10T00:00:00.000Z')).toBe('5 days overdue')
  })

  it('returns formatted date for future tasks', () => {
    expect(formatDueDate('2024-06-18T00:00:00.000Z')).toBe('Jun 18')
  })
})
