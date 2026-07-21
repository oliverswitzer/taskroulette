import { useEffect, useRef } from 'react'
import type { AppState } from '../types'

interface HistoryNavHandlers {
  /** Called when Back is pressed from WHEEL_IDLE or WHEEL_SPINNING */
  onBackFromWheel: () => void
  /** Called when Back is pressed from LIST_EDIT (show confirmation modal) */
  onBackFromEdit: () => void
}

/**
 * Wires pushState / popstate for back-button navigation.
 * Seeds the initial history entry on mount so there's always something to pop.
 * Uses a stable ref pattern so the listener never becomes stale.
 */
export function useHistoryNav(
  appState: AppState,
  handlers: HistoryNavHandlers,
): void {
  // Ref keeps the current appState readable inside the popstate listener
  // without recreating it on every state change.
  const appStateRef = useRef(appState)
  useEffect(() => { appStateRef.current = appState }, [appState])

  // Seed the initial entry on mount
  useEffect(() => {
    history.replaceState({ state: appState }, '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Stable handler ref — reads from appStateRef so it never goes stale
  const handlerRef = useRef<(e: PopStateEvent) => void>(() => {})
  useEffect(() => {
    handlerRef.current = (e: PopStateEvent) => {
      const histState = e.state as { state?: string } | null
      const current = appStateRef.current

      if (current === 'WHEEL_IDLE' || current === 'WHEEL_SPINNING') {
        handlers.onBackFromWheel()
        history.pushState({ state: 'EDIT' }, '')
        return
      }

      if (current === 'LIST_EDIT') {
        history.pushState({ state: 'EDIT' }, '')
        handlers.onBackFromEdit()
        return
      }

      // For all other states, restore the entry so user can't escape unexpectedly
      if (histState?.state) {
        history.pushState({ state: current }, '')
      }
    }
  }, [handlers]) // handlers object is stable (defined inline in App.tsx with useMemo or stable refs)

  useEffect(() => {
    const listener = (e: PopStateEvent) => handlerRef.current(e)
    window.addEventListener('popstate', listener)
    return () => window.removeEventListener('popstate', listener)
  }, [])
}
