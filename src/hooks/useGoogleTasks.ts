/**
 * useGoogleTasks — manages Google OAuth via Supabase Auth + direct Google Tasks API calls.
 *
 * Flow:
 * 1. signInWithOAuth({ provider: 'google', scopes: tasks.readonly }) → Supabase handles OAuth
 * 2. On return, Supabase emits session.provider_token (Google access token, ~1hr) and
 *    session.provider_refresh_token (long-lived) via onAuthStateChange — but ONLY ONCE,
 *    right after sign-in. Supabase's own docs call this out explicitly: these two fields
 *    are not re-emitted on subsequent getSession() calls or automatic Supabase JWT
 *    refreshes, so the caller is expected to persist them itself.
 * 3. This hook persists provider_refresh_token to localStorage on that one emission, and
 *    uses it (via the /api/google/refresh-token backend endpoint, which holds the Google
 *    OAuth client secret) to mint a fresh access token whenever a Google Tasks API call
 *    comes back 401 — instead of forcing the user through full Google consent again.
 *    Previously nothing persisted the refresh token, so once the ~1hr access token in
 *    Supabase's in-memory/localStorage session expired, there was no recovery path other
 *    than re-authing with Google from scratch.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import type { GoogleTask, GoogleAuthState } from '../types'
import { sortTasksByDue } from '../googleTasks'
import { supabase } from '../lib/supabase'
import { submitEmail, refreshGoogleAccessToken } from '../api'
import { TR_EMAIL_KEY } from '../constants'

const GOOGLE_TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1'

// localStorage key for the long-lived Google OAuth refresh token — see the
// module doc comment above for why we persist this ourselves rather than
// relying on Supabase's session object.
const GOOGLE_REFRESH_TOKEN_KEY = 'trGoogleRefreshToken'

interface GoogleTasksListResponse {
  items?: Array<{ id: string; title: string; due?: string; status: string }>
  nextPageToken?: string
}
interface GoogleTaskListsResponse {
  items?: Array<{ id: string; title: string }>
}

// Google user_metadata on the Supabase session — full_name/given_name/family_name are
// populated straight from the Google OAuth response, no extra API call needed.
export interface GoogleUserMetadata {
  full_name?: string
  name?: string
  given_name?: string
  family_name?: string
}

export function splitName(meta: GoogleUserMetadata): { firstName?: string; lastName?: string } {
  if (meta.given_name || meta.family_name) {
    return { firstName: meta.given_name, lastName: meta.family_name }
  }
  const full = (meta.full_name ?? meta.name ?? '').trim()
  if (!full) return {}
  const [firstName, ...rest] = full.split(/\s+/)
  return { firstName, lastName: rest.length ? rest.join(' ') : undefined }
}

// Fire-and-forget: submit the Google-verified email + name to Loops once per browser,
// so the email gate never has to ask a user who already signed in with Google.
export async function syncGoogleContactToLoops(email: string | undefined, meta: GoogleUserMetadata): Promise<void> {
  if (!email || localStorage.getItem(TR_EMAIL_KEY)) return
  const { firstName, lastName } = splitName(meta)
  const result = await submitEmail(email, { firstName, lastName })
  if (result.ok) localStorage.setItem(TR_EMAIL_KEY, email)
}

// Thrown when a Google Tasks API call 401s — signals the caller to try a
// token refresh rather than treating this as a generic fetch failure.
class GoogleAuthExpiredError extends Error {
  constructor() {
    super('Google access token expired')
    this.name = 'GoogleAuthExpiredError'
  }
}

async function fetchAllGoogleTasks(accessToken: string): Promise<GoogleTask[]> {
  const listsRes = await fetch(`${GOOGLE_TASKS_BASE}/users/@me/lists?maxResults=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (listsRes.status === 401) throw new GoogleAuthExpiredError()
  if (!listsRes.ok) throw new Error(`Failed to fetch task lists: ${listsRes.status}`)
  const lists = await listsRes.json() as GoogleTaskListsResponse
  if (!lists.items?.length) return []

  const allTasks: GoogleTask[] = []
  await Promise.all(lists.items.map(async (list) => {
    const res = await fetch(
      `${GOOGLE_TASKS_BASE}/lists/${list.id}/tasks?showCompleted=false&maxResults=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (res.status === 401) throw new GoogleAuthExpiredError()
    if (!res.ok) return
    const data = await res.json() as GoogleTasksListResponse
    for (const task of data.items ?? []) {
      if (task.status === 'completed') continue
      allTasks.push({
        id: task.id,
        title: task.title || '(no title)',
        due: task.due,
        status: task.status as 'needsAction',
        listId: list.id,
        listTitle: list.title,
      })
    }
  }))
  return allTasks
}

interface UseGoogleTasksReturn {
  authState: GoogleAuthState
  tasks: GoogleTask[]
  isLoading: boolean
  error: string | null
  isMockMode: false
  login: () => Promise<void>
  logout: () => void
  refetch: () => Promise<void>
}

export function useGoogleTasks(): UseGoogleTasksReturn {
  const [authState, setAuthState] = useState<GoogleAuthState>('idle')
  const [tasks, setTasks] = useState<GoogleTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Persisted Google OAuth refresh token — see module doc comment. Mirrored
  // into a ref (not just localStorage) so the fetch/refresh path always
  // reads the latest value synchronously without a storage round-trip.
  const refreshTokenRef = useRef<string | null>(
    typeof localStorage !== 'undefined' ? localStorage.getItem(GOOGLE_REFRESH_TOKEN_KEY) : null
  )

  const persistRefreshToken = useCallback((token: string | null | undefined) => {
    if (!token) return
    refreshTokenRef.current = token
    localStorage.setItem(GOOGLE_REFRESH_TOKEN_KEY, token)
  }, [])

  const clearRefreshToken = useCallback(() => {
    refreshTokenRef.current = null
    localStorage.removeItem(GOOGLE_REFRESH_TOKEN_KEY)
  }, [])

  // Fetches tasks with the given access token, transparently refreshing once
  // via the persisted Google refresh token if the token has expired (401).
  // Only falls through to 'error'/idle (forcing re-login) when there's no
  // refresh token to try, or Google confirms it's dead (revoked/expired).
  const fetchTasks = useCallback(async (accessToken: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const fetched = await fetchAllGoogleTasks(accessToken)
      setTasks(sortTasksByDue(fetched))
      setAuthState('authenticated')
    } catch (err) {
      if (err instanceof GoogleAuthExpiredError) {
        const refreshToken = refreshTokenRef.current
        if (!refreshToken) {
          setError('Your Google session expired. Please reconnect.')
          setAuthState('idle')
          return
        }
        const refreshed = await refreshGoogleAccessToken(refreshToken)
        if (!refreshed.ok) {
          if (refreshed.expired) clearRefreshToken()
          setError(refreshed.error)
          setAuthState('idle')
          return
        }
        try {
          const fetched = await fetchAllGoogleTasks(refreshed.accessToken)
          setTasks(sortTasksByDue(fetched))
          setAuthState('authenticated')
        } catch (retryErr) {
          setError(retryErr instanceof Error ? retryErr.message : String(retryErr))
          setAuthState('error')
        }
        return
      }
      setError(err instanceof Error ? err.message : String(err))
      setAuthState('error')
    } finally {
      setIsLoading(false)
    }
  }, [clearRefreshToken])

  // On mount: check for existing Supabase session with Google provider_token,
  // or fall back to a persisted refresh token if the in-session access token
  // is gone/stale (page reload after the original OAuth redirect).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.provider_token) {
        fetchTasks(session.provider_token)
      } else if (refreshTokenRef.current) {
        refreshGoogleAccessToken(refreshTokenRef.current).then(refreshed => {
          if (refreshed.ok) {
            fetchTasks(refreshed.accessToken)
          } else if (refreshed.expired) {
            clearRefreshToken()
          }
        })
      }
    })

    // Listen for auth state changes (e.g. return from OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.provider_token) {
        // Persist the refresh token NOW — Supabase only emits it on this one
        // event, immediately after sign-in (see module doc comment).
        persistRefreshToken(session.provider_refresh_token)
        // Clear OAuth return flag now that auth is complete
        sessionStorage.removeItem('oauth_returning')
        // Clean up OAuth callback params from URL without triggering a popstate
        if (window.location.hash || window.location.search.includes('code=')) {
          history.replaceState(history.state, '', window.location.pathname)
        }
        void syncGoogleContactToLoops(session.user.email, session.user.user_metadata)
        fetchTasks(session.provider_token)
      } else if (!session) {
        setAuthState('idle')
        setTasks([])
      }
    })
    return () => subscription.unsubscribe()
  }, [fetchTasks, persistRefreshToken, clearRefreshToken])

  const login = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Flag survives the full-page redirect so popstate handler can suppress
      // the "Go back?" modal when we return from OAuth
      sessionStorage.setItem('oauth_returning', '1')
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/tasks.readonly',
          redirectTo: window.location.origin,
          // access_type=offline is what makes Google issue a refresh_token
          // at all (default is access-token-only). prompt=consent forces
          // Google to re-show consent so a refresh_token is reliably
          // reissued even if the user previously authorized this app —
          // without it, Google silently omits provider_refresh_token on
          // repeat logins, which is what caused the daily re-auth loop.
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (authError) throw authError
      // browser will redirect — no further action needed here
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setAuthState('error')
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    clearRefreshToken()
    setAuthState('idle')
    setTasks([])
    setError(null)
  }, [clearRefreshToken])

  const refetch = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.provider_token) {
      await fetchTasks(session.provider_token)
    } else if (refreshTokenRef.current) {
      const refreshed = await refreshGoogleAccessToken(refreshTokenRef.current)
      if (refreshed.ok) await fetchTasks(refreshed.accessToken)
    }
  }, [fetchTasks])

  return { authState, tasks, isLoading, error, isMockMode: false, login, logout, refetch }
}
