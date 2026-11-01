import { useEffect, useRef, useState } from 'react'
import { SpotifyPlayer, YouTubePlayer, YT_ERRORS, type PlayerLike } from '../lib/players'
import type { MediaSource } from '../types'

interface Props {
  source: MediaSource
  className?: string
  /** Start position hint (YouTube cues the video there). */
  start?: number
  /** Called once with the player when it exists, and with null on unmount. */
  onPlayer: (p: PlayerLike | null) => void
  onError?: (message: string) => void
  onClick?: () => void
  spotifyHeight?: number
  /** Shown while an embedded player loads, and behind its error state. */
  poster?: string
}

/** loading → ready (the platform's own player is showing) → playing; or error. */
type Phase = 'loading' | 'ready' | 'playing' | 'error'

const watchUrl = (s: MediaSource) =>
  s.kind === 'youtube' ? `https://www.youtube.com/watch?v=${s.id}` : s.kind === 'embed' ? s.url : undefined
const platformName = (s: MediaSource) => (s.kind === 'youtube' ? 'YouTube' : s.kind === 'spotify' ? 'Spotify' : s.kind === 'embed' ? s.provider[0].toUpperCase() + s.provider.slice(1) : '')

/**
 * Renders whatever a content item plays from — a self-hosted file, an
 * official YouTube video or a Spotify embed — and hands back a common
 * PlayerLike so the rest of CIRCA doesn't care which.
 */
export function MediaSurface({ source, className, start = 0, onPlayer, onError, onClick, spotifyHeight = 152, poster }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const media = useRef<HTMLMediaElement | null>(null)
  const cb = useRef(onPlayer)
  const errCb = useRef(onError)
  useEffect(() => {
    cb.current = onPlayer
    errCb.current = onError
  })

  const key = source.kind === 'youtube' ? source.id : source.kind === 'spotify' ? source.uri : source.src
  const [phase, setPhase] = useState<{ key: string; phase: Phase; message?: string }>({ key, phase: 'loading' })
  const current = phase.key === key ? phase : { key, phase: 'loading' as Phase }

  useEffect(() => {
    if (source.kind === 'video' || source.kind === 'audio') {
      const el = media.current
      if (!el) return
      const onErr = () => errCb.current?.('This media file could not be loaded.')
      el.addEventListener('error', onErr)
      cb.current(el)
      return () => {
        el.removeEventListener('error', onErr)
        cb.current(null)
      }
    }
    if (source.kind === 'image' || source.kind === 'embed' || !host.current) return
    const el = host.current
    const p = source.kind === 'youtube' ? new YouTubePlayer(el, source.id, start) : new SpotifyPlayer(el, source.uri, spotifyHeight)
    const name = source.kind === 'youtube' ? 'YouTube' : 'Spotify'
    const onErr = () => {
      const message =
        p.errorCode === -1 ? `${name} can’t load here right now.` : (YT_ERRORS[p.errorCode ?? 0] ?? 'This can’t play here.')
      setPhase({ key, phase: 'error', message })
      errCb.current?.(message)
    }
    const onReady = () => setPhase((s) => (s.key === key && s.phase === 'loading' ? { key, phase: 'ready' } : s))
    const onPlay = () => setPhase({ key, phase: 'playing' })
    p.addEventListener('error', onErr)
    p.addEventListener('loadedmetadata', onReady)
    p.addEventListener('play', onPlay)
    cb.current(p)
    return () => {
      p.removeEventListener('error', onErr)
      p.removeEventListener('loadedmetadata', onReady)
      p.removeEventListener('play', onPlay)
      cb.current(null)
      p.destroy()
      el.replaceChildren()
    }
    // a new source means a new player
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.kind, key])

  if (source.kind === 'video')
    return (
      <video
        ref={(el) => {
          if (el) media.current = el
        }}
        className={className}
        src={source.src}
        poster={source.poster}
        playsInline
        preload="auto"
        onClick={onClick}
      />
    )
  if (source.kind === 'audio')
    return (
      <audio
        ref={(el) => {
          if (el) media.current = el
        }}
        src={source.src}
        preload="auto"
      />
    )
  if (source.kind === 'image') return <img className={className} src={source.src} alt="" />
  if (source.kind === 'embed')
    return (
      // another platform's own embed page: it plays in their player, on their terms
      <div className={`${className ?? ''} embed embed--${source.provider}`}>
        <iframe className="embed__host" src={source.src} title={`${platformName(source)} post`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
      </div>
    )
  const link = watchUrl(source)
  return (
    // The official player stays fully visible and interactive: nothing is
    // layered over it once it's ready (YouTube's and Spotify's embed terms
    // require this). The poster only covers the gap while it loads.
    <div className={`${className ?? ''} embed embed--${source.kind}`} data-phase={current.phase}>
      <div ref={host} className="embed__host" />
      {poster && current.phase !== 'ready' && current.phase !== 'playing' && <img className="embed__poster" src={poster} alt="" draggable={false} />}
      {current.phase === 'loading' && <span className="embed__loading" aria-label="Loading" />}
      {current.phase === 'error' && (
        <div className="embed__error" role="status">
          <p>{current.message}</p>
          {link && (
            <a className="embed__watch" draggable={false} href={link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              Watch on {platformName(source)}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
