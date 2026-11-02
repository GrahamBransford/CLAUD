import { useLayoutEffect, useRef } from 'react'
import type { PlayerLike } from './players'
import { useUI } from '../store/useUI'

/**
 * Keeps the Radio, Music and Drive playing with the phone locked or CIRCA in
 * the background, as a radio should (and as CarPlay needs).
 *
 * Phones pause a web page's video when the screen locks, but let audio carry
 * on. So on the Radio and in Music the sound always comes from one audio
 * element, and the video is a silent picture that follows it (SyncedPlayer).
 * Leaving the app changes nothing about the sound: there is nothing to hand
 * over, so there is no gap. While away, the same element keeps going down the
 * station's running order on its own media events (timers are frozen while
 * locked), and the lock screen, headphones and the car's controls play, pause,
 * scrub and skip it. Back in CIRCA, the feed lands on whatever is playing and
 * the picture catches up with the sound.
 *
 * Players that are a plain element (Drive mode's audio, an audio-only episode)
 * are handed over to the same element when the page hides.
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
  /** The player in the foreground. */
  player: () => PlayerLike | null
  /** Any item in the running order (undefined past the end, or for what can't play as audio). */
  item: (i: number) => BgItem | undefined
  /** The window of what's on now, which can differ from item(index) (a full song). */
  currentEnd?: number
  /** Back in the app: show `index`, at `time`; `playing` is false if it was paused from the lock screen. */
  land: (index: number, time: number, id: string, playing: boolean) => void
}

let station: Station | null = null
let audio: HTMLAudioElement | null = null
let owner: SyncedPlayer | null = null
let away = false
let mode: 'synced' | 'handoff' = 'synced'
let at = -1
let cur: BgItem | null = null
let skips = 0
let lastPos = 0
/**
 * Paused: the real track and where it got to, while a silent loop keeps the
 * app awake (iOS freezes an installed web app soon after its audio stops, and
 * the lock-screen player goes with it). The lock screen shows it paused.
 */
let held: { src: string; time: number; since: number } | null = null
/** Silence is kept up this long at most, then the app is let go. */
const HOLD_MAX = 20 * 60 * 1000
const playingListeners = new Set<() => void>()
/** Called each time the sound starts; iOS only keeps lock-screen actions set while it plays. */
export function onAudioPlaying(fn: () => void) {
  playingListeners.add(fn)
  return () => void playingListeners.delete(fn)
}
const lastPause = new WeakMap<EventTarget, number>()

const isMedia = (t: EventTarget | null): t is HTMLMediaElement => t instanceof HTMLMediaElement
const abs = (src: string) => new URL(src, window.location.href).href.split('#')[0]
const FORWARD = ['play', 'pause', 'playing', 'waiting', 'seeked', 'timeupdate', 'ended'] as const

function el() {
  if (audio) return audio
  audio = document.createElement('audio')
  audio.preload = 'auto'
  audio.setAttribute('playsinline', '')
  audio.hidden = true
  // in the page, so the first touch turns it up along with everything else
  document.body.appendChild(audio)
  const a = audio
  // the silent loop that holds a pause is nobody's business but this module's
  for (const t of FORWARD) a.addEventListener(t, () => !away && !held && owner?.emit(t))
  a.addEventListener('play', () => (!away && owner && !held ? void owner.video.play().catch(() => {}) : publishState()))
  a.addEventListener('pause', () => (!away && owner && !held ? owner.video.pause() : publishState()))
  a.addEventListener('playing', () => {
    // set the lock screen's actions again now that something is playing (iOS drops earlier ones)
    if (away && cur) publish(cur)
    else playingListeners.forEach((fn) => fn())
  })
  a.addEventListener('timeupdate', () => {
    if (held) {
      if (Date.now() - held.since > HOLD_MAX) a.pause()
      else if (away) publishPosition()
      return
    }
    if (!away || !cur) return
    if (a.currentTime >= cur.end - 0.25) return step(1)
    if (Math.abs(a.currentTime - lastPos) >= 1) publishPosition()
  })
  a.addEventListener('seeked', () => away && publishPosition())
  a.addEventListener('loadedmetadata', () => away && publishPosition())
  a.addEventListener('ended', () => away && !held && step(1))
  a.addEventListener('error', () => away && !held && cur && step(1))
  return a
}

/**
 * A video whose sound plays through the shared audio element. To the playback
 * hook it is just a player; the picture is kept in step with the sound.
 */
