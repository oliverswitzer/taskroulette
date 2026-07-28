/**
 * useGoogleTasks — manages Google OAuth token lifecycle + task fetching.
 *
 * Token storage: sessionStorage only (not localStorage — access token is short-lived,
 * we don't want it persisting beyond the browser session).
 *
 * Flow:
 * 1. On mount, check sessionStorage for existing token
 * 2. Also check URL hash for token returned from OAuth callback
 * 3. If no token → authState = 'idle'
 * 4. If token exists → authState = 'authenticated', fetch tasks
 * 5. If token expired (401) → clear token, authState = 'idle'
 */
import { useState, useEffect, useCallback } from 'react'
import type { GoogleTask, GoogleAuthState } from '../types'
import { sortTasksByDue } from '../googleTasks'

const TOKEN_KEY = 'google_access_token'

// Mock data for development/testing when OAuth isn't configured
const MOCK_TASKS: GoogleTask[] = [
  { id: 'm1', title: 'Review Q4 OKRs', due: new Date(Date.now() - 2 * 86400000).toISOString(), listId: 'l1', listTitle: 'Work', status: 'needsAction' },
  { id: 'm2', title: 'Call dentist for appointment', due: new Date(Date.now() - 86400000).toISOString(), listId: 'l2', listTitle: 'Personal', status: 'needsAction' },
  { id: 'm3', title: 'Submit expense report', due: new Date().toISOString(), listId: 'l1', listTitle: 'Work', status: 'needsAction' },
  { id: 'm4', title: 'Fix navbar bug', due: new Date(Date.now() + 2 * 86400000).toISOString(), listId: 'l1', listTitle: 'Work', status: 'needsAction' },
  { id: 'm5', title: 'Book flights for July', due: new Date(Date.now() + 3 * 86400000).toISOString(), listId: 'l2', listTitle: 'Personal', status: 'needsAction' },
  { id: 'm6', title: 'Read Atomic Habits chapter 3', due: new Date(Date.now() + 5 * 86400000).toISOString(), listId: 'l3', listTitle: 'Learning', status: 'needsAction' },
  { id: 'm7', title: 'Update resume', due: new Date(Date.now() + 10 * 86400000).toISOString(), listId: 'l2', listTitle: 'Personal', status: 'needsAction' },
  { id: 'm8', title: 'Pay quarterly taxes', due: new Date(Date.now() + 20 * 86400000).toISOString(), listId: 'l2', listTitle: 'Personal', status: 'needsAction' },
  { id: 'm9', title: 'Write retrospective notes', listId: 'l1', listTitle: 'Work', status: 'needsAction' },
]

interface UseGoogleTasksReturn {
  authState: GoogleAuthState
  tasks: GoogleTask[]
  isLoading: boolean
  error: string | null
  isMockMode: boolean
  login: () => Promise<void>
  logout: () => void
  refetch: () => Promise<void>
}

export function useGoogleTasks(): UseGoogleTasksReturn {
  const [authState, setAuthState] = useState<GoogleAuthState>('idle')
  const [tasks, setTasks] = useState<GoogleTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMockMode, setIsMockMode] = useState(false)

  const fetchTasks = useCallback(async (token: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/google/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY)
        setAuthState('idle')
        setTasks([])
        return
      }
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { tasks: GoogleTask[] }
      setTasks(sortTasksByDue(data.tasks))
      setAuthState('authenticated')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setAuthState('error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // On mount: check sessionStorage + URL hash for token
  useEffect(() => {
    // Check URL hash (set by OAuth callback redirect)
    const hash = window.location.hash
    if (hash.includes('google_token=')) {
      const params = new URLSearchParams(hash.slice(1))
      const token = params.get('google_token')
      if (token) {
        sessionStorage.setItem(TOKEN_KEY, decodeURIComponent(token))
        // Clean hash from URL
        window.history.replaceState(null, '', window.location.pathname)
        fetchTasks(decodeURIComponent(token))
        return
      }
    }

    // Check sessionStorage
    const stored = sessionStorage.getItem(TOKEN_KEY)
    if (stored) {
      fetchTasks(stored)
    }
  }, [fetchTasks])

  const login = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/google/auth-url?origin=${encodeURIComponent(window.location.origin)}`)
      if (res.status === 503) {
        // OAuth not configured — use mock data for development
        setIsMockMode(true)
        setTasks(sortTasksByDue(MOCK_TASKS))
        setAuthState('authenticated')
        setIsLoading(false)
        return
      }
      if (!res.ok) throw new Error(`Failed to get auth URL: ${res.status}`)
      const { url } = await res.json() as { url: string }
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setAuthState('error')
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    setAuthState('idle')
    setTasks([])
    setError(null)
    setIsMockMode(false)
  }, [])

  const refetch = useCallback(async () => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (!token) return
    await fetchTasks(token)
  }, [fetchTasks])

  return { authState, tasks, isLoading, error, isMockMode, login, logout, refetch }
}
