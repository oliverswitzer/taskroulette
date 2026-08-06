import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { submitEmail } from '../../src/api'

describe('submitEmail', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts email only when no name is given', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', mockFetch)
    await submitEmail('user@example.com')
    expect(mockFetch).toHaveBeenCalledWith('/api/submit-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', firstName: undefined, lastName: undefined }),
    })
  })

  it('posts email + firstName/lastName when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', mockFetch)
    await submitEmail('user@example.com', { firstName: 'Ada', lastName: 'Lovelace' })
    expect(mockFetch).toHaveBeenCalledWith('/api/submit-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', firstName: 'Ada', lastName: 'Lovelace' }),
    })
  })

  it('returns ok:true on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
    const result = await submitEmail('user@example.com')
    expect(result).toEqual({ ok: true })
  })

  it('returns the server error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to subscribe' }),
    }))
    const result = await submitEmail('user@example.com')
    expect(result).toEqual({ ok: false, error: 'Failed to subscribe' })
  })

  it('falls back to a generic error when the server response has no error field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => { throw new Error('not json') },
    }))
    const result = await submitEmail('user@example.com')
    expect(result).toEqual({ ok: false, error: 'Something went wrong' })
  })
})
