export async function parseTasks(dump: string): Promise<string[]> {
  const response = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dump }),
  })

  if (!response.ok) {
    throw new Error(`Parse failed: ${response.status}`)
  }

  const data = (await response.json()) as { tasks: string[] }
  // No cap here — the LIST_EDIT screen is the right place to manage task count
  return data.tasks
}

export async function parseTasksFromImage(
  imageBase64: string,
  mimeType: string,
  text?: string,
): Promise<string[]> {
  const response = await fetch('/api/parse-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType, text }),
  })

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Parse-image failed: ${response.status}`)
  }

  const data = (await response.json()) as { tasks: string[] }
  return data.tasks
}

export type SessionStatus = {
  allowed: boolean
  count: number
  limit: number
  hasEmail: boolean
  reason?: 'come_back_tomorrow' | 'needs_email'
}

export async function getSessionStatus(): Promise<SessionStatus> {
  const res = await fetch('/api/session-status')
  if (!res.ok) {
    // If server is unreachable, allow — don't block the user for infra issues
    return { allowed: true, count: 0, limit: 3, hasEmail: false }
  }
  return res.json() as Promise<SessionStatus>
}

export async function recordSessionComplete(): Promise<void> {
  await fetch('/api/session-complete', { method: 'POST' }).catch(() => {})
}

export async function submitEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/submit-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'Something went wrong' }
  }
  return { ok: true }
}
