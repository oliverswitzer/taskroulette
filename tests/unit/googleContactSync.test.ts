import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { splitName, syncGoogleContactToLoops } from '../../src/hooks/useGoogleTasks'
import { TR_EMAIL_KEY } from '../../src/constants'

// Minimal localStorage mock for test isolation (matches storage.test.ts convention)
const store = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
  clear: () => { store.clear() },
}

describe('splitName', () => {
  it('prefers given_name/family_name when present', () => {
    expect(splitName({ given_name: 'Ada', family_name: 'Lovelace', full_name: 'ignored' }))
      .toEqual({ firstName: 'Ada', lastName: 'Lovelace' })
  })

  it('falls back to full_name split on whitespace', () => {
    expect(splitName({ full_name: 'Grace Hopper' })).toEqual({ firstName: 'Grace', lastName: 'Hopper' })
  })

  it('falls back to name field when full_name is missing', () => {
    expect(splitName({ name: 'Alan Turing' })).toEqual({ firstName: 'Alan', lastName: 'Turing' })
  })

  it('handles a single-word name with no last name', () => {
    expect(splitName({ full_name: 'Madonna' })).toEqual({ firstName: 'Madonna', lastName: undefined })
  })

  it('handles multi-word last names', () => {
    expect(splitName({ full_name: 'Mary Jane Watson' })).toEqual({ firstName: 'Mary', lastName: 'Jane Watson' })
  })

  it('returns empty object when no name data is present', () => {
    expect(splitName({})).toEqual({})
  })

  it('given_name alone (no family_name) still takes the given_name branch', () => {
    expect(splitName({ given_name: 'Ada', full_name: 'ignored' })).toEqual({ firstName: 'Ada', lastName: undefined })
  })
})

describe('syncGoogleContactToLoops', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    store.clear()
    vi.stubGlobal('localStorage', mockLocalStorage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mockSubmitEmailOk() {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', mockFetch)
    return mockFetch
  }

  it('does nothing when email is undefined', async () => {
    const mockFetch = mockSubmitEmailOk()
    await syncGoogleContactToLoops(undefined, { full_name: 'Ada Lovelace' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does nothing when TR_EMAIL_KEY is already set (already synced)', async () => {
    localStorage.setItem(TR_EMAIL_KEY, 'existing@example.com')
    const mockFetch = mockSubmitEmailOk()
    await syncGoogleContactToLoops('new@example.com', { full_name: 'Ada Lovelace' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('submits email + split name and marks TR_EMAIL_KEY on success', async () => {
    const mockFetch = mockSubmitEmailOk()
    await syncGoogleContactToLoops('ada@example.com', { full_name: 'Ada Lovelace' })
    expect(mockFetch).toHaveBeenCalledWith('/api/submit-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' }),
    })
    expect(localStorage.getItem(TR_EMAIL_KEY)).toBe('ada@example.com')
  })

  it('does not mark TR_EMAIL_KEY when the submit fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'boom' }),
    }))
    await syncGoogleContactToLoops('ada@example.com', { full_name: 'Ada Lovelace' })
    expect(localStorage.getItem(TR_EMAIL_KEY)).toBeNull()
  })
})
