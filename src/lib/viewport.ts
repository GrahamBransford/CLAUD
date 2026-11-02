/**
 * Opened from the iPhone home screen (full screen, translucent status bar),
 * iOS can lay the page out one status bar shorter than the screen, leaving
 * an empty band under the tab bar. Measure the shortfall and let full-screen
 * layers reach past it to the real bottom edge (`--fill`). In a browser tab,
 * or where iOS gets it right, the shortfall is zero and nothing moves.
 */
export function installViewportFill() {
  const nav = navigator as Navigator & { standalone?: boolean }
  const standalone = nav.standalone === true || window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches
  if (!standalone) return
  const root = document.documentElement
  const measure = () => {
    const portrait = window.innerHeight >= window.innerWidth
    const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
    const short = Math.round(screenH - window.innerHeight)
    // only the status-bar-sized gap; anything else (a keyboard, a split view) is left alone
    root.style.setProperty('--fill', short > 0 && short <= 80 ? `${short}px` : '0px')
  }
  measure()
  window.addEventListener('resize', measure)
  window.addEventListener('orientationchange', () => setTimeout(measure, 300))
}

/** The height full-screen layers really have: the window plus any `--fill`. */
export function layerHeight() {
  const fill = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fill')) || 0
  return window.innerHeight + fill
}
