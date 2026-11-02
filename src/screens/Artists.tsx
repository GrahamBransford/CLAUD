import { AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dial } from '../components/Dial'
import { MediaSurface, Prefetch } from '../components/MediaSurface'
import { Reel, type Move } from '../components/Reel'
import { TapFlash, useTapFlash } from '../components/Hud'
import { RecordC } from '../components/Logo'
import { creatorById, songs } from '../data'
import { useKeys } from '../hooks/useKeys'
import { useMediaPosition, useMediaSession } from '../hooks/useMediaSession'
import { useItemError } from '../hooks/useRelationship'
import { useWindowedPlayback, type WindowEnd } from '../hooks/useWindowedPlayback'
import type { PlayerLike } from '../lib/players'
import { PROVIDERS } from '../lib/streaming'
import { songWindow } from '../lib/snippet'
import { followOnSave } from '../lib/follow'
import { syncedPlayer, useBackgroundStation } from '../lib/background'
import { songAudio } from '../lib/radio'
import { useKnownDuration } from '../hooks/useKnownDuration'
import { usePinch } from '../lib/pinch'
import { Credit } from '../components/Credit'
import * as I from '../components/Icons'
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
      const fresh = save(song.id, 'song', via)
      const provider = PROVIDERS[streaming ?? 'spotify']
      // a save you chose (not one made by listening through) also follows the artist
      const followed = via !== 'listened' ? followOnSave(song.creatorId, provider) : null
      if (!fresh && !followed) return false
      pushToast(
        fresh
          ? { image: song.artwork, title: `Saved to ${provider.name}`, detail: `${followed ?? provider.playlistFor(song)} · demo`, ms: followed ? 4200 : undefined }
          : { image: song.artwork, title: followed!, detail: 'demo', ms: 3600 },
      )
      return fresh
    },
    [save, streaming, pushToast],
  )
}

/** Keeps a ref to whichever player a MediaSurface creates, and a version to re-wire hooks. */
export function usePlayerRef(synced = false) {
  const ref = useRef<PlayerLike | null>(null)
  const [version, setVersion] = useState(0)
  const onPlayer = useCallback(
    (p: PlayerLike | null) => {
      if (p) {
        // the Radio and Music play their sound through the shared audio element, so it carries on locked
        ref.current = synced && p instanceof HTMLMediaElement ? syncedPlayer(p) : p
        setVersion((v) => v + 1)
      }
    },
    [synced],
  )
  return { ref, version, onPlayer }
}

export function Artists({ active }: { active: boolean }) {
  const index = useStore((s) => s.artistsIndex)
  const setIndex = useStore((s) => s.setArtistsIndex)
  const recordListen = useStore((s) => s.recordListen)
  const saved = useStore((s) => s.saved)
  const saveSong = useSaveSong()
  const [move, setMove] = useState<Move>('next')
  const player = usePlayerRef(true)
  const flash = useTapFlash()
  const mini = useUI((s) => !!s.mini)

  const song = songs[index] as Song | undefined
  const creator = song ? creatorById[song.creatorId] : undefined
  const isSaved = song ? saved.some((s) => s.id === song.id) : false
  const [error, setError] = useItemError(song?.id)
  // up to three minutes, unless you ask for the whole song
  const [fullFor, setFull] = useState<string | null>(null)
  const full = !!song && fullFor === song.id
  const known = useKnownDuration(player.ref, player.version)
  const win = song ? songWindow(song, full, known) : { start: 0, end: 1, more: false }

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
    start: win.start,
    end: win.end,
    autoplay: true,
    active: active && !error && !mini,
    onWindowEnd,
  })

  // after the mini player or a full screen: pick up exactly where it got to
  const resume = useUI((s) => s.resume)
  useEffect(() => {
    if (!song || !resume || resume.id !== song.id || !player.ref.current) return
    pb.seek(resume.time - win.start)
    useUI.getState().setResume(null)
    if (resume.paused) pb.pause()
    else if (active) pb.play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume, song?.id, player.version])

  // locked or in the background: the songs carry on as audio
  useBackgroundStation(active && !mini, {
    index,
    currentEnd: win.end,
    player: () => player.ref.current,
    item: (i) => songAudio(songs[i]),
    land: (i, time, id, playing) => {
      setMove('next')
      setIndex(i)
      useUI.getState().setResume({ id, time, paused: !playing })
    },
  })

  // pinch to float it out of the feed, still playing
  const pinch = usePinch(() => {
    const p = player.ref.current
    if (!song || !creator || song.media.kind !== 'video') return
    useUI.getState().openMini({ kind: 'song', id: song.id, creatorId: creator.id, title: song.title, src: song.media.src, poster: song.artwork, route: 'artists', index, time: p?.currentTime ?? win.start, vertical: true })
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
    ArrowLeft: () => onMove('skip'),
    ArrowDown: () => onMove('next'),
    ArrowUp: () => index > 0 && onMove('prev'),
    ' ': pb.toggle,
  })

  useMediaSession(
    active && !!song,
    song && creator
      ? { title: song.title, artist: creator.name, album: song.release, artwork: song.artwork,
          onPlay: pb.play, onPause: pb.pause, onSeek: pb.seek, onNext: () => onMove('skip'), onPrevious: () => index > 0 && onMove('prev') }
      : null,
  )
  useMediaPosition(active && !!song, pb.time, pb.length, pb.playing)

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

  // artist videos fill the screen like a reel; only whole-frame embeds keep the official player's own touch
  const fill = song.media.kind === 'youtube' && song.display === 'fill'
  const embed = (song.media.kind === 'youtube' || song.media.kind === 'spotify') && !fill
  return (
    <section className="screen" aria-label="Artists" {...pinch}>
      <AnimatePresence custom={move} initial={false} mode="popLayout">
        <Reel key={song.id} move={move} onMove={onMove} onTap={embed ? undefined : tap} canPrev={index > 0} className={embed ? 'reel--embed' : ''}>
          {embed && <img className="reel__backdrop" src={song.artwork} alt="" aria-hidden />}
          <MediaSurface source={song.media} start={song.preview.start} className="reel__media" poster={song.artwork} fill={fill} onPlayer={player.onPlayer} onError={setError} />
          <div className="reel__scrim" aria-hidden />
          <Credit kind="song" creatorId={creator.id} title={song.title} />
          {win.more && !full && (
            <div className="rail rail--full">
              <button className="rail__btn" onClick={(e) => { e.stopPropagation(); setFull(song.id) }} aria-label="Full song">
                <I.Expand size={22} />
              </button>
              <span className="rail__label" aria-hidden>Full song</span>
            </div>
          )}
          {error && <p className="reel__error">{error}</p>}
        </Reel>
      </AnimatePresence>

      <TapFlash state={flash.state} />
      <Prefetch source={songs[index + 1]?.media} />

      {/* Swipe is the control; these stay for screen readers and switch access. */}
      <div className="sr-only">
        <button onClick={() => onMove('save')} aria-pressed={isSaved}>Save</button>
        <button onClick={() => onMove('skip')}>Skip</button>
      </div>

      <div className="scrubber">
        <Dial value={pb.time} max={pb.length} onSeek={pb.seek} label={`${song.title} preview`} tone="dark" showTimes={false} size="slim" />
      </div>
    </section>
  )
}
