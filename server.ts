import { Hono } from 'hono'
import { cors } from 'hono/cors'
import Anthropic from '@anthropic-ai/sdk'

function getAnthropicKey(): string {
  return process.env['ANTHROPIC_API_KEY'] ?? ''
}

const anthropic = new Anthropic({ apiKey: getAnthropicKey() })

// ── Session limit tracker (in-memory, IP-based) ───────────────────────────────
// Resets on server restart — intentional for MVP. Stops casual abuse.
// 1 free session without email, 3/day once email submitted.

type IpRecord = {
  date: string       // YYYY-MM-DD UTC
  count: number      // completed sessions today
  hasEmail: boolean
  email?: string     // stored to check unlimited list
}

const ipRecords = new Map<string, IpRecord>()

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function getRecord(ip: string): IpRecord {
  const today = todayUTC()
  const rec = ipRecords.get(ip)
  if (!rec || rec.date !== today) {
    const fresh: IpRecord = { date: today, count: 0, hasEmail: rec?.hasEmail ?? false, email: rec?.email }
    ipRecords.set(ip, fresh)
    return fresh
  }
  return rec
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClientIp(c: any): string {
  return (
    (c.req.header('x-forwarded-for') ?? '').split(',')[0].trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  )
}

const FREE_LIMIT = 1
const EMAIL_LIMIT = 4
const UNLIMITED_EMAILS = new Set(['oliverswitzer@gmail.com'])

function extractTasks(text: string): string[] {
  const raw = text.replace(/^```[a-z]*\n?/im, '').replace(/\n?```$/m, '').trim()
  return JSON.parse(raw) as string[]
}

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

      return c.json({ tasks: extractTasks(content.text).slice(0, 15) })
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

      return c.json({ tasks: extractTasks(content.text) })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Parse-image error:', msg)
      return c.json({ error: msg }, 500)
    }
  })

  currentApp.get('/api/health', (c) => c.json({ ok: true }))

  // ── Session limit endpoints ───────────────────────────────────────────────

  // Called when AllDoneScreen mounts — increments completed session count for IP
  currentApp.post('/api/session-complete', (c) => {
    const ip = getClientIp(c)
    const rec = getRecord(ip)
    rec.count++
    ipRecords.set(ip, rec)
    const limit = rec.hasEmail ? EMAIL_LIMIT : FREE_LIMIT
    return c.json({ count: rec.count, limit, hasEmail: rec.hasEmail })
  })

  // Called before submitting dump — lets frontend know if user can start a session
  currentApp.get('/api/session-status', (c) => {
    const ip = getClientIp(c)
    const rec = getRecord(ip)
    const unlimited = rec.email && UNLIMITED_EMAILS.has(rec.email)
    const limit = rec.hasEmail ? EMAIL_LIMIT : FREE_LIMIT
    const allowed = unlimited || rec.count < limit
    const reason = !allowed ? (rec.hasEmail ? 'come_back_tomorrow' : 'needs_email') : undefined
    return c.json({ allowed, count: rec.count, limit, hasEmail: rec.hasEmail, reason })
  })

  // Called when user submits email — adds to Loops, unlocks 3/day for IP
  currentApp.post('/api/submit-email', async (c) => {
    try {
      const body = await c.req.json<{ email: string }>()
      if (!body.email?.trim()) return c.json({ error: 'email required' }, 400)

      const loopsKey = process.env['LOOPS_API_KEY']
      if (!loopsKey) return c.json({ error: 'Loops not configured' }, 500)

      const res = await fetch('https://app.loops.so/api/v1/contacts/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${loopsKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: body.email.trim(),
          source: 'taskreoulette-app',
          userGroup: 'adhd-founder-builds',
        }),
      })

      if (!res.ok && res.status !== 409) {
        // 409 = already exists — that's fine, still mark hasEmail
        const text = await res.text()
        console.error('Loops error:', res.status, text)
        return c.json({ error: 'Failed to subscribe' }, 502)
      }

      // Mark IP as having submitted email — persists across daily resets
      const ip = getClientIp(c)
      const rec = getRecord(ip)
      rec.hasEmail = true
      rec.email = body.email.trim()
      ipRecords.set(ip, rec)

      return c.json({ ok: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('submit-email error:', msg)
      return c.json({ error: msg }, 500)
    }
  })

  return currentApp
}

if (process.env['NODE_ENV'] !== 'test') {
  const { serve } = await import('@hono/node-server')
  const serverApp = createApp()
  serve({ fetch: serverApp.fetch, port: 3001 }, () => {
    console.log('TaskRoulette server running on port 3001')
  })
}
