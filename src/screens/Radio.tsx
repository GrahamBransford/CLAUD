import { AnimatePresence, motion } from 'framer-motion'
import * as I from '../components/Icons'
import { useCallback, useEffect, useState } from 'react'
import { usePinch } from '../lib/pinch'
import { Dial } from '../components/Dial'
import { TapFlash, useTapFlash } from '../components/Hud'
import { RecordC } from '../components/Logo'
import { MediaSurface, Prefetch } from '../components/MediaSurface'
import type { CSSProperties } from 'react'
import { Reel, type Move } from '../components/Reel'
import { creatorById } from '../data'
import { useKeys } from '../hooks/useKeys'
import { useMediaSession } from '../hooks/useMediaSession'
import { useItemError } from '../hooks/useRelationship'
import { useWindowedPlayback, type WindowEnd } from '../hooks/useWindowedPlayback'
import { PODCAST_DESTINATION } from '../lib/streaming'
import { useStore } from '../store/useStore'
import { tapWasUnlock, useUI } from '../store/useUI'
import { entryAudio, radioQueue, type RadioEntry } from '../lib/radio'
import { useBackgroundStation } from '../lib/background'
import { songWindow } from '../lib/snippet'
import { useKnownDuration } from '../hooks/useKnownDuration'
import { Credit } from '../components/Credit'
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
        pushToast({ image: ep.artwork, title: `Saved to ${PODCAST_DESTINATION.name}`, detail: `${PODCAST_DESTINATION.list} · demo` })
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
  const mini = useUI((s) => !!s.mini)

  const entry = queue[index] as RadioEntry | undefined
  const song = entry?.kind === 'song' ? entry.song : undefined
  const ep = entry?.kind === 'episode' ? entry.ep : undefined
  const item = song ?? ep
  const who = entry ? creatorById[entry.creatorId] : undefined
  const isSaved = entry ? saved.some((s) => s.id === entry.id) : false
  const [error, setError] = useItemError(entry?.id)
  // songs: up to three minutes, unless you ask for the whole thing
  const [fullFor, setFull] = useState<string | null>(null)
  const wholeSong = !!song && fullFor === song.id
  const known = useKnownDuration(player.ref, player.version)
  const songWin = song ? songWindow(song, wholeSong, known) : undefined
  const window_ = songWin ?? ep?.highlight

  const go = useCallback(
    (m: Move) => {
      setMove(m)
      setIndex(m === 'prev' ? index - 1 : index + 1)
    },
    [index, setIndex, setMove],
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
    [item, song, ep, recordListen, saveSong, openFull, setIndex, index, go, setMove],
  )

  const pb = useWindowedPlayback({
    ref: player.ref,
    itemKey: `${entry?.id ?? 'end'}:${player.version}`,
    start: window_?.start ?? 0,
    end: window_?.end ?? 1,
    autoplay: true,
    active: active && !error && !mini,
    onWindowEnd,
  })

  // after the mini player or the full episode: pick up exactly where it got to
  const resume = useUI((s) => s.resume)
  useEffect(() => {
    if (!item || !resume || resume.id !== item.id || !player.ref.current) return
    useUI.getState().setResume(null)
    const rel = resume.time - (window_?.start ?? 0)
    // past the end of this window (a full episode heard further on): the radio moves on
    if (rel >= pb.length - 0.5) return void pb.seek(pb.length - 0.2)
    pb.seek(rel)
    if (active) pb.play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume, item?.id, player.version])

  // locked or in the background: the running order carries on as audio
  useBackgroundStation(active && !mini, {
    index,
    currentEnd: window_?.end,
    element: () => (player.ref.current instanceof HTMLMediaElement ? player.ref.current : null),
    item: (i) => entryAudio(queue[i]),
    land: (i, time, id) => {
      setMove('next')
      setIndex(i)
      useUI.getState().setResume({ id, time })
    },
  })

  // pinch to float it out of the feed, still playing
  const pinch = usePinch(() => {
    const p = player.ref.current
    if (!item || !who || item.media.kind !== 'video') return
    useUI.getState().openMini({ kind: song ? 'song' : 'episode', id: item.id, creatorId: who.id, title: item.title, src: item.media.src, poster: item.artwork, route: 'radio', index, time: p?.currentTime ?? window_?.start ?? 0, vertical: !!song })
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
  // artist videos fill the screen like a reel; podcasts stay whole, lit by the show's own colours
  const fill = media.kind === 'youtube' && item.display === 'fill'
  const embed = (media.kind === 'youtube' || media.kind === 'spotify') && !fill
  const video = ep ? isVideo(ep) : true
  // a whole 16:9 conversation (an embed or a file) sits in the show's own colours, never in black
  const glow = ep && (embed || video) ? who?.palette : undefined
  return (
    <section className="screen" aria-label="Radio" {...pinch}>
      <AnimatePresence custom={move} initial={false} mode="popLayout">
        <Reel key={entry.id} move={move} onMove={onMove} onTap={embed ? undefined : tap} canPrev={index > 0} className={embed ? 'reel--embed' : ''}>
          {glow ? (
            <div className="reel__glow" aria-hidden style={{ '--g1': glow[0], '--g2': glow[1] ?? glow[0], '--g3': glow[2] ?? glow[1] ?? glow[0] } as CSSProperties} />
          ) : (
            embed && item.artwork && <img className="reel__backdrop" src={item.artwork} alt="" aria-hidden />
          )}
          {song ? (
            <MediaSurface source={song.media} start={song.preview.start} className="reel__media" poster={song.artwork} fill={fill} onPlayer={player.onPlayer} onError={setError} />
          ) : ep && video ? (
            // the picture sits dead centre, with its subtitles on it like television
            <div className="reel__frame">
              {/* pause, and the way into the whole conversation appears above the picture */}
              <AnimatePresence>
                {!pb.playing && (
                  <motion.button
                    key="full"
                    className="frame__full"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.22 } }}
                    exit={{ opacity: 0, y: 4, transition: { duration: 0.16 } }}
                    onClick={(e) => { e.stopPropagation(); full() }}
                  >
                    <I.Expand size={15} /> Full episode
                  </motion.button>
                )}
              </AnimatePresence>
              <MediaSurface source={ep.media} start={ep.highlight.start} className="reel__media" poster={ep.artwork} onPlayer={player.onPlayer} onError={setError} />
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
          <Credit kind={song ? 'song' : 'episode'} creatorId={who.id} title={item.title}>
            {ep && !video && !embed && <Caption cues={ep.cues} time={ep.highlight.start + pb.time} />}
          </Credit>
          {song && songWin && songWin.more && !wholeSong && (
            <div className="rail rail--full">
              <button className="rail__btn" onClick={(e) => { e.stopPropagation(); setFull(song.id) }} aria-label="Full song">
                <I.Expand size={22} />
              </button>
              <span className="rail__label" aria-hidden>Full song</span>
            </div>
          )}
          {ep && !video && (
            // audio-only episodes keep a quiet way in to one side
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

      <Prefetch source={(() => { const n = queue[index + 1]; return n ? (n.kind === 'song' ? n.song.media : n.ep.media) : undefined })()} />
      <TapFlash state={flash.state} />

      {/* Swipe is the control; these stay for screen readers and switch access. */}
      <div className="sr-only">
        <button onClick={() => onMove('save')} aria-pressed={isSaved}>Save</button>
        <button onClick={() => onMove('skip')}>Skip</button>
        {ep && <button onClick={full}>Full episode</button>}
      </div>

      <div className="scrubber">
        <Dial value={pb.time} max={pb.length} onSeek={pb.seek} label={`${item.title} ${song ? 'preview' : 'highlight'}`} tone="dark" showTimes={false} size="slim" />
      </div>
    </section>
  )
}
