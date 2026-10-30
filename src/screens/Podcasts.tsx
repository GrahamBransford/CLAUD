import { AnimatePresence } from 'framer-motion'
import { useCallback, useState } from 'react'
import { Dial } from '../components/Dial'
import { TapFlash, TopBar, useTapFlash } from '../components/Hud'
import { RecordC } from '../components/Logo'
import { MediaSurface } from '../components/MediaSurface'
import { Reel, type Move } from '../components/Reel'
import { creatorById, episodes } from '../data'
import { useKeys } from '../hooks/useKeys'
import { useMediaSession } from '../hooks/useMediaSession'
import { useItemError } from '../hooks/useRelationship'
import { useWindowedPlayback, type WindowEnd } from '../hooks/useWindowedPlayback'
import { PODCAST_DESTINATION } from '../lib/streaming'
import { useStore } from '../store/useStore'
import { tapWasUnlock, useUI } from '../store/useUI'
import type { Cue, Episode, SaveMethod } from '../types'
import { AUTO_SAVE_RATIO, usePlayerRef } from './Artists'

/** Audio-only episodes are presented as audio, never dressed up as video. */
export const isVideo = (ep: Episode) => ep.media.kind === 'video' || ep.media.kind === 'youtube'

export function useSaveEpisode() {
  const save = useStore((s) => s.save)
  const unsave = useStore((s) => s.unsave)
  const pushToast = useUI((s) => s.pushToast)
  return useCallback(
    (ep: Episode, via: SaveMethod, toggle = false) => {
      if (toggle && useStore.getState().isSaved(ep.id)) {
        unsave(ep.id)
        return
      }
      if (save(ep.id, 'episode', via))
        pushToast({ image: ep.artwork, title: `Saved to ${PODCAST_DESTINATION.name}`, detail: `${PODCAST_DESTINATION.list} · demo connection, nothing sent` })
    },
    [save, unsave, pushToast],
  )
}

/** One line of what's being said, as a subtitle. */
export function Caption({ cues, time }: { cues?: Cue[]; time: number }) {
  if (!cues) return null
  const cur = cues.find((c) => time >= c.start - 0.05 && time < c.end + 0.4)
  return <p className="caption">{cur ? <span key={cur.start}>{cur.text}</span> : null}</p>
}

export function Podcasts({ active }: { active: boolean }) {
  const index = useStore((s) => s.podcastsIndex)
  const setIndex = useStore((s) => s.setPodcastsIndex)
  const recordListen = useStore((s) => s.recordListen)
  const saved = useStore((s) => s.saved)
  const openFull = useUI((s) => s.openFullEpisode)
  const saveEpisode = useSaveEpisode()
  const [move, setMove] = useState<Move>('next')
  const player = usePlayerRef()
  const flash = useTapFlash()

  const ep = episodes[index] as Episode | undefined
  const show = ep ? creatorById[ep.creatorId] : undefined
  const isSaved = ep ? saved.some((s) => s.id === ep.id) : false
  const [error, setError] = useItemError(ep?.id)

  const go = useCallback(
    (m: Move) => {
      setMove(m)
      setIndex(m === 'prev' ? index - 1 : index + 1)
    },
    [index, setIndex],
  )

  const onWindowEnd = useCallback(
    ({ listened, length }: WindowEnd) => {
      if (!ep) return
      const through = listened / length >= AUTO_SAVE_RATIO
      recordListen(ep.creatorId, ep.id, listened, through)
      if (through) {
        // you stayed for the whole highlight: the full episode simply continues
        openFull({ episodeId: ep.id, startAt: ep.highlight.end, reason: 'auto' })
        setMove('next')
        setIndex(index + 1)
      } else go('next')
    },
    [ep, recordListen, openFull, setIndex, index, go],
  )

  const pb = useWindowedPlayback({
    ref: player.ref,
    itemKey: `${ep?.id ?? 'end'}:${player.version}`,
    start: ep?.highlight.start ?? 0,
    end: ep?.highlight.end ?? 1,
    autoplay: true,
    active: active && !error,
    onWindowEnd,
  })

  const onMove = useCallback(
    (m: Move) => {
      if (!ep) return
      const heard = pb.listened()
      if (m !== 'prev' && heard > 3 && !pb.ended) recordListen(ep.creatorId, ep.id, heard, false)
      if (m === 'save') saveEpisode(ep, 'swipe')
      go(m)
    },
    [ep, pb, recordListen, saveEpisode, go],
  )

  const full = useCallback(() => {
    if (!ep) return
    pb.pause()
    openFull({ episodeId: ep.id, startAt: ep.highlight.start + pb.time, reason: 'manual' })
  }, [ep, pb, openFull])

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

  useKeys(active && !!ep, {
    ArrowRight: () => onMove('save'),
    ArrowLeft: () => onMove('skip'),
    ArrowDown: () => onMove('next'),
    ArrowUp: () => index > 0 && onMove('prev'),
    ' ': pb.toggle,
    f: full,
  })

  useMediaSession(
    active && !!ep,
    ep && show
      ? { title: ep.title, artist: show.name, artwork: ep.artwork, onPlay: pb.play, onPause: pb.pause, onNext: () => onMove('skip') }
      : null,
  )

  if (!ep || !show)
    return (
      <section className="screen screen--end">
        <div className="end">
          <span className="end__disc"><RecordC spinning /></span>
          <p className="end__title">That&rsquo;s every conversation for today.</p>
          <button className="pill" onClick={() => { setMove('prev'); setIndex(0) }}>Start again</button>
        </div>
      </section>
    )

  const h = ep.highlight
  const video = isVideo(ep)
  const embed = ep.media.kind === 'youtube' || ep.media.kind === 'spotify'
  return (
    <section className="screen" aria-label="Podcasts">
      <AnimatePresence custom={move} initial={false} mode="popLayout">
        <Reel key={ep.id} move={move} onMove={onMove} onTap={embed ? undefined : tap} canPrev={index > 0} className={embed ? 'reel--embed' : ''}>
          {video ? (
            <MediaSurface source={ep.media} start={h.start} className="reel__media reel__media--wide" onPlayer={player.onPlayer} onError={setError} />
          ) : (
            <div className="reel__audio">
              <span className={`turntable ${pb.playing ? 'is-playing' : ''}`}>
                <img src={ep.artwork} alt="" />
              </span>
              <MediaSurface source={ep.media} onPlayer={player.onPlayer} onError={setError} />
            </div>
          )}
          <div className="reel__scrim" aria-hidden />
          <div className="reel__meta">
            {!embed && <Caption cues={ep.cues} time={h.start + pb.time} />}
            <button className="reel__who" onClick={() => useUI.getState().openSheet({ kind: 'creator', creatorId: show.id })}>
              {show.name}
            </button>
            <p className="reel__title reel__title--ep">{ep.title}</p>
            <button className="pill pill--light" onClick={(e) => { e.stopPropagation(); full() }}>
              Full episode
            </button>
          </div>
          {error && <p className="reel__error">{error}</p>}
        </Reel>
      </AnimatePresence>

      <TopBar playing={pb.playing} />
      <TapFlash state={flash.state} />

      {/* Swipe is the control; these stay for screen readers and switch access. */}
      <div className="sr-only">
        <button onClick={() => onMove('save')} aria-pressed={isSaved}>Save</button>
        <button onClick={() => onMove('skip')}>Skip</button>
      </div>

      <div className="scrubber">
        <Dial value={pb.time} max={pb.length} onSeek={pb.seek} label={`${ep.title} highlight`} tone="dark" showTimes={false} size="slim" />
      </div>
    </section>
  )
}
