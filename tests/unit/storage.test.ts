// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveTasks,
  loadTasks,
  saveAppState,
  loadAppState,
  clearAll,
} from '../../src/storage'
import type { Task } from '../../src/types'

const SAMPLE_TASKS: Task[] = [
  { id: 'a', text: 'Task A', position: 0, completed: false },
  { id: 'b', text: 'Task B', position: 1, completed: true },
]

// Minimal localStorage mock for test isolation
const store = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
  clear: () => { store.clear() },
}

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', mockLocalStorage)
})

describe('saveTasks / loadTasks', () => {
  it('saveTasks writes to localStorage key "tr-tasks"', () => {
    saveTasks(SAMPLE_TASKS)
    const raw = mockLocalStorage.getItem('tr-tasks')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toEqual(SAMPLE_TASKS)
  })

  it('loadTasks reads from localStorage key "tr-tasks"', () => {
    saveTasks(SAMPLE_TASKS)
    const loaded = loadTasks()
    expect(loaded).toEqual(SAMPLE_TASKS)
  })

  it('loadTasks returns [] if key is missing', () => {
    expect(loadTasks()).toEqual([])
  })

  it('loadTasks returns [] if JSON is corrupt', () => {
    mockLocalStorage.setItem('tr-tasks', 'not-json{{{')
    expect(loadTasks()).toEqual([])
  })

  it('loadTasks returns [] if stored value is not an array', () => {
    mockLocalStorage.setItem('tr-tasks', JSON.stringify({ foo: 'bar' }))
    expect(loadTasks()).toEqual([])
  })
})

describe('saveAppState / loadAppState', () => {
  it('saveAppState writes to localStorage key "tr-app-state"', () => {
    saveAppState('WHEEL_IDLE')
    expect(mockLocalStorage.getItem('tr-app-state')).toBe('WHEEL_IDLE')
  })

  it('loadAppState reads the saved state', () => {
    saveAppState('LIST_EDIT')
    expect(loadAppState()).toBe('LIST_EDIT')
  })

  it('loadAppState returns null if key is missing', () => {
    expect(loadAppState()).toBeNull()
  })

  it('loadAppState returns null for an unknown/garbage state', () => {
    mockLocalStorage.setItem('tr-app-state', 'BANANA')
    expect(loadAppState()).toBeNull()
  })

  describe('transient state sanitization on cold boot', () => {
    it.each([
      ['WHEEL_SPINNING', 'WHEEL_IDLE'],
      ['TASK_CARD',      'WHEEL_IDLE'],
      ['PARSING',        'DUMP'],
    ])('restores %s → %s so the app never boots into a blank screen', (saved, expected) => {
      mockLocalStorage.setItem('tr-app-state', saved)
      expect(loadAppState()).toBe(expected)
    })

    it.each([
      ['DUMP'],
      ['LIST_EDIT'],
      ['WHEEL_IDLE'],
      ['ALL_DONE'],
    ])('passes safe state %s through unchanged', (state) => {
      mockLocalStorage.setItem('tr-app-state', state)
      expect(loadAppState()).toBe(state)
    })
  })
})

describe('clearAll', () => {
  it('removes all three keys', () => {
    saveTasks(SAMPLE_TASKS)
    saveAppState('DUMP')
    mockLocalStorage.setItem('tr-completed-count', '5')

    clearAll()

    expect(mockLocalStorage.getItem('tr-tasks')).toBeNull()
    expect(mockLocalStorage.getItem('tr-app-state')).toBeNull()
    expect(mockLocalStorage.getItem('tr-completed-count')).toBeNull()
  })

  it('does not throw if keys are already missing', () => {
    expect(() => clearAll()).not.toThrow()
  })
})
