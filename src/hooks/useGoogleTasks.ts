/**
 * useGoogleTasks — manages Google OAuth via Supabase Auth + direct Google Tasks API calls.
 *
 * Flow:
 * 1. signInWithOAuth({ provider: 'google', scopes: tasks.readonly }) → Supabase handles OAuth
 * 2. On return, getSession() gives us provider_token (Google access token)
 * 3. Call Google Tasks API directly from frontend using that token
 * 4. No server routes needed for auth — Supabase handles everything
 */
import { useState, useEffect, useCallback } from 'react'
import type { GoogleTask, GoogleAuthState } from '../types'
import { sortTasksByDue } from '../googleTasks'
import { supabase } from '../lib/supabase'
import { submitEmail } from '../api'
import { TR_EMAIL_KEY } from '../constants'

const GOOGLE_TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1'

interface GoogleTasksListResponse {
  items?: Array<{ id: string; title: string; due?: string; status: string }>
  nextPageToken?: string
}
interface GoogleTaskListsResponse {
  items?: Array<{ id: string; title: string }>
}

// Google user_metadata on the Supabase session — full_name/given_name/family_name are
// populated straight from the Google OAuth response, no extra API call needed.
interface GoogleUserMetadata {
  full_name?: string
  name?: string
  given_name?: string
  family_name?: string
}

function splitName(meta: GoogleUserMetadata): { firstName?: string; lastName?: string } {
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
async function syncGoogleContactToLoops(email: string | undefined, meta: GoogleUserMetadata): Promise<void> {
  if (!email || localStorage.getItem(TR_EMAIL_KEY)) return
  const { firstName, lastName } = splitName(meta)
  const result = await submitEmail(email, { firstName, lastName })
  if (result.ok) localStorage.setItem(TR_EMAIL_KEY, email)
}

async function fetchAllGoogleTasks(accessToken: string): Promise<GoogleTask[]> {
  const listsRes = await fetch(`${GOOGLE_TASKS_BASE}/users/@me/lists?maxResults=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!listsRes.ok) throw new Error(`Failed to fetch task lists: ${listsRes.status}`)
  const lists = await listsRes.json() as GoogleTaskListsResponse
  if (!lists.items?.length) return []

  const allTasks: GoogleTask[] = []
  await Promise.all(lists.items.map(async (list) => {
    const res = await fetch(
      `${GOOGLE_TASKS_BASE}/lists/${list.id}/tasks?showCompleted=false&maxResults=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
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

  const fetchTasks = useCallback(async (accessToken: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const fetched = await fetchAllGoogleTasks(accessToken)
      setTasks(sortTasksByDue(fetched))
      setAuthState('authenticated')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setAuthState('error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // On mount: check for existing Supabase session with Google provider_token
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.provider_token) {
        fetchTasks(session.provider_token)
      }
    })

    // Listen for auth state changes (e.g. return from OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.provider_token) {
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
  }, [fetchTasks])

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
    setAuthState('idle')
    setTasks([])
    setError(null)
  }, [])

  const refetch = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.provider_token) await fetchTasks(session.provider_token)
  }, [fetchTasks])

  return { authState, tasks, isLoading, error, isMockMode: false, login, logout, refetch }
}