export class SyncedPlayer implements PlayerLike {
  private et = new EventTarget()
  private raf = 0
  /** The picture (or, for audio-only items, a silent element that just keeps the place). */
  readonly video: HTMLMediaElement
  constructor(video: HTMLMediaElement) {
    this.video = video
    video.muted = true
    video.dataset.silent = ''
    video.addEventListener('volumechange', () => {
      if (!video.muted) video.muted = true
    })
    for (const t of ['loadedmetadata', 'durationchange'] as const) video.addEventListener(t, () => this.emit(t))
  }
  private get owns() {
    return owner === this && !away
  }
  emit(t: string) {
    this.et.dispatchEvent(new Event(t))
  }
  addEventListener(t: string, fn: EventListener) {
    this.et.addEventListener(t, fn)
  }
  removeEventListener(t: string, fn: EventListener) {
    this.et.removeEventListener(t, fn)
  }
  get currentTime() {
    return this.owns ? (held ? held.time : el().currentTime) : this.video.currentTime
  }
  set currentTime(t: number) {
    this.video.currentTime = t
    if (this.owns) {
      if (held) held.time = t
      else el().currentTime = t
    }
  }
  get duration() {
    return this.video.duration
  }
  get paused() {
    return this.owns ? !!held || el().paused : true
  }
  get readyState() {
    return this.video.readyState
  }
  get playbackRate() {
    return this.video.playbackRate
  }
  set playbackRate(r: number) {
    this.video.playbackRate = r
    if (this.owns) el().playbackRate = r
  }
  get muted() {
    return el().muted
  }
  set muted(m: boolean) {
    el().muted = m
  }
  play(): Promise<void> {
    const a = el()
    if (away) return Promise.resolve()
    // out of a held pause: the real track comes back where the picture is
    if (held) unhold()
    const prev = owner
    if (prev && prev !== this) prev.release()
    // this player now has the sound
    // eslint-disable-next-line typescript/no-this-alias
    owner = this
    const src = abs(this.video.currentSrc || this.video.src)
    const same = !!a.src && abs(a.src) === src
    if (!same) {
      a.src = src
      const t = this.video.currentTime
      const seek = () => {
        if (Math.abs(a.currentTime - t) > 0.3) a.currentTime = t
      }
      if (a.readyState >= 1) seek()
      else a.addEventListener('loadedmetadata', seek, { once: true })
    } else if (a.paused || (prev && prev !== this)) {
      // resuming, or taking over from another screen: start from where the picture is
      a.currentTime = this.video.currentTime
    } else {
      // already sounding (back from the lock screen): the picture follows the sound
      this.video.currentTime = a.currentTime
    }
    a.playbackRate = this.video.playbackRate
    void this.video.play().catch(() => {})
    this.follow()
    if (same && !a.paused) {
      this.emit('play')
      return Promise.resolve()
    }
    return a.play()
  }
  pause() {
    const a = el()
    if (owner === this && !held && !a.paused) {
      // a pause that keeps the app awake, so the lock screen keeps its player
      this.video.currentTime = a.currentTime
      hold(a.src, a.currentTime)
    }
    this.emit('pause')
    this.video.pause()
  }
  /** Another screen takes the sound. */
  release() {
    if (owner === this) owner = null
    this.video.pause()
    this.emit('pause')
  }
  /** Keep the picture with the sound while it's on screen. */
  private follow() {
    cancelAnimationFrame(this.raf)
    const tick = () => {
      if (owner !== this) return
      const a = el()
      if (!away && document.visibilityState === 'visible') {
        // a held pause plays silence: the picture stays where the music stopped
        if (held) {
          if (!this.video.paused) this.video.pause()
        } else if (!a.paused) {
          if (this.video.paused) void this.video.play().catch(() => {})
          if (Math.abs(this.video.currentTime - a.currentTime) > 0.3) this.video.currentTime = a.currentTime
        } else if (!this.video.paused) this.video.pause()
      }
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }
}

const synced = new WeakMap<HTMLMediaElement, SyncedPlayer>()
/** The SyncedPlayer for a media element (one per element). */
export const syncedPlayer = (v: HTMLMediaElement) => {
  let p = synced.get(v)
  if (!p) synced.set(v, (p = new SyncedPlayer(v)))
  return p
}

/** A long, quiet loop (two minutes of 8-bit silence at 4 kHz). */
let quietUrl: string | null = null
function quiet() {
  if (quietUrl) return quietUrl
  const n = 4000 * 120
  const buf = new ArrayBuffer(44 + n)
  const v = new DataView(buf)
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  v.setUint32(4, 36 + n, true)
  w(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, 4000, true)
  v.setUint32(28, 4000, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true)
  w(36, 'data')
  v.setUint32(40, n, true)
  new Uint8Array(buf, 44).fill(128)
  return (quietUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })))
}

/** Pause, but keep the app awake: remember the track and play silence in its place. */
function hold(src: string, time: number) {
  const a = el()
  held = { src: abs(src), time, since: Date.now() }
  a.loop = true
  a.src = quiet()
  void a.play().catch(() => {})
  publishState()
}

function unhold() {
  const h = held
  held = null
  el().loop = false
  return h
}

function publishState() {
  publishPosition()
}

