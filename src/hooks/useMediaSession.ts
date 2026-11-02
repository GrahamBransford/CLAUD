import { useEffect, useLayoutEffect, useRef } from 'react'
import { useUI } from '../store/useUI'

interface SessionInfo {
  title: string
  artist: string
  album?: string
  artwork: string
  onPlay: () => void
  onPause: () => void
  onNext?: () => void
  onPrevious?: () => void
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
    ms.metadata = new MediaMetadata({
      title: info.title,
      artist: info.artist,
      album: info.album,
      artwork: [{ src: new URL(info.artwork, window.location.href).href, sizes: '1200x1200', type: 'image/jpeg' }],
    })
    const handlers: [MediaSessionAction, (() => void) | undefined][] = [
      ['play', () => ref.current?.onPlay()],
      ['pause', () => ref.current?.onPause()],
      ['nexttrack', info.onNext && (() => ref.current?.onNext?.())],
      ['previoustrack', info.onPrevious && (() => ref.current?.onPrevious?.())],
    ]
    for (const [action, fn] of handlers) {
      try {
        ms.setActionHandler(action, fn ?? null)
      } catch {
        /* action not supported on this platform */
      }
    }
    return () => {
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
