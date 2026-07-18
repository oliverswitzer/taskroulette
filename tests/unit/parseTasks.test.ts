import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseTasks } from '../../src/api'
import { MAX_TASKS } from '../../src/constants'

describe('parseTasks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mockFetchOk(tasks: string[]) {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tasks }),
    })
    vi.stubGlobal('fetch', mockFetch)
    return mockFetch
  }

  function mockFetchError(status: number) {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: async () => ({ error: 'Server error' }),
    })
    vi.stubGlobal('fetch', mockFetch)
    return mockFetch
  }

  it('calls POST /api/parse with correct body', async () => {
    const mockFetch = mockFetchOk(['Buy milk', 'Walk dog'])
    await parseTasks('I need to buy milk and walk the dog')
    expect(mockFetch).toHaveBeenCalledWith('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dump: 'I need to buy milk and walk the dog' }),
    })
  })

  it('returns array of strings from response', async () => {
    mockFetchOk(['Buy milk', 'Walk dog', 'Pay bills'])
    const result = await parseTasks('some brain dump')
    expect(result).toEqual(['Buy milk', 'Walk dog', 'Pay bills'])
  })

  it('throws on non-ok response', async () => {
    mockFetchError(500)
    await expect(parseTasks('some text')).rejects.toThrow('Parse failed: 500')
  })

  it('throws on 400 response', async () => {
    mockFetchError(400)
    await expect(parseTasks('')).rejects.toThrow('Parse failed: 400')
  })

  it(`returns max ${MAX_TASKS} items even if server returns more`, async () => {
    const manyTasks = Array.from({ length: MAX_TASKS + 5 }, (_, i) => `Task ${i}`)
    mockFetchOk(manyTasks)
    const result = await parseTasks('huge brain dump')
    expect(result).toHaveLength(MAX_TASKS)
  })

  it('returns fewer than MAX_TASKS if server returns fewer', async () => {
    mockFetchOk(['Only one task'])
    const result = await parseTasks('just one thing')
    expect(result).toHaveLength(1)
  })
})
