import type { ReactNode } from 'react'
import AppHomeIcon from './AppHomeIcon'

interface AppLayoutProps {
  /** Whether the logo acts as a tappable "start over" control on the current
   *  screen (LIST_EDIT, WHEEL_IDLE, WHEEL_SPINNING, TASK_CARD). The logo
   *  itself is ALWAYS rendered — see AppHomeIcon.tsx — this only toggles
   *  whether tapping it does anything. Screens where "start over" doesn't
   *  make sense (DUMP, PARSING, ALL_DONE) pass false and get plain branding. */
  showHomeIcon: boolean
  onHomeIconActivate: () => void
  /** Optional extra control rendered in the SAME row as the logo, right-
   *  aligned (e.g. the wheel screen's "Edit tasks" button). Screens that
   *  don't need one just omit this and the row is logo-only. */
  headerRight?: ReactNode
  children: ReactNode
}

/**
 * AppLayout — single shared top bar + content wrapper used by EVERY screen.
 * This is the one place that renders the logo, so there's no per-screen
 * duplication of icon markup/positioning, and the logo now shows on every
 * page (previously it only mounted on screens that opted into "start over").
 *
 * The bar lives in normal document flow (not position:fixed/absolute) — it
 * always reserves the same height, so switching screens doesn't jump
 * content, and it scrolls away with the page like any other element instead
 * of floating on top of scrolled text.
 */
export default function AppLayout({ showHomeIcon, onHomeIconActivate, headerRight, children }: AppLayoutProps) {
  return (
    <>
      <div
        style={{
          height: 44,
          // Explicit minimum top padding — env(safe-area-inset-top) alone
          // resolves to 0px on non-notched devices/browsers, which left the
          // icon flush against the very top edge with no breathing room.
          // Bottom gap trimmed from 24px to 12px — the old value left a big
          // dead band between the header and page content on every screen.
          marginTop: 12,
          marginBottom: 12,
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AppHomeIcon
          key="app-logo"
          onActivate={showHomeIcon ? onHomeIconActivate : undefined}
        />
        {headerRight}
      </div>
      {children}
    </>
  )
}
