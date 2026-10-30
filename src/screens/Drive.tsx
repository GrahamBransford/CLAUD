import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, Heart, Pause, Play, SkipForward, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { RecordGlyph } from '../components/Chrome'
import { Dial } from '../components/Dial'
import { MediaSurface } from '../components/MediaSurface'
import { TierBadge } from '../components/Tier'
import { Wordmark } from '../components/Wordmark'
import { brand } from '../config/brand'
import { creatorById, episodes, songs } from '../data'
import { useMediaSession } from '../hooks/useMediaSession'
import { useItemError, useUniverse } from '../hooks/useRelationship'
import { useWindowedPlayback, type WindowEnd } from '../hooks/useWindowedPlayback'
import { standing } from '../lib/affinity'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { Episode, MediaSource } from '../types'
import { AUTO_SAVE_RATIO, usePlayerRef, useSaveSong } from './Artists'
import { useSaveEpisode } from './Podcasts'

type Station = 'artists' | 'podcasts' | 'record'

/** Audio-only sources. YouTube is never used here: its terms forbid hidden-video playback. */
const audioOf = (m?: MediaSource) => (m && (m.kind === 'audio' || m.kind === 'spotify') ? m : undefined)
const episodeAudio = (e: Episode) => audioOf(e.audio) ?? audioOf(e.media)
const driveSongs = () => songs.filter((s) => audioOf(s.audio) ?? audioOf(s.media))
const driveEpisodes = () => episodes.filter((e) => episodeAudio(e))

/**
 * Simulated CarPlay / Android Auto surface: no moving video, still artwork,
 * large controls. Auto-save and highlight→full-episode progression keep working.
 */
export function Drive({ initial }: { initial: Station }) {
  const [station, setStation] = useState<Station>(initial)
  return (
    <motion.div className="drive" role="dialog" aria-label="Drive mode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <header className="drive__top">
        <Wordmark />
        <div className="drive__stations" role="tablist">
          {(['artists', 'podcasts', 'record'] as Station[]).map((s) => (
            <button key={s} role="tab" aria-selected={station === s} onClick={() => setStation(s)}>
              {s === 'record' ? 'Your Record' : brand.stations[s].label}
            </button>
          ))}
        </div>
        <button className="drive__exit" onClick={() => useUI.getState().setDrive(false)}>Exit Drive</button>
      </header>
      {station === 'record' ? <DriveRecord /> : <DrivePlayer key={station} station={station} />}
      <p className="drive__note">
        Simulated CarPlay / Android Auto view. No moving video while driving; audio keeps playing. Finished songs save
        themselves, and finished highlights roll straight into the full episode.
      </p>
    </motion.div>
  )
}

