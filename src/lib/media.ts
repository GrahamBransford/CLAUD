/** One audible source at a time, across every player in the app. */
let current: HTMLMediaElement | null = null

export function claimAudioFocus(el: HTMLMediaElement) {
  if (current && current !== el && !current.paused) current.pause()
  current = el
}

export function releaseAudioFocus(el: HTMLMediaElement) {
  if (current === el) current = null
}

export function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

export function relativeHours(h: number) {
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}
