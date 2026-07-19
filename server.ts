import { Hono } from 'hono'
import { cors } from 'hono/cors'
import Anthropic from '@anthropic-ai/sdk'

function getAnthropicKey(): string {
  return process.env['ANTHROPIC_API_KEY'] ?? ''
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

  currentApp.post('/api/parse-image', async (c) => {
    try {
      const body = await c.req.json<{ text?: string; imageBase64: string; mimeType: string }>()

      if (!body.imageBase64) {
        return c.json({ error: 'imageBase64 is required' }, 400)
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
      if (!allowedTypes.includes(body.mimeType)) {
        return c.json({ error: `Unsupported image type: ${body.mimeType}` }, 400)
      }

      // Normalize HEIC to JPEG for Claude (Claude doesn't accept image/heic)
      const mediaType = body.mimeType === 'image/heic' ? 'image/jpeg' : body.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

      const textPart = body.text?.trim()
        ? `The user also typed this brain dump:\n"${body.text}"\n\n`
        : ''

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: body.imageBase64 },
            },
            {
              type: 'text',
              text: `${textPart}Extract every concrete, actionable to-do task from the image (and the typed text above, if any).
Rules:
- Include tasks from BOTH the image and the typed text — combine them without duplicates
- Clean up abbreviations and shorthand into full readable tasks
- Skip anything clearly already done (crossed out, checkmark, "✓", past-tense completion)
- Start each task with a verb
- Return ONLY a valid JSON array of strings — no explanation, no markdown, no code blocks
- Example: ["Call dentist", "Email landlord about leak", "Buy groceries"]`,
            },
          ],
        }],
      })

      const content = message.content[0]
      if (content.type !== 'text') return c.json({ error: 'Unexpected response' }, 500)

      const rawText = content.text.replace(/^```[a-z]*\n?/im, '').replace(/\n?```$/m, '').trim()
      const tasks = JSON.parse(rawText) as string[]
      return c.json({ tasks })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Parse-image error:', msg)
      return c.json({ error: msg }, 500)
    }
  })

  currentApp.get('/api/health', (c) => c.json({ ok: true }))

  return currentApp
}

if (process.env['NODE_ENV'] !== 'test') {
  const { serve } = await import('@hono/node-server')
  const serverApp = createApp()
  serve({ fetch: serverApp.fetch, port: 3001 }, () => {
    console.log('TaskRoulette server running on port 3001')
  })
}
