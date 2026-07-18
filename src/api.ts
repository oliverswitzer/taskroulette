import { MAX_TASKS } from './constants'

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
  return data.tasks.slice(0, MAX_TASKS)
}
