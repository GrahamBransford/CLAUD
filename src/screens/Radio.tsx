import { AnimatePresence } from 'framer-motion'
import * as I from '../components/Icons'
import { useCallback, useState } from 'react'
import { Dial } from '../components/Dial'
import { TapFlash, TopBar, useTapFlash } from '../components/Hud'
import { RecordC } from '../components/Logo'
import { MediaSurface } from '../components/MediaSurface'
import { Reel, type Move } from '../components/Reel'
import { creatorById } from '../data'
import { useKeys } from '../hooks/useKeys'
import { useMediaSession } from '../hooks/useMediaSession'
import { useItemError } from '../hooks/useRelationship'
import { useWindowedPlayback, type WindowEnd } from '../hooks/useWindowedPlayback'
import { PODCAST_DESTINATION } from '../lib/streaming'
import { useStore } from '../store/useStore'
import { tapWasUnlock, useUI } from '../store/useUI'
import { radioQueue, type RadioEntry } from '../lib/radio'
import type { Cue, Episode, SaveMethod } from '../types'
import { AUTO_SAVE_RATIO, usePlayerRef, useSaveSong } from './Artists'

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

/** Splits a long line into subtitle-sized pieces, on word boundaries. */
function chunks(text: string, max = 56) {
  const out: string[] = []
  let line = ''
  for (const w of text.split(' ')) {
    if (line && (line + ' ' + w).length > max) {
      out.push(line)
      line = w
    } else line = line ? `${line} ${w}` : w
  }
  if (line) out.push(line)
  return out
}

/**
 * What's being said, as a subtitle. Long lines are shown in timed pieces,
 * each fitting two lines, so nothing is cut and nothing around it moves.
 */
export function Caption({ cues, time }: { cues?: Cue[]; time: number }) {
  if (!cues) return null
  const cur = cues.find((c) => time >= c.start - 0.05 && time < c.end + 0.4)
  if (!cur) return <p className="caption" />
  // narrower screens get shorter pieces, so each still fits two lines
  const parts = chunks(cur.text, window.innerWidth < 380 ? 38 : 56)
  const share = Math.max(0, Math.min(0.999, (time - cur.start) / Math.max(0.1, cur.end - cur.start)))
  const k = Math.floor(share * parts.length)
  return (
    <p className="caption">
      <span key={`${cur.start}-${k}`}>{parts[k]}</span>
    </p>
  )
}

/**
 * The Radio: music and conversations in one stream, like the wireless on the
 * sideboard. A record, then a podcast highlight, then another record. Swipe,
 * scrub and save work exactly as on the single-kind stations; what changes is
 * only what plays next.
 */
