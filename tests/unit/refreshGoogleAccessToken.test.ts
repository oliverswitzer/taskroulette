import { describe, it, expect, vi, afterEach } from 'vitest'
import { refreshGoogleAccessToken } from '../../src/api'

describe('refreshGoogleAccessToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the refresh token and returns the fresh access token on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'fresh-token', expiresIn: 3599 }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await refreshGoogleAccessToken('my-refresh-token')

    expect(mockFetch).toHaveBeenCalledWith('/api/google/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'my-refresh-token' }),
    })
    expect(result).toEqual({ ok: true, accessToken: 'fresh-token', expiresIn: 3599 })
  })

  it('marks expired:true when the server returns 401 (refresh token itself is dead)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Failed to refresh Google access token' }),
    }))
    const result = await refreshGoogleAccessToken('dead-token')
    expect(result).toEqual({ ok: false, error: 'Failed to refresh Google access token', expired: true })
  })

  it('marks expired:false for a transient (non-401) server failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'Failed to refresh Google access token' }),
    }))
    const result = await refreshGoogleAccessToken('some-token')
    expect(result).toEqual({ ok: false, error: 'Failed to refresh Google access token', expired: false })
  })

  it('falls back to a generic error when the server response has no error field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json') },
    }))
    const result = await refreshGoogleAccessToken('some-token')
    expect(result).toEqual({ ok: false, error: 'Failed to refresh Google session', expired: false })
  })
})
