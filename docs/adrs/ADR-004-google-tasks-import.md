# ADR-004: Google Tasks Import

**Status:** Shipped (spike/google-tasks → main)
**Date:** 2025-01

---

## Context

Users already have tasks in Google Tasks. Forcing them to re-enter everything via voice dump creates friction before their first win. Adding a one-tap import path lowers the barrier to first engagement.

---

## Decision

Add a Google Tasks import flow behind a **Beta waitlist gate** rather than shipping OAuth live to all users. Reasons:

1. Google OAuth requires production verification for sensitive scopes — not worth the friction for MVP
2. Gathering beta emails lets us measure real demand before investing in verification
3. The infra (Loops, email gate) already exists — reuse it

---

## How it works

### Frontend (dev/future)
- `useGoogleTasks` hook — OAuth state machine, token cache in `localStorage`, fetch + sort tasks by due date, mock fallback when `GOOGLE_CLIENT_ID` unset
- `GoogleTasksSheet` — bottom sheet (88svh, 480px max-width), dot capacity meter, due-date grouped list with "show more" pagination
- `BetaSignupModal` — slide-up email capture, same structure as `EmailGateModal`, distinct copy ("Join the Google Tasks beta")

### Button UX
- "Import from Google Tasks" button on `ListEditScreen`
- Orange **Beta** pill badge floats top-right of button
- Clicking either the button *or* the badge opens `BetaSignupModal`
- Email submitted → Loops contact created → success state → modal closes

### Backend (ready for when OAuth goes live)
- `GET /api/google/auth-url` — builds consent URL; frontend passes `?origin=window.location.origin` so the callback URI is host-aware (Tailscale vs localhost vs prod)
- `GET /api/google/callback` — exchanges code, stores tokens, redirects to frontend origin with token in hash fragment (kept out of server logs)
- `GET /api/google/tasks` — fetches all incomplete tasks for the authed user

---

## Key technical decisions

### `window.location.origin` as query param (not `origin` header)
Browsers omit the `origin` header on same-origin GET requests. Without it, the server can't tell whether the request came from `localhost:5173` or the Tailscale hostname. Solution: frontend sends `?origin=encodeURIComponent(window.location.origin)` and the server builds `redirectUri = origin + '/api/google/callback'`.

### Vite proxy eliminates port confusion
`/api/*` is proxied from `:5173` → `:3001` in dev. This means redirect URIs registered in Google Cloud Console are all on `:5173` (matching prod on Vercel). No port-swap logic needed. Google Console needs exactly three URIs:
```
https://localhost:5173/api/google/callback
https://clawlivers-mac-mini.tail60e2f.ts.net:5173/api/google/callback
https://taskroulette.vercel.app/api/google/callback
```

### Hono binds to `0.0.0.0`
Without `hostname: '0.0.0.0'`, Hono defaults to `127.0.0.1` and Tailscale traffic is dropped before it reaches the server.

### Token storage in localStorage
Access + refresh tokens stored under `trGoogleToken` / `trGoogleRefresh`. Refresh is attempted automatically on 401. Acceptable for MVP; move to httpOnly cookies if security requirements increase.

**Update (2026-08):** the OAuth flow actually shipped is Supabase Auth (see `2511fdd` swap), not the hand-rolled `/api/google/*` flow described above — `useGoogleTasks` gets `provider_token`/`provider_refresh_token` from Supabase's `onAuthStateChange`. Supabase's docs are explicit that these two fields are emitted **only once**, immediately after sign-in — they are NOT re-included on later `getSession()` calls or Supabase's own automatic JWT refresh. The original implementation never persisted `provider_refresh_token`, so once the ~1hr Google access token expired there was no recovery path except sending the user through full Google consent again (the "have to re-auth every day" bug). Fix: `useGoogleTasks` now persists `provider_refresh_token` to `localStorage['trGoogleRefreshToken']` the one time Supabase emits it, and a new backend endpoint `POST /api/google/refresh-token` (holds `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, exchanges the refresh token with `https://oauth2.googleapis.com/token`) mints a fresh access token whenever a Google Tasks call 401s. Only a genuinely dead/revoked refresh token (Google returns `invalid_grant`, surfaced to the frontend as 401) falls back to the login screen. `login()` also now always passes `prompt: 'consent'` (was already doing so) — required because Google silently omits `provider_refresh_token` on repeat authorizations unless consent is re-shown each time.

### Mock mode
If `GOOGLE_CLIENT_ID` is not set (local dev without credentials), the hook returns a static set of mock tasks. The full UI is testable without credentials.

---

## Consequences

- **Beta emails collected** in Loops alongside newsletter subscribers — segment them by source if needed
- **No OAuth scope review** required until beta opens — lower launch risk
- `GoogleTasksSheet` and `useGoogleTasks` are production-ready; the only gate is the Beta modal intercept in `ListEditScreen`
- When ready to open: swap `setShowBetaModal(true)` back to `setShowGoogleSheet(true)` and complete Google OAuth verification
