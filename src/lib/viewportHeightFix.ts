// Fixes a long-standing Safari/WebKit quirk (bugs.webkit.org #153852,
// still reproducing as of iOS 26 per public bug reports) where CSS
// `dvh`/`svh` units and `overflow:hidden` on html/body don't reliably
// track or lock the ACTUAL visible viewport the way they do in Chrome —
// Safari's toolbar show/hide transition can leave `100dvh` computed a
// frame behind the real rendered height, which produces black bars/clipped
// content at the top or bottom that Chrome never exhibits (confirmed via
// live report: identical layout worked flawlessly in Chrome iOS, broke in
// Safari iOS).
//
// Fix: stop relying on CSS viewport units for the "fill the real visible
// area" case. Measure the actual height directly via
// `window.visualViewport` (falls back to `window.innerHeight`) and drive
// layout off a CSS custom property instead. This is the standard
// production workaround documented across multiple sources (CSS-Tricks
// "the trick to viewport units on mobile", pqina.nl's Safari scroll-lock
// writeup, and the iOS 26 Safari layout-breakage thread on Stack
// Overflow) — JS-measured height instead of trusting the browser to
// report/apply dvh consistently.
function setAppHeightVar() {
  const height = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${height}px`)
}

// Detects iOS home-screen/standalone PWA mode. `navigator.standalone` is
// the iOS-specific flag (non-standard, Safari-only); the media query is
// the cross-browser standard equivalent, kept as a fallback.
function isStandalone(): boolean {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

// Standalone/home-screen mode has SEPARATE, still-open WebKit bugs beyond
// #153852 (which only covers regular Safari tabs) — bugs.webkit.org
// #222654 ("Scrolling in home screen apps incorrectly latches to
// document") and #236561 both cause `overflow: hidden` on html/body to
// remain unreliable specifically when a site is added to the home screen,
// even after #153852 was fixed for the regular-tab case. This is a
// distinct, still-reproducing bug class from the dvh/svh timing issue
// fixed above — confirmed via a live report: identical layout worked
// correctly in a normal Safari tab but still scrolled/clipped once added
// to the home screen.
//
// The standard, widely-documented workaround for standalone mode
// specifically is the classic iOS body-scroll-lock technique:
// `position: fixed` on body pinned to (0,0) at the real measured height.
// This is intentionally scoped to standalone mode ONLY — applying it
// broadly would break iOS's automatic scroll-into-view when the on-screen
// keyboard opens (needed for the dump textarea) in a normal browser tab,
// which is exactly why this project avoided position:fixed globally
// before. Standalone mode's keyboard handling already works differently
// (visualViewport resizes the fixed layout correctly), so this is safe to
// scope this way.
function applyStandaloneScrollLock() {
  if (!isStandalone()) return
  const body = document.body
  body.style.position = 'fixed'
  body.style.top = '0'
  body.style.left = '0'
  body.style.width = '100%'
  body.style.height = 'var(--app-height)'
  body.style.overflow = 'hidden'
}

export function initViewportHeightFix() {
  setAppHeightVar()
  applyStandaloneScrollLock()
  window.addEventListener('resize', setAppHeightVar)
  window.addEventListener('orientationchange', setAppHeightVar)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setAppHeightVar)
  }
}