export function Radio({ active }: { active: boolean }) {
  const queue = radioQueue()
  const index = useStore((s) => s.radioIndex)
  const setIndex = useStore((s) => s.setRadioIndex)
  const recordListen = useStore((s) => s.recordListen)
  const saved = useStore((s) => s.saved)
  const openFull = useUI((s) => s.openFullEpisode)
  const saveEpisode = useSaveEpisode()
  const saveSong = useSaveSong()
  const [move, setMove] = useState<Move>('next')
  const player = usePlayerRef()
  const flash = useTapFlash()

  const entry = queue[index] as RadioEntry | undefined
  const song = entry?.kind === 'song' ? entry.song : undefined
  const ep = entry?.kind === 'episode' ? entry.ep : undefined
  const item = song ?? ep
  const who = entry ? creatorById[entry.creatorId] : undefined
  const isSaved = entry ? saved.some((s) => s.id === entry.id) : false
  const [error, setError] = useItemError(entry?.id)
  const window_ = song ? song.preview : ep?.highlight

  const go = useCallback(
    (m: Move) => {
      setMove(m)
      setIndex(m === 'prev' ? index - 1 : index + 1)
    },
    [index, setIndex],
  )

  const save = useCallback(
    (via: SaveMethod) => {
      if (song) saveSong(song, via)
      else if (ep) saveEpisode(ep, via)
    },
    [song, ep, saveSong, saveEpisode],
  )

  const onWindowEnd = useCallback(
    ({ listened, length }: WindowEnd) => {
      if (!item) return
      const through = listened / length >= AUTO_SAVE_RATIO
      recordListen(item.creatorId, item.id, listened, through)
      if (song) {
        if (through) saveSong(song, 'listened')
        window.setTimeout(() => go('next'), 900)
      } else if (ep && through) {
        // you stayed for the whole highlight: the full episode simply continues
        openFull({ episodeId: ep.id, startAt: ep.highlight.end, reason: 'auto' })
        setMove('next')
        setIndex(index + 1)
      } else go('next')
    },
    [item, song, ep, recordListen, saveSong, openFull, setIndex, index, go],
  )

  const pb = useWindowedPlayback({
    ref: player.ref,
    itemKey: `${entry?.id ?? 'end'}:${player.version}`,
    start: window_?.start ?? 0,
    end: window_?.end ?? 1,
    autoplay: true,
    active: active && !error,
    onWindowEnd,
  })

  const onMove = useCallback(
    (m: Move) => {
      if (!item) return
      const heard = pb.listened()
      if (m !== 'prev' && heard > 3 && !pb.ended) recordListen(item.creatorId, item.id, heard, false)
      if (m === 'save') save('swipe')
      go(m)
    },
    [item, pb, recordListen, save, go],
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

  useKeys(active && !!item, {
    ArrowRight: () => onMove('save'),
    ArrowLeft: () => onMove('skip'),
    ArrowDown: () => onMove('next'),
    ArrowUp: () => index > 0 && onMove('prev'),
    ' ': pb.toggle,
    f: full,
  })

  useMediaSession(
    active && !!item,
    item && who
      ? { title: item.title, artist: who.name, artwork: item.artwork, onPlay: pb.play, onPause: pb.pause, onNext: () => onMove('skip'),
          onPrevious: () => index > 0 && onMove('prev') }
      : null,
  )

  if (!entry || !item || !who)
    return (
      <section className="screen screen--end">
        <div className="end">
          <span className="end__disc"><RecordC spinning /></span>
          <p className="end__title">That&rsquo;s the end of today&rsquo;s broadcast.</p>
          <button className="pill" onClick={() => { setMove('prev'); setIndex(0) }}>Start again</button>
        </div>
      </section>
    )

  const media = item.media
  const embed = media.kind === 'youtube' || media.kind === 'spotify'
  const video = ep ? isVideo(ep) : true
  return (
    <section className="screen" aria-label="Radio">
      <AnimatePresence custom={move} initial={false} mode="popLayout">
        <Reel key={entry.id} move={move} onMove={onMove} onTap={embed ? undefined : tap} canPrev={index > 0} className={embed ? 'reel--embed' : ''}>
          {song ? (
            <MediaSurface source={song.media} start={song.preview.start} className="reel__media" onPlayer={player.onPlayer} onError={setError} />
          ) : ep && video ? (
            // the picture sits dead centre, with its subtitles on it like television
            <div className="reel__frame">
              <MediaSurface source={ep.media} start={ep.highlight.start} className="reel__media" onPlayer={player.onPlayer} onError={setError} />
              {!embed && <Caption cues={ep.cues} time={ep.highlight.start + pb.time} />}
            </div>
          ) : (
            ep && (
              <div className="reel__audio">
                <span className={`turntable ${pb.playing ? 'is-playing' : ''}`}>
                  <img src={ep.artwork} alt="" />
                </span>
                <MediaSurface source={ep.media} onPlayer={player.onPlayer} onError={setError} />
              </div>
            )
          )}
          <div className="reel__scrim" aria-hidden />
          <div className="reel__meta">
            {ep && !video && !embed && <Caption cues={ep.cues} time={ep.highlight.start + pb.time} />}
            <div className="reel__line">
              <button className="reel__who" onClick={() => useUI.getState().openSheet({ kind: 'creator', creatorId: who.id })}>
                <span>{who.name}</span>
              </button>
              {/* what's on air: a record or a conversation */}
              <span className="reel__kind">{song ? 'Music' : 'Podcast'}</span>
            </div>
            <p className={`reel__title ${ep ? 'reel__title--ep' : ''}`}>{item.title}</p>
          </div>
          {ep && (
            // the long form, quietly to one side
            <div className="rail rail--full">
              <button className="rail__btn" onClick={(e) => { e.stopPropagation(); full() }} aria-label="Full episode">
                <I.Expand size={22} />
              </button>
              <span className="rail__label" aria-hidden>Full episode</span>
            </div>
          )}
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
        <Dial value={pb.time} max={pb.length} onSeek={pb.seek} label={`${item.title} ${song ? 'preview' : 'highlight'}`} tone="dark" showTimes={false} size="slim" />
      </div>
    </section>
  )
}
