import { Hono } from 'hono'
import { cors } from 'hono/cors'
import Anthropic from '@anthropic-ai/sdk'

function getAnthropicKey(): string {
  return process.env['ANTHROPIC_API_KEY'] ?? ''
}

// ── Google OAuth helpers ───────────────────────────────────────────────────────
// Uses plain fetch + Google's token endpoint — no googleapis package needed.
// Scope: tasks.readonly (read-only access to Google Tasks)

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1'
const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks.readonly'

function getGoogleClientId(): string { return process.env['GOOGLE_CLIENT_ID'] ?? '' }
function getGoogleClientSecret(): string { return process.env['GOOGLE_CLIENT_SECRET'] ?? '' }

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

interface GoogleTasksListResponse {
  items?: Array<{
    id: string
    title: string
    due?: string
    status: string
  }>
  nextPageToken?: string
}

interface GoogleTaskListsResponse {
  items?: Array<{ id: string; title: string }>
}

async function fetchAllTasks(accessToken: string): Promise<Array<{
  id: string; title: string; due?: string; status: string; listId: string; listTitle: string
}>> {
  // 1. Get all task lists
  const listsRes = await fetch(`${GOOGLE_TASKS_BASE}/users/@me/lists?maxResults=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!listsRes.ok) throw new Error(`Failed to fetch task lists: ${listsRes.status}`)
  const lists = await listsRes.json() as GoogleTaskListsResponse
  if (!lists.items?.length) return []

  // 2. Fetch non-completed tasks from all lists in parallel
  const allTasks: Array<{
    id: string; title: string; due?: string; status: string; listId: string; listTitle: string
  }> = []

  await Promise.all(lists.items.map(async (list) => {
    const tasksRes = await fetch(
      `${GOOGLE_TASKS_BASE}/lists/${list.id}/tasks?showCompleted=false&maxResults=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!tasksRes.ok) return
    const data = await tasksRes.json() as GoogleTasksListResponse
    for (const task of data.items ?? []) {
      if (task.status === 'completed') continue
      allTasks.push({
        id: task.id,
        title: task.title || '(no title)',
        due: task.due,
        status: task.status,
        listId: list.id,
        listTitle: list.title,
      })
    }
  }))

  return allTasks
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

  // ── Google Tasks OAuth routes ─────────────────────────────────────────────
  // GET /api/google/auth-url — returns the OAuth consent URL for the frontend to redirect to
  currentApp.get('/api/google/auth-url', (c) => {
    const clientId = getGoogleClientId()
    if (!clientId) return c.json({ error: 'Google OAuth not configured' }, 503)

    // Build callback URL from the frontend origin passed as query param (origin header is absent on same-origin GET requests)
    const frontendOrigin = c.req.query('origin') ?? 'https://localhost:5173'
    const redirectBase = process.env['SERVER_BASE_URL'] ?? frontendOrigin
    const redirectUri = `${redirectBase}/api/google/callback`

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: TASKS_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state: encodeURIComponent(frontendOrigin), // carry frontend URL through OAuth flow
    })
    return c.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
  })

  // GET /api/google/callback — exchanges auth code for tokens, redirects back to frontend
  currentApp.get('/api/google/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    if (!code) return c.json({ error: 'Missing code' }, 400)
    const clientId = getGoogleClientId()
    const clientSecret = getGoogleClientSecret()
    if (!clientId || !clientSecret) return c.json({ error: 'Google OAuth not configured' }, 503)

    // Recover frontend origin from state param (set in auth-url route)
    const frontendUrl = state ? decodeURIComponent(state) : 'https://localhost:5173'
    const redirectBase = process.env['SERVER_BASE_URL'] ?? frontendUrl
    const redirectUri = `${redirectBase}/api/google/callback`

    try {
      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        return c.json({ error: `Token exchange failed: ${err}` }, 502)
      }
      const tokens = await res.json() as GoogleTokenResponse
      // Redirect to frontend with token in hash (never in query string — keeps it out of server logs)
      return c.redirect(`${frontendUrl}/#google_token=${encodeURIComponent(tokens.access_token)}&google_refresh=${encodeURIComponent(tokens.refresh_token ?? '')}`)
    } catch (err) {
      return c.json({ error: String(err) }, 500)
    }
  })

  // GET /api/google/tasks — fetches all non-completed tasks for an authenticated user
  currentApp.get('/api/google/tasks', async (c) => {
    const auth = c.req.header('Authorization')
    if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Missing Authorization header' }, 401)
    const accessToken = auth.slice(7)
    try {
      const tasks = await fetchAllTasks(accessToken)
      return c.json({ tasks })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // 401 from Google = token expired
      if (msg.includes('401')) return c.json({ error: 'token_expired' }, 401)
      return c.json({ error: msg }, 500)
    }
  })

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
  serve({ fetch: serverApp.fetch, port: 3001, hostname: '0.0.0.0' }, () => {
    console.log('TaskRoulette server running on port 3001')
  })
}
