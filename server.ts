import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'node:fs'
import * as path from 'node:path'

function getAnthropicKey(): string {
  const envrcPath = path.join(process.env['HOME'] || '', '.envrc')
  try {
    const content = fs.readFileSync(envrcPath, 'utf8')
    const match = content.match(/ANTHROPIC_API_KEY=["']?([^"'\n]+)["']?/)
    return match?.[1]?.trim() ?? ''
  } catch {
    return process.env['ANTHROPIC_API_KEY'] ?? ''
  }
}

const anthropic = new Anthropic({ apiKey: getAnthropicKey() })

export function createApp() {
  const currentApp = new Hono()

  currentApp.use('/*', cors({ origin: '*' }))

  currentApp.post('/api/parse', async (c) => {
    try {
      const body = await c.req.json<{ dump: string }>()
      
      if (!body.dump?.trim()) {
        return c.json({ error: 'No dump provided' }, 400)
      }

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are a supportive assistant for someone with ADHD.
Extract a concrete, actionable task list from this brain dump.
Return ONLY a valid JSON array of strings -- no explanation, no markdown, no code blocks.
Rules:
- Each task: concise (under 8 words), actionable, specific
- Maximum 15 tasks (prioritize the most important if more are implied)
- Start each task with a verb
- No duplicates

Brain dump: "${body.dump}"`
        }]
      })

      const content = message.content[0]
      if (content.type !== 'text') return c.json({ error: 'Unexpected response' }, 500)

      // Strip markdown code fences if present (some models add ```json ... ```)
      const rawText = content.text.replace(/^```[a-z]*\n?/im, '').replace(/\n?```$/m, '').trim()
      const tasks = JSON.parse(rawText) as string[]
      return c.json({ tasks: tasks.slice(0, 15) })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('Parse error:', message)
      return c.json({ error: message }, 500)
    }
  })

  currentApp.get('/api/health', (c) => c.json({ ok: true }))

  return currentApp
}

if (process.env['NODE_ENV'] !== 'test') {
  const serverApp = createApp()
  serve({ fetch: serverApp.fetch, port: 3001 }, () => {
    console.log('TaskRoulette server running on port 3001')
  })
}
