import { motion } from 'framer-motion'
import { ArrowLeft, Bookmark, Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Dial } from '../components/Dial'
import { MediaSurface } from '../components/MediaSurface'
import { Transcript } from '../components/Transcript'
import { creatorById, episodeById } from '../data'
import { useWindowedPlayback } from '../hooks/useWindowedPlayback'
import { useMediaSession } from '../hooks/useMediaSession'
import { formatTime } from '../lib/media'
import { useStore } from '../store/useStore'
import { useUI, type FullEpisodeRequest } from '../store/useUI'
import { usePlayerRef } from './Artists'
import { fullVerb, hostLine, isVideo, useSaveEpisode } from './Podcasts'

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
  const player = usePlayerRef()
  const [known, setKnown] = useState(ep.duration ?? 0)
  const [error, setError] = useState<string | null>(null)
  const [startAt, setStartAt] = useState(request.startAt)
  const [speed, setSpeed] = useState(1)
  const [banner, setBanner] = useState(request.startAt > 5)

  const pb = useWindowedPlayback({
    ref: player.ref,
    itemKey: `${ep.id}:${player.version}`,
    start: 0,
    // episodes from a feed may not state their length; the player tells us once loaded
    end: known || 7200,
    autoplay: true,
    active: !drive,
    initialOffset: startAt,
    onWindowEnd: ({ listened, length }) => recordListen(ep.creatorId, ep.id, listened, listened / length > 0.85),
  })

  useMediaSession(!drive, {
    title: ep.title, artist: show.name, album: 'Full episode', artwork: ep.artwork,
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
    if (player.ref.current) player.ref.current.playbackRate = speed
  }, [speed, player.ref])

  // learn the real length from the player when the content file doesn't give one
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
    if (heard > 20 && !pb.ended) recordListen(ep.creatorId, ep.id, heard, false)
    close()
  }

  const chapters = ep.chapters ?? []
  const chapterIdx = chapters.findLastIndex((c) => c.start <= pb.time + 0.5)
  const h = ep.highlight
  const people = Object.values(ep.speakers ?? {}).map((p) => ({
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
          <div className={`full-episode__screen ${isVideo(ep) ? '' : 'full-episode__screen--audio'}`}>
            {isVideo(ep) ? (
              <MediaSurface source={ep.media} start={startAt} className="full-episode__video" onPlayer={player.onPlayer} onError={setError} onClick={pb.toggle} />
            ) : (
              <div className="audio-stage audio-stage--wide">
                <div className={`audio-stage__disc ${pb.playing ? 'is-spinning' : ''}`} aria-hidden>
                  <img src={ep.artwork} alt="" />
                </div>
                <div className="audio-stage__text">
                  <span className="tag tag--band">Audio episode</span>
                  <strong>{show.name}</strong>
                </div>
                <MediaSurface source={ep.media} onPlayer={player.onPlayer} onError={setError} />
              </div>
            )}
            {error && (
              <div className="sleeve__error">
                <p className="eyebrow">Can&rsquo;t play here</p>
                <p>{error}</p>
              </div>
            )}
            {!pb.playing && !error && ep.media.kind !== 'youtube' && (
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
            ranges={[{ start: h.start, end: h.end, label: 'The highlight came from here' }]}
            marks={chapters.map((c) => c.start)}
            size="lg"
          />
          <div className="full-episode__legend">
            <span><i className="swatch swatch--range" /> The highlight you heard</span>
            {chapters.length > 0 && <span><i className="swatch swatch--mark" /> Chapters</span>}
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
          <p className="eyebrow">{ep.number ? `Episode ${ep.number} · ` : ''}{known ? formatTime(known) : ''} · {isVideo(ep) ? 'Video' : 'Audio'}</p>
          <h1 className="episode-title">{ep.title}</h1>
          {hostLine(ep) && <p className="episode-hosts">{hostLine(ep)}</p>}
          <p className="episode-topic">{ep.topic}</p>

          {people.length > 0 && <ul className="people">
            {people.map((p) => (
              <li key={p.name}>
                <span className="people__mono">{p.name.split(' ').map((w) => w[0]).join('')}</span>
                <span><strong>{p.name}</strong><em>{p.role}{p.role === 'Host' ? ` · ${show.name}` : ''}</em></span>
              </li>
            ))}
          </ul>}

          {ep.cues && ep.speakers && <Transcript cues={ep.cues} time={pb.time} speakers={ep.speakers} />}

          {chapters.length > 0 && <div className="chapters">
            <p className="eyebrow">Chapters</p>
            <ol>
              {chapters.map((c, i) => {
                const isHighlight = c.start >= h.start - 2 && c.start < h.end - 5
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
          </div>}
          <a className="link-btn" href="#" onClick={(e) => { e.preventDefault(); leave() }}>{fullVerb(ep) === 'Watch' ? 'Done watching?' : 'Done listening?'} Back to discovery</a>
        </aside>
      </div>
    </motion.div>
  )
}
