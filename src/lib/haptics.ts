/**
 * A light tick under the finger when something is pressed, like Instagram.
 * Android: the Vibration API. iPhone (Safari 17.4+), which has no Vibration
 * API: toggling a native switch control produces the system's own tick, so
 * a hidden one is flipped. Elsewhere this quietly does nothing.
 */
let label: HTMLLabelElement | null = null
let last = 0

function iosSwitch() {
  if (!label) {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.id = 'circa-haptic'
    input.tabIndex = -1
    input.setAttribute('aria-hidden', 'true')
    label = document.createElement('label')
    label.htmlFor = input.id
    label.setAttribute('aria-hidden', 'true')
    for (const el of [input, label]) Object.assign(el.style, { position: 'fixed', left: '-100px', top: '0', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' })
    document.body.append(input, label)
  }
  label.click()
}

export function tick(strength: 'light' | 'firm' = 'light') {
  const now = performance.now()
  if (now - last < 40) return
  last = now
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') navigator.vibrate(strength === 'light' ? 8 : 16)
    else iosSwitch()
  } catch {
    /* no haptics here */
  }
}

/** Every button, tab and link answers a tap with a tick. */
export function installHaptics() {
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as HTMLElement | null
      if (!t || t.id === 'circa-haptic' || t === label) return
      if (t.closest('button, [role="tab"], a, .chip, select')) tick()
    },
    { capture: true },
  )
}
