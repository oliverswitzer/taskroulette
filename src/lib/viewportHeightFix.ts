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

export function initViewportHeightFix() {
  setAppHeightVar()
  window.addEventListener('resize', setAppHeightVar)
  window.addEventListener('orientationchange', setAppHeightVar)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setAppHeightVar)
  }
}
