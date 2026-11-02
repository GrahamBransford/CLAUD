import { AnimatePresence, motion } from 'framer-motion'
import * as I from '../components/Icons'
import { useCallback, useEffect, useState } from 'react'
import { Dial } from '../components/Dial'
import { MediaSurface } from '../components/MediaSurface'
import { brand } from '../config/brand'
import { creatorById, songs } from '../data'
import { useMediaSession } from '../hooks/useMediaSession'
import { useItemError } from '../hooks/useRelationship'
import { useWindowedPlayback, type WindowEnd } from '../hooks/useWindowedPlayback'
import { entryAudio, radioQueue, type RadioEntry } from '../lib/radio'
import { useBackgroundStation } from '../lib/background'
import { songWindow } from '../lib/snippet'
import { PODCAST_DESTINATION, PROVIDERS } from '../lib/streaming'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { Episode, MediaSource } from '../types'
import { AUTO_SAVE_RATIO, usePlayerRef, useSaveSong } from './Artists'
import { useSaveEpisode } from './Radio'

type Station = 'radio' | 'artists'

/** Audio-only sources. YouTube is never used here: its terms forbid hidden-video playback. */
const audioOf = (m?: MediaSource) => (m && (m.kind === 'audio' || m.kind === 'spotify') ? m : undefined)
const episodeAudio = (e: Episode) => audioOf(e.audio) ?? audioOf(e.media)
const songEntries = (): RadioEntry[] => songs.map((song) => ({ kind: 'song', id: song.id, creatorId: song.creatorId, song }))
const playable = (e: RadioEntry) => (e.kind === 'song' ? !!(audioOf(e.song.audio) ?? audioOf(e.song.media)) : !!episodeAudio(e.ep))

/**
 * Simulated CarPlay / Android Auto surface: no moving video, still artwork,
 * large controls. Auto-save and highlight→full-episode progression keep working.
 */
export function Drive({ initial }: { initial: Station }) {
  const [station, setStation] = useState<Station>(initial)
  return (
    <motion.div className="drive" role="dialog" aria-label="Drive mode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <header className="drive__top">
        <div className="drive__stations" role="tablist">
          {(['radio', 'artists'] as Station[]).map((s) => (
            <button key={s} role="tab" aria-selected={station === s} onClick={() => setStation(s)}>
              {brand.stations[s].label}
            </button>
          ))}
        </div>
        <button className="drive__exit" onClick={() => useUI.getState().setDrive(false)} aria-label="Exit drive mode">
          <I.Close size={30} />
        </button>
      </header>
      <DrivePlayer key={station} station={station} />
    </motion.div>
  )
}

