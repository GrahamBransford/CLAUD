import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { claimAudioFocus, releaseAudioFocus } from '../lib/media'
import type { PlayerLike } from '../lib/players'
import { useUI } from '../store/useUI'

export interface WindowEnd {
  /** Seconds genuinely heard (seeking forward does not count). */
  listened: number
  length: number
}

interface Options {
  ref: RefObject<PlayerLike | null>
  /** Changes whenever a different item is loaded into the element. */
  itemKey: string
  start: number
  end: number
  autoplay: boolean
  /** When false the element is paused and autoplay is suppressed. */
  active: boolean
  onWindowEnd?: (info: WindowEnd) => void
  /** Seconds into the window to begin from when the item loads. */
  initialOffset?: number
}

/**
 * Plays a window [start, end] inside a media file — a 60–90 s preview of a
 * longer music video, a podcast highlight, or a full episode — and reports
 * accurate progress plus how much of the window was actually listened to.
 */
export function useWindowedPlayback({ ref, itemKey, start, end, autoplay, active, onWindowEnd, initialOffset = 0 }: Options) {
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [blocked, setBlocked] = useState(false)
  const [ended, setEnded] = useState(false)
  const listened = useRef(0)
  const last = useRef<number | null>(null)
  const done = useRef(false)
  const cb = useRef(onWindowEnd)
  useLayoutEffect(() => {
    cb.current = onWindowEnd
  })
  const length = Math.max(0.1, end - start)

  // Reset whenever a new item is loaded.
  useEffect(() => {
    listened.current = 0
    last.current = null
    done.current = false
    setTime(0)
    setEnded(false)
    setBlocked(false)
  }, [itemKey])

  const tryPlay = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (done.current || el.currentTime >= end - 0.05) {
      el.currentTime = start
      done.current = false
      setEnded(false)
      listened.current = 0
    }
    claimAudioFocus(el)
    // muted autoplay is always allowed; sound follows the first touch
    el.muted = !useUI.getState().audioUnlocked
    const p = el.play()
    if (p) p.then(() => setBlocked(false)).catch(() => setBlocked(true))
  }, [ref, start, end])

  // Wire element events.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const toStart = () => {
      if (initialOffset > 0) el.currentTime = start + Math.min(initialOffset, length - 1)
      else if (el.currentTime < start - 0.05 || el.currentTime > end) el.currentTime = start
    }
    const onMeta = () => {
      toStart()
      if (autoplay && active) tryPlay()
    }
    const onPlay = () => {
      claimAudioFocus(el)
      setPlaying(true)
    }
    const onPause = () => setPlaying(false)
    const onEnded = () => finish()
    const finish = () => {
      if (done.current) return
      done.current = true
      el.pause()
      setEnded(true)
      setTime(length)
      cb.current?.({ listened: Math.min(listened.current, length), length })
    }
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    if (el.readyState >= 1) onMeta()

    // Count only time genuinely heard. Called from rAF (smooth UI) and from
    // timeupdate (keeps running when the tab is in the background).
    const account = () => {
      const ct = el.currentTime
      if (!el.paused) {
        if (last.current !== null) {
          const d = ct - last.current
          if (d > 0 && d < 0.6 + 1.2 * el.playbackRate) listened.current += d
        }
        last.current = ct
        if (ct >= end - 0.04) finish()
      } else {
        last.current = null
      }
      return ct
    }
    el.addEventListener('timeupdate', account)

    let raf = 0
    const tick = () => {
      const ct = account()
      setTime(Math.max(0, Math.min(length, ct - start)))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('timeupdate', account)
      // the outgoing element may linger during an exit animation; silence it
      el.pause()
      releaseAudioFocus(el)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, itemKey, start, end])

  // Turn the sound on as soon as the listener first touches the app.
  const unlocked = useUI((s) => s.audioUnlocked)
  useEffect(() => {
    if (unlocked && ref.current) ref.current.muted = false
  }, [unlocked, ref])

  // Pause when the surface becomes inactive (another tab, drive mode, a sheet).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!active && !el.paused) el.pause()
    // Radio-like: returning to a station (or tuning in) resumes it.
    if (active && autoplay && el.paused && !done.current && el.readyState >= 1) tryPlay()
  }, [active, autoplay, ref, tryPlay])

  const pause = useCallback(() => ref.current?.pause(), [ref])
  const toggle = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (el.paused) tryPlay()
    else el.pause()
  }, [ref, tryPlay])
  const seek = useCallback(
    (rel: number) => {
      const el = ref.current
      if (!el) return
      el.currentTime = start + Math.max(0, Math.min(length - 0.05, rel))
      last.current = null
      if (done.current && rel < length - 0.1) {
        done.current = false
        setEnded(false)
      }
    },
    [ref, start, length],
  )
  const restart = useCallback(() => {
    listened.current = 0
    done.current = false
    setEnded(false)
    seek(0)
    tryPlay()
  }, [seek, tryPlay])

  return {
    playing,
    time,
    length,
    remaining: length - time,
    blocked,
    ended,
    listened: () => listened.current,
    play: tryPlay,
    pause,
    toggle,
    seek,
    restart,
  }
}

export type WindowedPlayback = ReturnType<typeof useWindowedPlayback>
