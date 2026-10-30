import { motion } from 'framer-motion'
import { Bookmark, ChevronDown, Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Dial } from '../components/Dial'
import { MediaSurface } from '../components/MediaSurface'
import { creatorById, episodeById } from '../data'
import { useMediaSession } from '../hooks/useMediaSession'
import { useItemError } from '../hooks/useRelationship'
import { useWindowedPlayback } from '../hooks/useWindowedPlayback'
import { formatTime } from '../lib/media'
import { useStore } from '../store/useStore'
import { useUI, type FullEpisodeRequest } from '../store/useUI'
import { usePlayerRef } from './Artists'
import { Caption, isVideo, useSaveEpisode } from './Podcasts'


const announced = new WeakSet<FullEpisodeRequest>()
export function FullEpisode({ request }: { request: FullEpisodeRequest }) {
  const ep = episodeById[request.episodeId]
  const show = creatorById[ep.creatorId]
  const drive = useUI((s) => s.drive)
  const saved = useStore((s) => s.saved.some((x) => x.id === ep.id))
  const setProgress = useStore((s) => s.setEpisodeProgress)
  const recordListen = useStore((s) => s.recordListen)
  const saveEpisode = useSaveEpisode()
  const player = usePlayerRef()
  const [known, setKnown] = useState(ep.duration ?? 0)
  const [error, setError] = useItemError(ep.id)

  const pb = useWindowedPlayback({
    ref: player.ref,
    itemKey: `${ep.id}:${player.version}`,
    start: 0,
    // feeds don't always state a length; the player tells us once loaded
    end: known || 7200,
    autoplay: true,
    active: !drive,
    initialOffset: request.startAt,
    onWindowEnd: ({ listened, length }) => recordListen(ep.creatorId, ep.id, listened, listened / length > 0.85),
  })

  const close = () => {
    const heard = pb.listened()
    if (heard > 20 && !pb.ended) recordListen(ep.creatorId, ep.id, heard, false)
    useUI.getState().openFullEpisode(null)
  }

  useMediaSession(!drive, {
    title: ep.title, artist: show.name, artwork: ep.artwork,
    onPlay: pb.play, onPause: pb.pause, onNext: () => pb.seek(pb.time + 30), onPrevious: () => pb.seek(pb.time - 15),
  })

  // the hand-off from the highlight, said once and quietly
  useEffect(() => {
    if (request.reason === 'auto' && !announced.has(request)) {
      announced.add(request)
      useUI.getState().pushToast({ image: ep.artwork, title: 'Full episode', detail: `Continuing from ${formatTime(request.startAt)}` })
    }
  }, [request, ep.artwork])

  const bucket = Math.floor(pb.time / 5)
  useEffect(() => {
    if (pb.time > 1) setProgress(ep.id, pb.time)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket])

  useEffect(() => {
    if (known) return
    const t = window.setInterval(() => {
      const d = player.ref.current?.duration
      if (d && Number.isFinite(d) && d > 0) setKnown(d)
    }, 500)
    return () => window.clearInterval(t)
  }, [known, player.ref])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === ' ' && !(e.target as HTMLElement).closest('button, [role="slider"]')) {
        e.preventDefault()
        pb.toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const h = ep.highlight
  return (
    <motion.div
      className="episode"
      role="dialog"
      aria-modal="true"
      aria-label={ep.title}
      initial={{ y: '100%' }}
      animate={{ y: 0, transition: { duration: 0.38, ease: [0.22, 0.7, 0.18, 1] } }}
      exit={{ y: '100%', transition: { duration: 0.3, ease: [0.4, 0, 0.7, 0.2] } }}
    >
      <div className="episode__bar">
        <button className="icon-btn" onClick={close} aria-label="Close full episode"><ChevronDown size={26} /></button>
        <button className={`icon-btn ${saved ? 'is-on' : ''}`} onClick={() => saveEpisode(ep, 'button', true)} aria-label={saved ? 'Saved' : 'Save episode'} aria-pressed={saved}>
          <Bookmark size={22} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="episode__media">
        {isVideo(ep) ? (
          <MediaSurface source={ep.media} start={request.startAt} className="episode__video" onPlayer={player.onPlayer} onError={setError} onClick={pb.toggle} />
        ) : (
          <div className="reel__audio">
            <span className={`turntable ${pb.playing ? 'is-playing' : ''}`}><img src={ep.artwork} alt="" /></span>
            <MediaSurface source={ep.media} onPlayer={player.onPlayer} onError={setError} />
          </div>
        )}
        {error && <p className="reel__error">{error}</p>}
      </div>

      <div className="episode__body">
        <p className="episode__show">{show.name}</p>
        <h1 className="episode__title">{ep.title}</h1>
        <Caption cues={ep.cues} time={pb.time} />
        <Dial
          value={pb.time}
          max={pb.length}
          onSeek={pb.seek}
          label={ep.title}
          ranges={[{ start: h.start, end: h.end, label: 'The highlight' }]}
          marks={(ep.chapters ?? []).map((c) => c.start)}
          size="lg"
          tone="dark"
        />
        <div className="episode__controls">
          <button className="icon-btn icon-btn--lg" onClick={() => pb.seek(pb.time - 15)} aria-label="Back 15 seconds"><RotateCcw size={24} /></button>
          <button className="play-btn" onClick={pb.toggle} aria-label={pb.playing ? 'Pause' : 'Play'}>
            {pb.playing ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" />}
          </button>
          <button className="icon-btn icon-btn--lg" onClick={() => pb.seek(pb.time + 30)} aria-label="Forward 30 seconds"><RotateCw size={24} /></button>
        </div>
      </div>
    </motion.div>
  )
}