function DrivePlayer({ station }: { station: Station }) {
  const [phase, setPhase] = useState<'highlight' | 'full'>('highlight')
  const [banner, setBanner] = useState<string | null>(null)
  const index = useStore((s) => (station === 'radio' ? s.radioIndex : s.artistsIndex))
  const setIndex = useStore((s) => (station === 'radio' ? s.setRadioIndex : s.setArtistsIndex))
  const recordListen = useStore((s) => s.recordListen)
  const saved = useStore((s) => s.saved)
  const saveSong = useSaveSong()
  const saveEpisode = useSaveEpisode()
  const player = usePlayerRef()

  // The station's running order, and the part of it that can play in the car.
  const all = station === 'radio' ? radioQueue() : songEntries()
  const list = all.filter(playable)
  // Start from the station's current item if it can play in the car, else the first that can.
  const cur = list.find((e) => e.id === all[index]?.id) ?? list[0]
  const song = cur?.kind === 'song' ? cur.song : undefined
  const ep = cur?.kind === 'episode' ? cur.ep : undefined
  const [error, setError] = useItemError(`${station}:${cur?.id}`)

  const flash = (msg: string) => {
    setBanner(msg)
    window.setTimeout(() => setBanner((b) => (b === msg ? null : b)), 2600)
  }

  const next = useCallback(() => {
    setPhase('highlight')
    const n = list[(list.indexOf(cur) + 1) % list.length]
    setIndex(all.findIndex((e) => e.id === n.id))
  }, [list, all, cur, setIndex])

  const onWindowEnd = useCallback(
    ({ listened, length }: WindowEnd) => {
      const ratio = listened / length
      if (song) {
        recordListen(song.creatorId, song.id, listened, ratio >= AUTO_SAVE_RATIO)
        if (ratio >= AUTO_SAVE_RATIO && saveSong(song, 'listened')) flash('Saved. You listened all the way through')
        window.setTimeout(next, 1800)
      } else if (!ep) return
      else if (phase === 'highlight') {
        recordListen(ep.creatorId, ep.id, listened, ratio >= AUTO_SAVE_RATIO)
        if (ratio >= AUTO_SAVE_RATIO) {
          flash('Continuing the full episode')
          setPhase('full')
        } else next()
      } else {
        recordListen(ep.creatorId, ep.id, listened, ratio > 0.85)
        next()
      }
    },
    [phase, song, ep, recordListen, saveSong, next],
  )

  const source = song ? audioOf(song.audio) ?? audioOf(song.media) : ep && episodeAudio(ep)
  const hl = ep ? (ep.audioHighlight ?? ep.highlight) : undefined
  const winStart = song ? songWindow(song).start : phase === 'highlight' ? (hl?.start ?? 0) : 0
  const winEnd = song ? songWindow(song).end : phase === 'highlight' ? (hl?.end ?? 1) : (ep?.duration ?? 7200)
  const pb = useWindowedPlayback({
    ref: player.ref,
    itemKey: `${station}:${cur?.id}:${phase}:${player.version}`,
    start: winStart,
    end: winEnd,
    initialOffset: ep && phase === 'full' ? (hl?.end ?? 0) : 0,
    autoplay: true,
    active: !error,
    onWindowEnd,
  })

  // locked or in the background (the car): the station carries on as audio
  useBackgroundStation(!!cur, {
    index: cur ? all.indexOf(cur) : -1,
    currentEnd: winEnd,
    element: () => (player.ref.current instanceof HTMLMediaElement ? player.ref.current : null),
    item: (i) => (all[i] && playable(all[i]) ? entryAudio(all[i]) : undefined),
    land: (i, time, id) => {
      setPhase('highlight')
      setIndex(i)
      useUI.getState().setResume({ id, time })
    },
  })

  // back from the background: pick up where it got to
  const resume = useUI((s) => s.resume)
  useEffect(() => {
    if (!cur || !resume || resume.id !== cur.id || !player.ref.current) return
    useUI.getState().setResume(null)
    const rel = resume.time - winStart
    if (rel > 0) pb.seek(rel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume, cur?.id, player.version])

  const skip = () => {
    const heard = pb.listened()
    if (song) {
      if (heard > 3) recordListen(song.creatorId, song.id, heard, false)
      next()
    } else if (ep) {
      if (heard > 3) recordListen(ep.creatorId, ep.id, heard, false)
      next()
    }
  }
  const keep = () => {
    if (song) {
      if (saveSong(song, 'button')) flash(`Saved to ${PROVIDERS[useStore.getState().streaming ?? 'spotify'].name}`)
      next()
    } else if (ep) {
      saveEpisode(ep, 'button')
      flash(`Saved to ${PODCAST_DESTINATION.name}`)
    }
  }

  const item = song ?? ep
  useMediaSession(!!item, item ? {
    title: item.title,
    artist: creatorById[item.creatorId]?.name ?? '',
    artwork: item.artwork,
    onPlay: pb.play,
    onPause: pb.pause,
    onNext: skip,
  } : null)

  if (!item || !source)
    return (
      <div className="drive__empty">
        <h1>Nothing to play here while driving.</h1>
      </div>
    )

  const who = creatorById[item.creatorId]?.name
  const mode = song ? (station === 'radio' ? 'Music' : 'Preview') : phase === 'highlight' ? 'Highlight' : 'Full episode'
  const isSaved = saved.some((x) => x.id === item.id)

  return (
    <>
      <div className="drive__now">
        <div className="drive__artcol">
          <img className="drive__art" src={item.artwork} alt="" />
          {/* Spotify's own player stays visible, as its embed terms require */}
          <div className={source.kind === 'spotify' ? 'drive__spotify' : 'drive__hidden'}>
            <MediaSurface key={`${item.id}:${phase}`} source={source} onPlayer={player.onPlayer} onError={setError} spotifyHeight={80} />
          </div>
        </div>
        <div className="drive__text">
          <p className="drive__mode">{mode}</p>
          <h1>{item.title}</h1>
          <p className="drive__who">{who}</p>
          {error ? <p className="drive__error">{error}</p> : <Dial value={pb.time} max={pb.length} label={`${mode} progress`} tone="dark" size="lg" />}
        </div>
      </div>

      <div className="drive__controls">
        <button className="drive__btn" onClick={skip} aria-label="Skip">
          <I.Skip size={40} />
          <span>Skip</span>
        </button>
        <button className="drive__btn drive__btn--play" onClick={pb.toggle} aria-label={pb.playing ? 'Pause' : 'Play'}>
          {pb.playing ? <I.Pause size={54} /> : <I.Play size={54} />}
        </button>
        <button className={`drive__btn ${isSaved ? 'is-on' : ''}`} onClick={keep} aria-label="Save">
          <I.Save size={42} on={isSaved} />
          <span>{isSaved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      <AnimatePresence>
        {banner && (
          <motion.div className="drive__banner" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
            {banner}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
