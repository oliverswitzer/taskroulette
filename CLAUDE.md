# TaskRoulette — Agent Instructions

> Read this file before making any changes to this repo.
> For full architecture, decisions, and gotchas → `docs/adrs/ADR-001-implementation-overview.md`

---

## ⛔ DEFINITION OF DONE — NEVER declare a feature complete without ALL of these:

1. `npm run typecheck` — zero errors
2. `npm run lint` — zero warnings, zero errors
3. `npm run test` — all unit/component tests pass
4. `npx playwright test --project=mobile` — all 23 E2E tests pass **locally**
5. Push to main → watch CI at https://github.com/oliverswitzer/taskroulette/actions → confirm **green**
6. CI green = Vercel deploy fired → confirm prod URL responds at https://taskroulette.vercel.app

**Do not tell the user a feature is done until step 6 is confirmed. No exceptions.**

---

## MANDATORY: Run `npm run check` before every commit

```bash
npm run check
# = typecheck + lint + unit tests + E2E tests (real Anthropic API)
```

This is a hard gate. Do not commit if any step fails. Do not skip E2E.

Individual steps if you need them:
```bash
npm run typecheck   # tsc --noEmit
npm run lint        # oxlint . — must be 0 warnings, 0 errors
npm run test        # vitest unit + component
npm run test:e2e    # playwright (both mobile + desktop projects)
```

### Starting the servers (required for E2E)

```bash
# Terminal 1 — Hono backend (reads ANTHROPIC_API_KEY from ~/.envrc)
source ~/.envrc && npm run server

# Terminal 2 — Vite frontend (Tailscale accessible)
npm run dev
```

Playwright's `reuseExistingServer: true` means it won't double-start if they're already running.

---

## Top 5 traps — read these before touching anything

**1. Vite + Tailscale** — `vite.config.ts` must have `allowedHosts: ['clawlivers-mac-mini.tail60e2f.ts.net']`. Without it, the Tailscale URL returns a blank 403 for all assets. Already set — don't remove it.

**2. Canvas ≠ OKLCH** — `ctx.fillStyle = 'oklch(...)'` silently falls back to black. `WheelCanvas.tsx` uses pre-computed hex values. Keep them hex.

**3. React StrictMode kills setTimeout in useEffect cleanups** — the `autoSpinSignal` counter pattern in `WheelScreen.tsx` exists specifically to avoid this. Don't replace it with a `setTimeout`.

**4. `useWheelPhysics` uses refs, not state, in the RAF loop** — prevents stale closure infinite spin in headless/Playwright. Don't convert to `useState` inside the animation loop.

**5. localStorage transient states** — `loadAppState()` in `storage.ts` remaps `WHEEL_SPINNING → WHEEL_IDLE`, `TASK_CARD → WHEEL_IDLE`, `PARSING → DUMP` on cold boot. Don't remove this — blank screen on reload.

---

## Key files

| File | What it does |
|---|---|
| `server.ts` | Hono backend — `/api/parse` (text), `/api/parse-image` (Claude vision), `/api/health` |
| `src/App.tsx` | State machine. All screen transitions live here. |
| `src/storage.ts` | localStorage with transient-state sanitization |
| `src/components/DumpScreen.tsx` | Textarea + photo attach (react-dropzone + shadcn Dialog) |
| `src/components/WheelScreen.tsx` | Wheel UI. `autoSpinSignal` prop triggers auto-spin safely. |
| `src/components/WheelCanvas.tsx` | 2D canvas wheel — uses hex colors, NOT oklch |
| `src/audio.ts` | Real WAV click samples (base64 embedded) + iOS MediaStream routing. See ADR-002. |
| `src/hooks/useWheelPhysics.ts` | Ref-based RAF physics. Never use setState in the loop. |
| `tests/e2e/real-api.spec.ts` | E2E hitting real Anthropic API — text parse, vision, combined, full flow |
| `tests/e2e/fixtures/task-list.png` | Fixture image used by vision E2E tests |
| `docs/adrs/ADR-001-implementation-overview.md` | Full architecture reference |

## App state machine

```
DUMP → PARSING → LIST_EDIT → WHEEL_IDLE → WHEEL_SPINNING → TASK_CARD
                                ↑                               ↓ (complete)
                                └───────────── WHEEL_IDLE ←────┘
                                                   ↓ (all done)
                                              ALL_DONE → DUMP
```

Transient states (`PARSING`, `WHEEL_SPINNING`, `TASK_CARD`) are never restored from localStorage.

## Lint rules

`oxlint` — configured to 0 warnings, 0 errors. Rules enforced:
- No unused variables (prefix with `_` if intentionally unused)
- No unused imports
- React fast-refresh: don't `export` non-component values from component files — put them in `constants.ts`

## Tech stack

- Vite 8 + React 19 + TypeScript (strict)
- Hono backend on `:3001`, Vite proxies `/api/*`
- Tailwind v4 (shadcn only — don't convert existing inline styles)
- shadcn Dialog (photo onboarding only — `src/components/ui/dialog.tsx`)
- react-dropzone (photo attach on DumpScreen)
- canvas-confetti (AllDoneScreen + TaskCard completion)
- framer-motion (page transitions, task card spring)
- Vitest + React Testing Library (unit/component)
- Playwright (E2E, mobile 375px + desktop 1280px, chromium only — webkit not installed)
