import { motion } from 'framer-motion'
import { ArrowLeft, Bookmark, Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Dial } from '../components/Dial'
import { Transcript } from '../components/Transcript'
import { creatorById, episodeById } from '../data'
import { useWindowedPlayback } from '../hooks/useWindowedPlayback'
import { useMediaSession } from '../hooks/useMediaSession'
import { formatTime } from '../lib/media'
import { useStore } from '../store/useStore'
import { useUI, type FullEpisodeRequest } from '../store/useUI'
import { hostLine, useSaveEpisode } from './Speakers'

const SPEEDS = [1, 1.25, 1.5]

export function FullEpisode({ request }: { request: FullEpisodeRequest }) {
  const ep = episodeById[request.episodeId]
  const show = creatorById[ep.creatorId]
  const close = () => useUI.getState().openFullEpisode(null)
  const drive = useUI((s) => s.drive)
  const saved = useStore((s) => s.saved.some((x) => x.id === ep.id))
  const setProgress = useStore((s) => s.setEpisodeProgress)
  const recordListen = useStore((s) => s.recordListen)
  const saveEpisode = useSaveEpisode()
  const ref = useRef<HTMLVideoElement>(null)
  const [startAt, setStartAt] = useState(request.startAt)
  const [speed, setSpeed] = useState(1)
  const [banner, setBanner] = useState(request.startAt > 5)

  const pb = useWindowedPlayback({
    ref,
    itemKey: ep.id,
    start: 0,
    end: ep.full.duration,
    autoplay: true,
    active: !drive,
    initialOffset: startAt,
    onWindowEnd: ({ listened, length }) => recordListen(ep.creatorId, listened / length, listened),
  })

  useMediaSession(!drive, {
    title: ep.title, artist: show.name, album: 'Full episode', artwork: ep.art,
    onPlay: pb.play, onPause: pb.pause,
    onNext: () => pb.seek(pb.time + 30), onPrevious: () => pb.seek(pb.time - 15),
  })

  // Remember where the listener is, every few seconds.
  const bucket = Math.floor(pb.time / 5)
  useEffect(() => {
    if (pb.time > 1) setProgress(ep.id, pb.time)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket])

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed
  }, [speed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave()
      else if (e.key === ' ' && !(e.target as HTMLElement).closest('button, [role="slider"]')) {
        e.preventDefault()
        pb.toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const leave = () => {
    const heard = pb.listened()
    if (heard > 20 && !pb.ended) recordListen(ep.creatorId, heard / ep.full.duration, heard)
    close()
  }

  const chapterIdx = ep.chapters.findLastIndex((c) => c.start <= pb.time + 0.5)
  const h = ep.highlight
  const people = Object.values(ep.speakers).map((p) => ({
    name: p.name,
    role: ep.guests.includes(p.name) ? 'Guest' : 'Host',
  }))

  return (
    <motion.div
      className="full-episode"
      role="dialog"
      aria-modal="true"
      aria-label={`Full episode: ${ep.title}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <div className="full-episode__bar">
        <button className="link-btn link-btn--strong" onClick={leave}>
          <ArrowLeft size={18} /> Back to discovery
        </button>
        <span className="full-episode__show">{show.name}</span>
        <button className={`chip-btn ${saved ? 'is-on' : ''}`} onClick={() => saveEpisode(ep, 'button', true)} aria-pressed={saved}>
          <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /> <span>{saved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      <div className="full-episode__body">
        <div className="full-episode__main">
          {banner && (
            <div className="resume-banner">
              <p>
                {request.reason === 'auto'
                  ? <>You listened through the highlight, so we kept going. Picking up right after it, at <strong>{formatTime(request.startAt)}</strong>.</>
                  : <>Picking up exactly where you were, at <strong>{formatTime(request.startAt)}</strong>.</>}
              </p>
              <button className="link-btn" onClick={() => { setStartAt(0); pb.seek(0); setBanner(false); pb.play() }}>
                Start from the beginning
              </button>
            </div>
          )}
          <div className="full-episode__screen">
            <video
              ref={ref}
              src={ep.full.video}
              poster={ep.full.poster}
              playsInline
              preload="auto"
              onClick={pb.toggle}
            />
            {!pb.playing && (
              <button className="sleeve__play" onClick={pb.toggle} aria-label="Play episode">
                <Play size={30} fill="currentColor" />
              </button>
            )}
          </div>
          <Dial
            value={pb.time}
            max={pb.length}
            onSeek={pb.seek}
            label={`Episode ${ep.title}`}
            ranges={[{ start: h.sourceStart, end: h.sourceEnd, label: 'The highlight came from here' }]}
            marks={ep.chapters.map((c) => c.start)}
            size="lg"
          />
          <div className="full-episode__legend">
            <span><i className="swatch swatch--range" /> The highlight you heard</span>
            <span><i className="swatch swatch--mark" /> Chapters</span>
          </div>
          <div className="controls controls--episode">
            <button className="ctl ctl--ghost" onClick={() => pb.seek(pb.time - 15)} aria-label="Back 15 seconds"><RotateCcw size={20} /><small>15</small></button>
            <button className="ctl ctl--play" onClick={pb.toggle} aria-label={pb.playing ? 'Pause' : 'Play'}>
              {pb.playing ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" />}
            </button>
            <button className="ctl ctl--ghost" onClick={() => pb.seek(pb.time + 30)} aria-label="Forward 30 seconds"><RotateCw size={20} /><small>30</small></button>
            <button className="speed" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} aria-label="Playback speed">
              {speed}×
            </button>
          </div>
        </div>

        <aside className="full-episode__side">
          <p className="eyebrow">Episode {ep.number} · {formatTime(ep.full.duration)}</p>
          <h1 className="episode-title">{ep.title}</h1>
          <p className="episode-hosts">{hostLine(ep)}</p>
          <p className="episode-topic">{ep.topic}</p>

          <ul className="people">
            {people.map((p) => (
              <li key={p.name}>
                <span className="people__mono">{p.name.split(' ').map((w) => w[0]).join('')}</span>
                <span><strong>{p.name}</strong><em>{p.role}{p.role === 'Host' ? ` · ${show.name}` : ''}</em></span>
              </li>
            ))}
          </ul>

          <Transcript cues={ep.cues} time={pb.time} speakers={ep.speakers} />

          <div className="chapters">
            <p className="eyebrow">Chapters</p>
            <ol>
              {ep.chapters.map((c, i) => {
                const isHighlight = c.start >= h.sourceStart - 2 && c.start < h.sourceEnd - 5
                return (
                  <li key={c.title + i}>
                    <button className={i === chapterIdx ? 'is-current' : ''} onClick={() => { pb.seek(c.start); pb.play() }}>
                      <span className="chapters__time">{formatTime(c.start)}</span>
                      <span className="chapters__title">{c.title}</span>
                      {isHighlight && <span className="tag tag--accent">Highlight</span>}
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        </aside>
      </div>
    </motion.div>
  )
}
