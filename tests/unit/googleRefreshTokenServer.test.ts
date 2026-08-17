// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp } from '../../server'

describe('POST /api/google/refresh-token', () => {
  const ORIGINAL_CLIENT_ID = process.env['GOOGLE_CLIENT_ID']
  const ORIGINAL_CLIENT_SECRET = process.env['GOOGLE_CLIENT_SECRET']

  beforeEach(() => {
    process.env['GOOGLE_CLIENT_ID'] = 'test-client-id'
    process.env['GOOGLE_CLIENT_SECRET'] = 'test-client-secret'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env['GOOGLE_CLIENT_ID'] = ORIGINAL_CLIENT_ID
    process.env['GOOGLE_CLIENT_SECRET'] = ORIGINAL_CLIENT_SECRET
  })

  function mockGoogleTokenResponse(status: number, body: unknown = {}) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
      json: async () => body,
    }))
  }

  it('rejects when refreshToken is missing', async () => {
    const app = createApp()
    const res = await app.request('/api/google/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'refreshToken required' })
  })

  it('rejects when refreshToken is blank/whitespace', async () => {
    const app = createApp()
    const res = await app.request('/api/google/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: '   ' }),
    })
    expect(res.status).toBe(400)
  })

  it('exchanges a valid refresh token for a fresh access token', async () => {
    mockGoogleTokenResponse(200, { access_token: 'fresh-access-token', expires_in: 3599 })
    const app = createApp()
    const res = await app.request('/api/google/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'refresh-abc' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ accessToken: 'fresh-access-token', expiresIn: 3599 })

    const [url, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    const sentBody = new URLSearchParams(options.body as string)
    expect(sentBody.get('client_id')).toBe('test-client-id')
    expect(sentBody.get('client_secret')).toBe('test-client-secret')
    expect(sentBody.get('refresh_token')).toBe('refresh-abc')
    expect(sentBody.get('grant_type')).toBe('refresh_token')
  })

  it('returns 401 (not 502) when Google rejects the refresh token as invalid_grant', async () => {
    mockGoogleTokenResponse(400, { error: 'invalid_grant' })
    const app = createApp()
    const res = await app.request('/api/google/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'dead-token' }),
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Failed to refresh Google access token' })
  })

  it('returns 502 for a transient Google-side failure (not the client\'s fault)', async () => {
    mockGoogleTokenResponse(503, { error: 'backend unavailable' })
    const app = createApp()
    const res = await app.request('/api/google/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'refresh-abc' }),
    })
    expect(res.status).toBe(502)
  })

  it('returns 500 when Google OAuth credentials are not configured', async () => {
    delete process.env['GOOGLE_CLIENT_ID']
    delete process.env['GOOGLE_CLIENT_SECRET']
    const app = createApp()
    const res = await app.request('/api/google/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'refresh-abc' }),
    })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Google OAuth not configured' })
  })
})
