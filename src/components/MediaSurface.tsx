import { useEffect, useRef } from 'react'
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
}

/**
 * Renders whatever a content item plays from — a self-hosted file, an
 * official YouTube video or a Spotify embed — and hands back a common
 * PlayerLike so the rest of CIRCA doesn't care which.
 */
export function MediaSurface({ source, className, start = 0, onPlayer, onError, onClick, spotifyHeight = 152 }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const media = useRef<HTMLMediaElement | null>(null)
  const cb = useRef(onPlayer)
  const errCb = useRef(onError)
  useEffect(() => {
    cb.current = onPlayer
    errCb.current = onError
  })

  const key = source.kind === 'youtube' ? source.id : source.kind === 'spotify' ? source.uri : source.src

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
    if (source.kind === 'image' || !host.current) return
    const el = host.current
    const p = source.kind === 'youtube' ? new YouTubePlayer(el, source.id, start) : new SpotifyPlayer(el, source.uri, spotifyHeight)
    const onErr = () =>
      errCb.current?.(
        p.errorCode === -1
          ? `${source.kind === 'youtube' ? 'YouTube' : 'Spotify'} could not be reached from this network.`
          : (YT_ERRORS[p.errorCode ?? 0] ?? 'This item cannot play here.'),
      )
    p.addEventListener('error', onErr)
    cb.current(p)
    return () => {
      p.removeEventListener('error', onErr)
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
  return (
    // The official player stays fully visible and interactive: nothing is
    // layered over it (YouTube's and Spotify's embed terms require this).
    <div className={`${className ?? ''} embed embed--${source.kind}`}>
      <div ref={host} className="embed__host" />
    </div>
  )
}
