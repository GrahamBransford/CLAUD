import { AnimatePresence } from 'framer-motion'
import { Heart, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Dial } from '../components/Dial'
import { MediaSurface } from '../components/MediaSurface'
import { Reel, type Move } from '../components/Reel'
import { TopBar, TapFlash, useTapFlash } from '../components/Hud'
import { RecordC } from '../components/Logo'
import { creatorById, songs } from '../data'
import { useKeys } from '../hooks/useKeys'
import { useMediaSession } from '../hooks/useMediaSession'
import { useItemError } from '../hooks/useRelationship'
import { useWindowedPlayback, type WindowEnd } from '../hooks/useWindowedPlayback'
import type { PlayerLike } from '../lib/players'
import { PROVIDERS } from '../lib/streaming'
import { useStore } from '../store/useStore'
import { tapWasUnlock, useUI } from '../store/useUI'
import type { SaveMethod, Song } from '../types'

/** Finishing at least this share of a preview counts as "listened through". */
export const AUTO_SAVE_RATIO = 0.85

/**
 * Saving goes to the listener's streaming service when one is connected
 * (in this prototype that connection is a labelled demo), otherwise it is
 * kept in CIRCA — and the toast says which.
 */
export function useSaveSong() {
  const save = useStore((s) => s.save)
  const streaming = useStore((s) => s.streaming)
  const pushToast = useUI((s) => s.pushToast)
  return useCallback(
    (song: Song, via: SaveMethod) => {
      if (!save(song.id, 'song', via)) return false
      const provider = streaming ? PROVIDERS[streaming] : null
      pushToast(
        provider
          ? { image: song.artwork, title: `Saved to ${provider.name}`, detail: `${provider.playlistFor(song)} · demo connection, nothing sent` }
          : {
              image: song.artwork,
              title: via === 'listened' ? 'Saved, you heard it through' : 'Saved in CIRCA',
              detail: 'No streaming service connected',
              action: { label: 'Connect', run: () => useUI.getState().openSheet({ kind: 'settings' }) },
            },
      )
      return true
    },
    [save, streaming, pushToast],
  )
}

/** Keeps a ref to whichever player a MediaSurface creates, and a version to re-wire hooks. */
export function usePlayerRef() {
  const ref = useRef<PlayerLike | null>(null)
  const [version, setVersion] = useState(0)
  const onPlayer = useCallback((p: PlayerLike | null) => {
    if (p) {
      ref.current = p
      setVersion((v) => v + 1)
    }
  }, [])
  return { ref, version, onPlayer }
}

export function Artists({ active }: { active: boolean }) {
  const index = useStore((s) => s.artistsIndex)
  const setIndex = useStore((s) => s.setArtistsIndex)
  const recordListen = useStore((s) => s.recordListen)
  const saved = useStore((s) => s.saved)
  const saveSong = useSaveSong()
  const [move, setMove] = useState<Move>('next')
  const player = usePlayerRef()
  const flash = useTapFlash()

  const song = songs[index] as Song | undefined
  const creator = song ? creatorById[song.creatorId] : undefined
  const isSaved = song ? saved.some((s) => s.id === song.id) : false
  const [error, setError] = useItemError(song?.id)

  const go = useCallback(
    (m: Move) => {
      setMove(m)
      setIndex(m === 'prev' ? index - 1 : index + 1)
    },
    [index, setIndex],
  )

  const onWindowEnd = useCallback(
    ({ listened, length }: WindowEnd) => {
      if (!song) return
      const through = listened / length >= AUTO_SAVE_RATIO
      recordListen(song.creatorId, song.id, listened, through)
      if (through) saveSong(song, 'listened')
      window.setTimeout(() => go('next'), 900)
    },
    [song, recordListen, saveSong, go],
  )

  const pb = useWindowedPlayback({
    ref: player.ref,
    itemKey: `${song?.id ?? 'end'}:${player.version}`,
    start: song?.preview.start ?? 0,
    end: song?.preview.end ?? 1,
    autoplay: true,
    active: active && !error,
    onWindowEnd,
  })

  const onMove = useCallback(
    (m: Move) => {
      if (!song) return
      const heard = pb.listened()
      if (m !== 'prev' && heard > 3 && !pb.ended) recordListen(song.creatorId, song.id, heard, false)
      if (m === 'save') saveSong(song, 'swipe')
      go(m)
    },
    [song, pb, recordListen, saveSong, go],
  )

  const tap = () => {
    if (tapWasUnlock()) return
    const p = player.ref.current
    if (p?.muted) {
      useUI.getState().unlockAudio()
      return
    }
    flash.show(pb.playing ? 'pause' : 'play')
    pb.toggle()
  }

  useKeys(active && !!song, {
    ArrowRight: () => onMove('save'),
    ArrowLeft: () => onMove('pass'),
    ArrowDown: () => onMove('next'),
    ArrowUp: () => index > 0 && onMove('prev'),
    ' ': pb.toggle,
  })

  useMediaSession(
    active && !!song,
    song && creator
      ? { title: song.title, artist: creator.name, album: song.release, artwork: song.artwork,
          onPlay: pb.play, onPause: pb.pause, onNext: () => onMove('pass'), onPrevious: () => index > 0 && onMove('prev') }
      : null,
  )

  if (!song || !creator)
    return (
      <section className="screen screen--end">
        <div className="end">
          <span className="end__disc"><RecordC spinning /></span>
          <p className="end__title">That&rsquo;s today&rsquo;s rotation.</p>
          <button className="pill" onClick={() => { setMove('prev'); setIndex(0) }}>Start again</button>
        </div>
      </section>
    )

  const embed = song.media.kind === 'youtube' || song.media.kind === 'spotify'
  return (
    <section className="screen" aria-label="Artists">
      <AnimatePresence custom={move} initial={false} mode="popLayout">
        <Reel key={song.id} move={move} onMove={onMove} onTap={embed ? undefined : tap} canPrev={index > 0} className={embed ? 'reel--embed' : ''}>
          <MediaSurface source={song.media} start={song.preview.start} className="reel__media" onPlayer={player.onPlayer} onError={setError} />
          <div className="reel__scrim" aria-hidden />
          <div className="reel__meta">
            <button className="reel__who" onClick={() => useUI.getState().openSheet({ kind: 'creator', creatorId: creator.id })}>
              {creator.name}
            </button>
            <p className="reel__title">{song.title}</p>
          </div>
          {error && <p className="reel__error">{error}</p>}
        </Reel>
      </AnimatePresence>

      <TopBar playing={pb.playing} />
      <TapFlash state={flash.state} />

      <div className="rail">
        <button className={`rail__btn rail__btn--save ${isSaved ? 'is-on' : ''}`} onClick={() => onMove('save')} aria-label="Save">
          <Heart size={26} strokeWidth={2} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
        <button className="rail__btn" onClick={() => onMove('pass')} aria-label="Pass">
          <X size={26} strokeWidth={2} />
        </button>
      </div>

      <div className="scrubber">
        <Dial value={pb.time} max={pb.length} onSeek={pb.seek} label={`${song.title} preview`} tone="dark" showTimes={false} size="slim" />
      </div>
    </section>
  )
}
