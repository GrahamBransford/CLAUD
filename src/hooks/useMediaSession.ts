import { useEffect, useLayoutEffect, useRef } from 'react'
import { useUI } from '../store/useUI'
import { onAudioPlaying } from '../lib/background'

interface SessionInfo {
  title: string
  artist: string
  album?: string
  artwork: string
  onPlay: () => void
  onPause: () => void
  onNext?: () => void
  onPrevious?: () => void
  /** Scrubbing from the lock screen: seconds into what's playing. */
  onSeek?: (seconds: number) => void
  /** Where it's got to, so the lock screen can show (and scrub) the position. */
  position?: { time: number; length: number }
}

/**
 * Publishes what's playing to the operating system via the Media Session API,
 * so lock screens, Bluetooth headsets and car steering-wheel buttons can play,
 * pause and skip. This is the same channel CarPlay / Android Auto audio apps
 * build on, which makes it a real first step rather than a simulation.
 */
export function useMediaSession(active: boolean, info: SessionInfo | null) {
  const ref = useRef(info)
  useLayoutEffect(() => {
    ref.current = info
  })
  // locked: the background player owns the lock screen; back in the app, this screen takes it again
  const away = useUI((s) => s.backgrounded)

  useEffect(() => {
    if (away || !active || !info || !('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    const metadata = new MediaMetadata({
      title: info.title,
      artist: info.artist,
      album: info.album,
      artwork: [{ src: new URL(info.artwork, window.location.href).href, sizes: '1200x1200', type: 'image/jpeg' }],
    })
    const handlers: [MediaSessionAction, MediaSessionActionHandler | undefined][] = [
      ['play', () => ref.current?.onPlay()],
      ['pause', () => ref.current?.onPause()],
      ['nexttrack', info.onNext && (() => ref.current?.onNext?.())],
      ['previoustrack', info.onPrevious && (() => ref.current?.onPrevious?.())],
      ['seekto', info.onSeek && ((d: MediaSessionActionDetails) => d.seekTime != null && ref.current?.onSeek?.(d.seekTime))],
      // left empty on purpose: iOS would otherwise put its own skip buttons where next and previous go
      ['seekforward', undefined],
      ['seekbackward', undefined],
    ]
    const apply = () => {
      ms.metadata = metadata
      for (const [action, fn] of handlers) {
        try {
          ms.setActionHandler(action, fn ?? null)
        } catch {
          /* action not supported on this platform */
        }
      }
    }
    apply()
    // iOS keeps only the actions set while something plays, so set them again each time the sound starts
    const off = onAudioPlaying(apply)
    return () => {
      off()
      if (useUI.getState().backgrounded) return
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null)
        } catch {
          /* ignore */
        }
      }
    }
    // re-publish when the item changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [away, active, info?.title, info?.artist, info?.artwork, !!info?.onNext, !!info?.onPrevious])
}

/** Keeps the lock screen's progress bar in step (about once a second). */
export function useMediaPosition(active: boolean, time: number, length: number, playing: boolean) {
  const away = useUI((s) => s.backgrounded)
  const second = Math.floor(time)
  useEffect(() => {
    if (away || !active || !('mediaSession' in navigator) || !(length > 0)) return
    try {
      navigator.mediaSession.setPositionState({ duration: length, position: Math.max(0, Math.min(length, time)), playbackRate: 1 })
      // iOS wants the play/pause state after each position
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
    } catch {
      /* not supported here */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [away, active, second, length, playing])
}
