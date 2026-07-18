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