/** The lock screen's progress bar, then its play/pause state (iOS wants the state after each position). */
function publishPosition() {
  if (!('mediaSession' in navigator) || !away || !audio || !cur) return
  const length = Math.max(0.5, cur.end - cur.start)
  const t = held ? held.time : audio.currentTime
  lastPos = audio.currentTime
  try {
    navigator.mediaSession.setPositionState({
      duration: length,
      position: Math.max(0, Math.min(length, t - cur.start)),
      playbackRate: held ? 1 : audio.playbackRate || 1,
    })
  } catch {
    /* not supported here */
  }
  navigator.mediaSession.playbackState = held || audio.paused ? 'paused' : 'playing'
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
  const seekTo = (rel: number) => {
    if (!cur) return
    const t = cur.start + Math.max(0, Math.min(cur.end - cur.start - 0.3, rel))
    if (held) held.time = t
    else el().currentTime = t
    publishPosition()
  }
  const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
    [
      'play',
      () => {
        const h = held && unhold()
        if (h && cur) load(cur, h.time)
        else void audio?.play().catch(() => {})
      },
    ],
    ['pause', () => !held && cur && audio && hold(cur.src, audio.currentTime)],
    ['nexttrack', () => step(1)],
    ['previoustrack', () => step(-1)],
    ['seekto', (d) => d.seekTime != null && seekTo(d.seekTime)],
    // left empty on purpose: iOS would otherwise put its own skip buttons where next and previous go
    ['seekforward', null],
    ['seekbackward', null],
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
  void a.play().catch(() => {})
  publish(it)
}

/** Next (1) or previous (-1) in the station's running order. */
function step(dir: 1 | -1) {
  if (!station || !away) return
  // skipping out of a pause plays, as in any music app
  if (held) unhold()
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
  }
  if (dir === 1) audio?.pause()
}

function leave() {
  if (away || !station) return
  const p = station.player()
  const it = station.item(station.index)
  if (!p || !it) return
  const a = el()
  if (p instanceof SyncedPlayer) {
    // already sounding through the shared element (or holding a pause): nothing to hand over, so no gap
    if (owner !== p || (a.paused && !held)) return
    const time = held ? held.time : a.currentTime
    away = true
    mode = 'synced'
    owner = null
    at = station.index
    skips = 0
    cur = { ...it, end: Math.max(station.currentEnd ?? it.end, time + 1) }
    useUI.getState().setBackgrounded(true)
    publish(cur)
    return
  }
  // a plain element: playing now, or paused by the phone itself a moment ago as the screen locked
  if (!(p instanceof HTMLMediaElement) || !(p.currentSrc || p.src)) return
  const recent = performance.now() - (lastPause.get(p) ?? -1e9) < 1500
  if (p.paused && !recent) return
  const time = p.currentTime
  away = true
  mode = 'handoff'
  at = station.index
  skips = 0
  p.pause()
  a.muted = false
  useUI.getState().setBackgrounded(true)
  load({ ...it, end: Math.max(station.currentEnd ?? it.end, time + 1) }, time)
}

function comeBack() {
  if (!away) return
  const a = el()
  const time = held ? held.time : a.currentTime
  const playing = !held && !a.paused
  const id = cur?.id
  away = false
  cur = null
  useUI.getState().setBackgrounded(false)
  // handed over from a plain element: it takes the sound back
  if (mode === 'handoff') a.pause()
  if (station && id) station.land(at, time, id, playing)
}

let installed = false
export function installBackgroundAudio() {
  if (installed || typeof document === 'undefined') return
  installed = true
  el()
  // phones only let this element start later (from the lock screen, or a hand-over) once it has
  // started inside a tap; touchend and click count as one, pointerdown doesn't on iPhone
  const wake = () => {
    const a = el()
    a.muted = false
    if (a.paused && !a.src) {
      a.src = silence()
      void a.play().then(() => a.pause()).catch(() => {})
    }
    window.removeEventListener('touchend', wake, true)
    window.removeEventListener('click', wake, true)
  }
  window.addEventListener('touchend', wake, true)
  window.addEventListener('click', wake, true)
  document.addEventListener('pause', (e) => isMedia(e.target) && lastPause.set(e.target, performance.now()), true)
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? leave() : comeBack()))
  window.addEventListener('pagehide', leave)
  window.addEventListener('pageshow', () => document.visibilityState === 'visible' && comeBack())
}

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
      player: () => ref.current.player(),
      item: (i) => ref.current.item(i),
      land: (i, t, id, playing) => ref.current.land(i, t, id, playing),
    }
    station = proxy
    return () => {
      if (station === proxy && !away) station = null
    }
  }, [on])
}

/** True in a Home Screen web app, where iOS blocks picture-in-picture (WebKit bug 303885). */
export const isHomeScreenApp = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  !!window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches

/** What the background player is doing (for tests and the dev console). */
export const backgroundState = () => ({
  away,
  mode,
  at,
  skips,
  id: cur?.id ?? null,
  owner: !!owner,
  held: held ? { time: held.time } : null,
  time: audio?.currentTime ?? 0,
  paused: audio?.paused ?? true,
  end: cur?.end ?? 0,
})
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __circaBg: { state: backgroundState, audio: () => audio } })
