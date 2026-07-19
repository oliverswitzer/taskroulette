# ADR-003: Vercel Deployment — Frontend + Serverless API

**Date:** 2026-07-18  
**Status:** Accepted  
**Author:** Hermes Agent

---

## Context

TaskRoulette was initially built to run locally: Vite dev server on `:5173` and a Hono Node.js backend on `:3001`, accessed via Tailscale at `https://clawlivers-mac-mini.tail60e2f.ts.net:5173`. This worked for development and personal testing but required the Mac mini to be running and reachable over Tailscale.

The goal was to deploy a publicly accessible production URL so any device (especially iPhone) could use the app without Tailscale, and so the app could be shared with others.

---

## Decision

Deploy to **Vercel Hobby tier** (free), using:

- **Frontend:** Vercel static hosting for the Vite + PWA build output (`dist/`)
- **Backend:** Vercel Node.js serverless function for the Hono API (`api/index.ts`)
- **API key:** `ANTHROPIC_API_KEY` stored as a Vercel environment secret (Production only)

---

## Architecture

```
Browser / iPhone
      │
      ▼
https://taskroulette.vercel.app
      │
      ├── GET  /          → dist/index.html  (static Vite PWA build)
      ├── GET  /assets/*  → dist/assets/*    (JS, CSS, fonts)
      ├── GET  /sw.js     → dist/sw.js       (Workbox service worker)
      │
      └── POST /api/*     → api/index.ts     (Vercel Node.js serverless fn)
                                │
                                ▼
                        server.ts:createApp()  (Hono router)
                                │
                                ▼
                        Anthropic API (claude-haiku-4-5)
```

### Key files added

| File | Purpose |
|---|---|
| `api/index.ts` | Vercel serverless entry point — bridges Node `req/res` → Hono Web fetch API |
| `vercel.json` | Routes `/api/*` to the serverless function; sets build command + output dir |
| `playwright.vercel.config.ts` | Playwright config to run E2E suite against the live Vercel URL |

---

## Implementation — Three Iterations

### Attempt 1: `hono/vercel` adapter + default runtime

Used `handle()` from `hono/vercel` as the default export.

**Failed with:** `TypeError: this.raw.headers.get is not a function`

**Root cause:** Vercel's default Node.js runtime passes `IncomingMessage/ServerResponse` (Node.js `req/res`), but `hono/vercel`'s `handle()` expects the Web Fetch API `Request` object. Vercel only provides that on the **edge runtime**.

---

### Attempt 2: Edge runtime (`export const config = { runtime: 'edge' }`)

Switched `api/index.ts` to use edge runtime so Vercel would pass a Web `Request`.

**Failed with:** `The Edge Function "api/index" is referencing unsupported modules: @anthropic-ai: node:fs, node:path / @hono: node:http, node:http2, node:stream`

**Root cause:** The Anthropic Node.js SDK uses `node:fs` and `node:path` internally. Vercel edge functions run in a V8 isolate with no Node.js built-ins — incompatible with the SDK.

---

### Attempt 3: Node.js runtime + manual Web Request bridge ✅

Kept the **Node.js runtime** (default) but manually constructed a Web `Request` from the Node `IncomingMessage`, called `app.fetch(webReq)`, then wrote the Web `Response` back to `ServerResponse`.

