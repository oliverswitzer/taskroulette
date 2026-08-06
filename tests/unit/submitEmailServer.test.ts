// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp } from '../../server'

describe('POST /api/submit-email', () => {
  const ORIGINAL_LOOPS_KEY = process.env['LOOPS_API_KEY']

  beforeEach(() => {
    process.env['LOOPS_API_KEY'] = 'test-loops-key'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env['LOOPS_API_KEY'] = ORIGINAL_LOOPS_KEY
  })

  function mockLoopsResponse(status: number, body: unknown = {}) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
      json: async () => body,
    }))
  }

  it('rejects when email is missing', async () => {
    const app = createApp()
    const res = await app.request('/api/submit-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'email required' })
  })

  it('rejects when email is blank/whitespace', async () => {
    const app = createApp()
    const res = await app.request('/api/submit-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '   ' }),
    })
    expect(res.status).toBe(400)
  })

  it('calls Loops with email + firstName + lastName when all provided', async () => {
    mockLoopsResponse(200)
    const app = createApp()
    const res = await app.request('/api/submit-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const [url, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://app.loops.so/api/v1/contacts/create')
    const sentBody = JSON.parse(options.body as string)
    expect(sentBody).toMatchObject({ email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' })
  })

  it('calls Loops with email only when no name is given (email-gate fallback path)', async () => {
    mockLoopsResponse(200)
    const app = createApp()
    const res = await app.request('/api/submit-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'noname@example.com' }),
    })
    expect(res.status).toBe(200)

    const [, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const sentBody = JSON.parse(options.body as string)
    expect(sentBody).not.toHaveProperty('firstName')
    expect(sentBody).not.toHaveProperty('lastName')
  })

  it('treats a 409 (contact already exists) from Loops as success', async () => {
    mockLoopsResponse(409)
    const app = createApp()
    const res = await app.request('/api/submit-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'existing@example.com' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns 502 when Loops fails with a non-409 error', async () => {
    mockLoopsResponse(500, { error: 'server exploded' })
    const app = createApp()
    const res = await app.request('/api/submit-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fail@example.com' }),
    })
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'Failed to subscribe' })
  })

  it('returns 500 when LOOPS_API_KEY is not configured', async () => {
    delete process.env['LOOPS_API_KEY']
    const app = createApp()
    const res = await app.request('/api/submit-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Loops not configured' })
  })
})
