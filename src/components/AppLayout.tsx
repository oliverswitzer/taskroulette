import type { ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import AppHomeIcon from './AppHomeIcon'

interface AppLayoutProps {
  /** Whether the home icon shows on the current screen (hidden on DUMP,
   *  PARSING, ALL_DONE — see App.tsx for the "why" per screen). */
  showHomeIcon: boolean
  onHomeIconActivate: () => void
  children: ReactNode
}

/**
 * AppLayout — single shared top bar + content wrapper used by EVERY screen.
 * This is the one place that renders the home icon, so there's no
 * per-screen duplication of icon markup/positioning.
 *
 * The bar lives in normal document flow (not position:fixed/absolute) — it
 * always reserves the same height whether or not the icon is showing, so
 * switching screens doesn't jump content, and it scrolls away with the page
 * like any other element instead of floating on top of scrolled text.
 */
export default function AppLayout({ showHomeIcon, onHomeIconActivate, children }: AppLayoutProps) {
  return (
    <>
      <div
        style={{
          height: 44,
          flexShrink: 0,
          // Explicit minimum top padding — env(safe-area-inset-top) alone
          // resolves to 0px on non-notched devices/browsers, which left the
          // icon flush against the very top edge with no breathing room.
          marginTop: 12,
          marginBottom: 24,
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <AnimatePresence>
          {showHomeIcon && <AppHomeIcon key="home-icon" onActivate={onHomeIconActivate} />}
        </AnimatePresence>
      </div>
      {/* Fills whatever height the top bar didn't use, and scrolls internally
          if a screen's content is taller than the remaining space — each
          screen still sets its own min-height:100dvh, but this wrapper's
          overflow:auto is what stops that height from ADDING to the bar's
          height and pushing content off the bottom of a fixed-height parent. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {children}
      </div>
    </>
  )
}