```typescript
// api/index.ts
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createApp } from '../server.js'

export const config = { maxDuration: 30 }

const app = createApp()

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const bodyBuf = Buffer.concat(chunks)

  const host = (req.headers.host ?? 'localhost') as string
  const url = `https://${host}${req.url ?? '/'}`

  const webReq = new Request(url, {
    method: req.method ?? 'GET',
    headers: req.headers as Record<string, string>,
    body: bodyBuf.length > 0 ? bodyBuf : undefined,
  })

  const webRes = await app.fetch(webReq)

  res.statusCode = webRes.status
  for (const [key, val] of webRes.headers.entries()) res.setHeader(key, val)
  res.end(Buffer.from(await webRes.arrayBuffer()))
}
```

This works because Hono's `createApp()` returns a standard Hono instance whose `.fetch()` method accepts a Web `Request` — it's not adapter-specific.

---

### `server.ts` changes

Removed the `~/.envrc` file reader from `getAnthropicKey()`. In production (Vercel), the key comes from `process.env.ANTHROPIC_API_KEY`. Locally, the `npm run server` script sources `~/.envrc` before starting, so the env var is already set.

Also moved the local-only `@hono/node-server` `serve()` call to a dynamic import so `server.ts` can be imported by `api/index.ts` without pulling `@hono/node-server` into the Vercel bundle:

```typescript
if (process.env['NODE_ENV'] !== 'test') {
  const { serve } = await import('@hono/node-server')  // dynamic — not bundled on Vercel
  serve({ fetch: app.fetch, port: 3001 }, () => { ... })
}
```

---

## `vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" }
  ]
}
```

All `/api/*` traffic is rewritten to the single serverless function. The frontend's Vite proxy (`/api → localhost:3001`) is irrelevant in production — Vercel's router handles the routing natively.

---

## E2E Against Vercel

Added `playwright.vercel.config.ts` — identical to the standard config but:
- `baseURL: 'https://taskroulette.vercel.app'`
- No `webServer` block (Vercel is already running)
- `retries: 1` (network latency tolerance)

Run with:
```bash
npx playwright test --config=playwright.vercel.config.ts
```

---

## Consequences

### Positive
- **Zero cost** — Vercel Hobby tier covers all usage for a personal/small-team app
- **Public URL** — shareable without Tailscale; works on any device, any network
- **Real HTTPS** — Vercel's cert, trusted by iOS out of the box
- **PWA installable** — service worker + manifest served correctly over HTTPS
- **Auto-deploy** — Vercel connected to GitHub; pushes to `main` trigger deploys automatically
- **Anthropic key is secret** — stored as a Vercel sensitive env var, never in source

### Negative / Tradeoffs
- **Cold starts** — first request after inactivity may take 1–3s. Acceptable for this use case.
- **30s function limit** — Vercel Hobby functions timeout at 30s. Claude Haiku typically responds in 2–5s so this is not a concern, but large image uploads could approach the limit.
- **No persistent state** — serverless functions are stateless. TaskRoulette has no server-side state (localStorage only), so this is fine.
- **Local dev unchanged** — local workflow (Tailscale + `npm run server` + `npm run dev`) still works identically. The only behavioral difference is `getAnthropicKey()` no longer reads `~/.envrc` directly — the calling script must source it first (which `npm run server` already does).

---

## Rejected Alternatives

| Option | Reason rejected |
|---|---|
| `hono/vercel` adapter (default runtime) | Requires edge runtime; Anthropic SDK needs Node.js |
| Vercel edge runtime | Anthropic SDK uses `node:fs`/`node:path` — incompatible |
| Railway / Fly.io | Persistent process hosting, more complex, not free tier |
| `netlify drop` | Frontend only; no serverless function support for the Hono API |

---

## Deployment Commands

```bash
# First deploy (interactive login required)
/usr/local/opt/vercel-cli/bin/vercel login
/usr/local/opt/vercel-cli/bin/vercel --prod --scope olivers-projects-0c5c4e7e

# Subsequent deploys (GitHub auto-deploy handles this, but manual option):
/usr/local/opt/vercel-cli/bin/vercel --prod --scope olivers-projects-0c5c4e7e

# Set/rotate API key
/usr/local/opt/vercel-cli/bin/vercel env add ANTHROPIC_API_KEY production --scope olivers-projects-0c5c4e7e

# Run E2E against production
npx playwright test --config=playwright.vercel.config.ts

# Health check
curl https://taskroulette.vercel.app/api/health
```

---

## URLs

| Environment | URL |
|---|---|
| Production | https://taskroulette.vercel.app |
| Vercel dashboard | https://vercel.com/olivers-projects-0c5c4e7e/taskroulette |
| Local (Tailscale) | https://clawlivers-mac-mini.tail60e2f.ts.net:5173 |
| Local (direct) | https://localhost:5173 |
