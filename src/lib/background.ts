import { useLayoutEffect, useRef } from 'react'
import { useUI } from '../store/useUI'

/**
 * Keeps the Radio, Music and Drive playing with the phone locked or CIRCA in
 * the background, as a radio should (and as CarPlay needs).
 *
 * Phones pause a web page's video when the screen locks, but let audio carry
 * on. So one audio element waits in the wings: when the page is hidden it
 * picks up the item that was playing, at the same second, and keeps going down
 * the station's running order, driven only by media events (timers are frozen
 * while locked). The lock screen, headphones and the car's controls steer it.
 * When CIRCA comes back, the feed lands on whatever is playing and the picture
 * carries on from there.
 */

export interface BgItem {
  id: string
  src: string
  /** The part of the file this station plays. */
  start: number
  end: number
  title: string
  artist: string
  artwork: string
}

export interface Station {
  /** Position in the running order of what's on now. */
  index: number
  /** The element playing in the foreground. */
  element: () => HTMLMediaElement | null
  /** Any item in the running order (undefined past the end, or for what can't play as audio). */
  item: (i: number) => BgItem | undefined
  /** The window of what's on now, which can differ from item(index) (a full song). */
  currentEnd?: number
  /** Back in the app: show `index`, at `time`. */
  land: (index: number, time: number, id: string) => void
}

let station: Station | null = null
let audio: HTMLAudioElement | null = null
let primed = false
let away = false
let at = -1
let cur: BgItem | null = null
let skips = 0
const lastPause = new WeakMap<EventTarget, number>()

const isMedia = (t: EventTarget | null): t is HTMLMediaElement => t instanceof HTMLMediaElement

/** A tenth of a second of silence, to wake the audio element inside a tap. */
function silence() {
  const n = 800
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  v.setUint32(4, 36 + n * 2, true)
  w(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, 8000, true)
  v.setUint32(28, 16000, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  w(36, 'data')
  v.setUint32(40, n * 2, true)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

function el() {
  if (audio) return audio
  audio = new Audio()
  audio.preload = 'auto'
  audio.setAttribute('playsinline', '')
  audio.addEventListener('timeupdate', () => {
    if (away && cur && audio && audio.currentTime >= cur.end - 0.25) step(1)
  })
  audio.addEventListener('ended', () => away && step(1))
  audio.addEventListener('error', () => away && cur && step(1))
  audio.addEventListener('play', () => publishState())
  audio.addEventListener('pause', () => publishState())
  return audio
}

/** Phones only let audio start later if it has started once inside a tap. */
function prime() {
  if (primed) return
  const a = el()
  a.src = silence()
  a.play()
    .then(() => {
      a.pause()
      primed = true
    })
    .catch(() => {
      /* not this tap; the next one */
    })
}

function publishState() {
  if (!('mediaSession' in navigator) || !away || !audio) return
  navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing'
}

function publish(it: BgItem) {
  if (!('mediaSession' in navigator)) return
  const ms = navigator.mediaSession
  ms.metadata = new MediaMetadata({
    title: it.title,
    artist: it.artist,
    album: 'CIRCA',
    artwork: [{ src: new URL(it.artwork, window.location.href).href, sizes: '1200x1200', type: 'image/jpeg' }],
  })
  const handlers: [MediaSessionAction, (() => void) | null][] = [
    ['play', () => void audio?.play().catch(() => {})],
    ['pause', () => audio?.pause()],
    ['nexttrack', () => step(1)],
    ['previoustrack', () => step(-1)],
  ]
  for (const [action, fn] of handlers) {
    try {
      ms.setActionHandler(action, fn)
    } catch {
      /* not supported here */
    }
  }
  publishState()
}

function load(it: BgItem, from: number) {
  const a = el()
  cur = it
  // the fragment starts the file at the right second without waiting for its metadata
  a.src = `${it.src}#t=${Math.max(0, from).toFixed(2)}`
  const seek = () => {
    if (Math.abs(a.currentTime - from) > 1) a.currentTime = from
  }
  a.addEventListener('loadedmetadata', seek, { once: true })
  a.muted = false
  void a.play().catch(() => {})
  publish(it)
}

/** Next (1) or previous (-1) in the station's running order. */
function step(dir: 1 | -1) {
  if (!station || !away) return
  let i = at + dir
  // pass over anything that can't play as audio, without looping forever
  for (let tries = 0; tries < 50 && i >= 0; tries++, i += dir) {
    const it = station.item(i)
    if (it) {
      at = i
      skips++
      load(it, it.start)
      return
    }
    if (i > 10000) break
  }
  if (dir === 1) audio?.pause()
}

function leave() {
  if (away || !station) return
  const fg = station.element()
  if (!fg || !(fg.currentSrc || fg.src)) return
  // playing now, or paused by the phone itself a moment ago as the screen locked
  const recent = performance.now() - (lastPause.get(fg) ?? -1e9) < 1500
  if (fg.paused && !recent) return
  const it = station.item(station.index)
  if (!it) return
  const time = fg.currentTime
  away = true
  at = station.index
  skips = 0
  fg.pause()
  useUI.getState().setBackgrounded(true)
  load({ ...it, end: Math.max(station.currentEnd ?? it.end, time + 1) }, time)
}

function come_back() {
  if (!away) return
  away = false
  const a = el()
  const time = a.currentTime
  const id = cur?.id
  a.pause()
  a.removeAttribute('src')
  a.load()
  const s = station
  useUI.getState().setBackgrounded(false)
  if (s && id) s.land(at, time, id)
  cur = null
}

let installed = false
export function installBackgroundAudio() {
  if (installed || typeof document === 'undefined') return
  installed = true
  // wake the audio element on a real tap (touchend and click count as one; pointerdown doesn't on iPhone)
  const wake = () => {
    prime()
    if (primed) {
      window.removeEventListener('touchend', wake, true)
      window.removeEventListener('click', wake, true)
    }
  }
  window.addEventListener('touchend', wake, true)
  window.addEventListener('click', wake, true)
  document.addEventListener('pause', (e) => isMedia(e.target) && lastPause.set(e.target, performance.now()), true)
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? leave() : come_back()))
  window.addEventListener('pagehide', leave)
  window.addEventListener('pageshow', () => document.visibilityState === 'visible' && come_back())
}

/** While `on`, this screen's running order is the one that keeps playing in the background. */
export function useBackgroundStation(on: boolean, s: Station) {
  const ref = useRef(s)
  useLayoutEffect(() => {
    ref.current = s
  })
  useLayoutEffect(() => {
    if (!on) return
    const proxy: Station = {
      get index() {
        return ref.current.index
      },
      get currentEnd() {
        return ref.current.currentEnd
      },
      element: () => ref.current.element(),
      item: (i) => ref.current.item(i),
      land: (i, t, id) => ref.current.land(i, t, id),
    }
    station = proxy
    return () => {
      if (station === proxy && !away) station = null
    }
  }, [on])
}

/** How many items the background player moved on (for tests and the dev console). */
export const backgroundState = () => ({ away, at, skips, id: cur?.id ?? null, primed, time: audio?.currentTime ?? 0, paused: audio?.paused ?? true, end: cur?.end ?? 0 })
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __circaBg: { state: backgroundState, audio: () => audio } })