function DrivePlayer({ station }: { station: 'artists' | 'podcasts' }) {
  const [phase, setPhase] = useState<'highlight' | 'full'>('highlight')
  const [banner, setBanner] = useState<string | null>(null)
  const sIndex = useStore((s) => s.artistsIndex)
  const pIndex = useStore((s) => s.podcastsIndex)
  const setS = useStore((s) => s.setArtistsIndex)
  const setP = useStore((s) => s.setPodcastsIndex)
  const recordListen = useStore((s) => s.recordListen)
  const saved = useStore((s) => s.saved)
  const saveSong = useSaveSong()
  const saveEpisode = useSaveEpisode()
  const player = usePlayerRef()

  const sList = driveSongs()
  const pList = driveEpisodes()
  // Start from the station's current item if it can play in the car, else the first that can.
  const song = sList.find((s) => s === songs[sIndex]) ?? sList[0]
  const ep = pList.find((e) => e === episodes[pIndex]) ?? pList[0]
  const [error, setError] = useItemError(`${station}:${song?.id}:${ep?.id}`)

  const flash = (msg: string) => {
    setBanner(msg)
    window.setTimeout(() => setBanner((b) => (b === msg ? null : b)), 2600)
  }

  const nextSong = useCallback(() => {
    const i = sList.indexOf(song)
    setS(songs.indexOf(sList[(i + 1) % sList.length]))
  }, [sList, song, setS])
  const nextEpisode = useCallback(() => {
    setPhase('highlight')
    const i = pList.indexOf(ep)
    setP(episodes.indexOf(pList[(i + 1) % pList.length]))
  }, [pList, ep, setP])

  const onWindowEnd = useCallback(
    ({ listened, length }: WindowEnd) => {
      const ratio = listened / length
      if (station === 'artists') {
        recordListen(song.creatorId, song.id, listened, ratio >= AUTO_SAVE_RATIO)
        if (ratio >= AUTO_SAVE_RATIO && saveSong(song, 'listened')) flash('Saved. You listened all the way through')
        window.setTimeout(nextSong, 1800)
      } else if (phase === 'highlight') {
        recordListen(ep.creatorId, ep.id, listened, ratio >= AUTO_SAVE_RATIO)
        if (ratio >= AUTO_SAVE_RATIO) {
          flash('Continuing the full episode')
          setPhase('full')
        } else nextEpisode()
      } else {
        recordListen(ep.creatorId, ep.id, listened, ratio > 0.85)
        nextEpisode()
      }
    },
    [station, phase, song, ep, recordListen, saveSong, nextSong, nextEpisode],
  )

  const source = station === 'artists' ? song && (audioOf(song.audio) ?? audioOf(song.media)) : ep && episodeAudio(ep)
  const hl = ep ? (ep.audioHighlight ?? ep.highlight) : undefined
  const pb = useWindowedPlayback({
    ref: player.ref,
    itemKey: `${station}:${station === 'artists' ? song?.id : ep?.id}:${phase}:${player.version}`,
    start: station === 'artists' ? (song?.preview.start ?? 0) : phase === 'highlight' ? (hl?.start ?? 0) : 0,
    end: station === 'artists' ? (song?.preview.end ?? 1) : phase === 'highlight' ? (hl?.end ?? 1) : (ep?.duration ?? 7200),
    initialOffset: station === 'podcasts' && phase === 'full' ? (hl?.end ?? 0) : 0,
    autoplay: true,
    active: !error,
    onWindowEnd,
  })

  const skip = () => {
    const heard = pb.listened()
    if (station === 'artists' && song) {
      if (heard > 3) recordListen(song.creatorId, song.id, heard, false)
      nextSong()
    } else if (ep) {
      if (heard > 3) recordListen(ep.creatorId, ep.id, heard, false)
      nextEpisode()
    }
  }
  const keep = () => {
    if (station === 'artists' && song) {
      if (saveSong(song, 'button')) flash('Saved to your collection')
      nextSong()
    } else if (ep) {
      saveEpisode(ep, 'button')
      flash('Episode saved')
    }
  }

  const item = station === 'artists' ? song : ep
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
        <h1>Nothing here can play without video.</h1>
        <p>Add an audio source (a Spotify track or an audio file) to these items in the content file to hear them in Drive.</p>
      </div>
    )

  const who = creatorById[item.creatorId]?.name
  const mode = station === 'artists' ? 'Preview' : phase === 'highlight' ? 'Highlight' : 'Full episode'
  const isSaved = saved.some((x) => x.id === item.id)
  const skipped = station === 'artists' ? songs.length - sList.length : episodes.length - pList.length

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
          <p className="drive__mode">{mode} · audio only{source.kind === 'spotify' ? ' · Spotify' : ''}</p>
          <h1>{item.title}</h1>
          <p className="drive__who">{who}</p>
          {error ? <p className="drive__error">{error}</p> : <Dial value={pb.time} max={pb.length} label={`${mode} progress`} tone="dark" size="lg" />}
          {skipped > 0 && <p className="drive__skipnote">{skipped} video-only {skipped === 1 ? 'item is' : 'items are'} left out while driving.</p>}
        </div>
      </div>

      <div className="drive__controls">
        <button className="drive__btn" onClick={skip} aria-label="Pass">
          {station === 'artists' ? <X size={44} /> : <SkipForward size={40} />}
          <span>Pass</span>
        </button>
        <button className="drive__btn drive__btn--play" onClick={pb.toggle} aria-label={pb.playing ? 'Pause' : 'Play'}>
          {pb.playing ? <Pause size={52} fill="currentColor" /> : <Play size={52} fill="currentColor" />}
        </button>
        <button className={`drive__btn ${isSaved ? 'is-on' : ''}`} onClick={keep} aria-label="Save">
          {station === 'artists' ? <Heart size={40} fill={isSaved ? 'currentColor' : 'none'} /> : <Bookmark size={40} fill={isSaved ? 'currentColor' : 'none'} />}
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

/** Your Record, simplified for a glance: who's closest, in big type, no motion. */
function DriveRecord() {
  const all = useUniverse().slice(0, 5)
  return (
    <div className="drive-record">
      <div className="drive-record__disc" aria-hidden>
        <RecordGlyph size={220} />
      </div>
      <ol className="drive-record__list">
        {all.map((r, k) => (
          <li key={r.creatorId}>
            <span className="drive-record__rank">{k + 1}</span>
            <img src={creatorById[r.creatorId]?.avatar} alt="" />
            <span className="drive-record__name">
              <strong>{creatorById[r.creatorId]?.name}</strong>
              <em>{standing(r)}</em>
            </span>
            <TierBadge tier={r.tier.id} size="sm" />
          </li>
        ))}
      </ol>
    </div>
  )
}
