import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, Heart, Pause, Play, SkipForward, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dial } from '../components/Dial'
import { Wordmark } from '../components/Wordmark'
import { brand } from '../config/brand'
import { creatorById, episodes, songs } from '../data'
import { useWindowedPlayback, type WindowEnd } from '../hooks/useWindowedPlayback'
import { useMediaSession } from '../hooks/useMediaSession'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { AUTO_SAVE_RATIO, useSaveSong } from './Singers'
import { useSaveEpisode } from './Speakers'

type Station = 'singers' | 'speakers'

/**
 * Simulated CarPlay / Android Auto surface. Moving video is replaced by still
 * artwork and playback runs through an audio-only element; auto-save and
 * automatic progression into full episodes keep working hands-free.
 */
export function Drive({ initial }: { initial: Station }) {
  const [station, setStation] = useState<Station>(initial)
  const [phase, setPhase] = useState<'highlight' | 'full'>('highlight')
  const [banner, setBanner] = useState<string | null>(null)
  const sIndex = useStore((s) => s.singersIndex)
  const pIndex = useStore((s) => s.speakersIndex)
  const setS = useStore((s) => s.setSingersIndex)
  const setP = useStore((s) => s.setSpeakersIndex)
  const recordListen = useStore((s) => s.recordListen)
  const saved = useStore((s) => s.saved)
  const saveSong = useSaveSong()
  const saveEpisode = useSaveEpisode()
  const ref = useRef<HTMLAudioElement>(null)

  // The drive surface loops its rotation rather than showing an end screen.
  const song = songs[sIndex % songs.length]
  const ep = episodes[pIndex % episodes.length]

  const flash = (msg: string) => {
    setBanner(msg)
    window.setTimeout(() => setBanner((b) => (b === msg ? null : b)), 2600)
  }

  const nextSong = useCallback(() => setS((sIndex + 1) % songs.length), [sIndex, setS])
  const nextEpisode = useCallback(() => {
    setPhase('highlight')
    setP((pIndex + 1) % episodes.length)
  }, [pIndex, setP])

  const onWindowEnd = useCallback(
    ({ listened, length }: WindowEnd) => {
      const ratio = listened / length
      if (station === 'singers') {
        recordListen(song.creatorId, ratio, listened)
        if (ratio >= AUTO_SAVE_RATIO && saveSong(song, 'listened')) flash('Saved — you listened all the way through')
        window.setTimeout(nextSong, 1800)
      } else if (phase === 'highlight') {
        recordListen(ep.creatorId, ratio, listened)
        if (ratio >= AUTO_SAVE_RATIO) {
          flash('Continuing the full episode')
          setPhase('full')
        } else nextEpisode()
      } else {
        recordListen(ep.creatorId, ratio, listened)
        nextEpisode()
      }
    },
    [station, phase, song, ep, recordListen, saveSong, nextSong, nextEpisode],
  )

  const src = station === 'singers' ? song.video : phase === 'highlight' ? ep.highlight.video : ep.full.video
  const pb = useWindowedPlayback({
    ref,
    itemKey: `${station}:${station === 'singers' ? song.id : ep.id}:${phase}`,
    start: station === 'singers' ? song.previewStart : 0,
    end: station === 'singers' ? song.previewEnd : phase === 'highlight' ? ep.highlight.duration : ep.full.duration,
    initialOffset: station === 'speakers' && phase === 'full' ? ep.highlight.sourceEnd : 0,
    autoplay: true,
    active: true,
    onWindowEnd,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useUI.getState().setDrive(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const skip = () => {
    const heard = pb.listened()
    if (heard > 3) recordListen(station === 'singers' ? song.creatorId : ep.creatorId, heard / pb.length, heard)
    if (station === 'singers') nextSong()
    else nextEpisode()
  }
  const keep = () => {
    if (station === 'singers') {
      if (saveSong(song, 'button')) flash('Saved to your collection')
      nextSong()
    } else {
      saveEpisode(ep, 'button')
      flash('Episode saved')
    }
  }

  // steering-wheel / headset buttons: play, pause, skip
  useMediaSession(true, {
    title: station === 'singers' ? song.title : ep.title,
    artist: station === 'singers' ? creatorById[song.creatorId].name : creatorById[ep.creatorId].name,
    artwork: station === 'singers' ? song.cover : ep.art,
    onPlay: pb.play,
    onPause: pb.pause,
    onNext: skip,
  })

  const art = station === 'singers' ? song.cover : ep.art
  const title = station === 'singers' ? song.title : ep.title
  const who = station === 'singers' ? creatorById[song.creatorId].name : creatorById[ep.creatorId].name
  const mode = station === 'singers' ? 'Preview' : phase === 'highlight' ? 'Highlight' : 'Full episode'
  const isSaved = saved.some((x) => x.id === (station === 'singers' ? song.id : ep.id))

  return (
    <motion.div className="drive" role="dialog" aria-label="Drive mode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* audio-only rendition: no moving video while driving */}
      <audio ref={ref} src={src} preload="auto" />
      <header className="drive__top">
        <Wordmark />
        <div className="drive__stations" role="tablist">
          {(['singers', 'speakers'] as Station[]).map((s) => (
            <button key={s} role="tab" aria-selected={station === s} onClick={() => { setPhase('highlight'); setStation(s) }}>
              {brand.stations[s].label}
            </button>
          ))}
        </div>
        <button className="drive__exit" onClick={() => useUI.getState().setDrive(false)}>Exit Drive</button>
      </header>

      <div className="drive__now">
        <img className="drive__art" src={art} alt="" />
        <div className="drive__text">
          <p className="drive__mode">{mode} · audio only</p>
          <h1>{title}</h1>
          <p className="drive__who">{who}</p>
          <Dial value={pb.time} max={pb.length} label={`${mode} progress`} tone="dark" size="lg" />
        </div>
      </div>

      <div className="drive__controls">
        <button className="drive__btn" onClick={skip} aria-label="Skip">
          {station === 'singers' ? <X size={44} /> : <SkipForward size={40} />}
          <span>Skip</span>
        </button>
        <button className="drive__btn drive__btn--play" onClick={pb.toggle} aria-label={pb.playing ? 'Pause' : 'Play'}>
          {pb.playing ? <Pause size={52} fill="currentColor" /> : <Play size={52} fill="currentColor" />}
        </button>
        <button className={`drive__btn ${isSaved ? 'is-on' : ''}`} onClick={keep} aria-label="Save">
          {station === 'singers' ? <Heart size={40} fill={isSaved ? 'currentColor' : 'none'} /> : <Bookmark size={40} fill={isSaved ? 'currentColor' : 'none'} />}
          <span>{isSaved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      <p className="drive__note">
        Simulated CarPlay / Android Auto view. Video is paused for the road; audio keeps playing. Songs you finish are saved
        automatically, and finished highlights roll straight into the full episode.
      </p>

      <AnimatePresence>
        {banner && (
          <motion.div className="drive__banner" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
            {banner}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
