import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Pause, Play, RotateCcw, SkipBack, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dial } from '../components/Dial'
import { SwipeCard, type SwipeDir } from '../components/SwipeCard'
import { creatorById, songs } from '../data'
import { useWindowedPlayback, type WindowEnd } from '../hooks/useWindowedPlayback'
import { useKeys } from '../hooks/useKeys'
import { useMediaSession } from '../hooks/useMediaSession'
import { formatTime } from '../lib/media'
import { PROVIDERS } from '../lib/streaming'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { SaveMethod, Song } from '../types'

/** Finishing at least this share of a preview counts as "listened through". */
export const AUTO_SAVE_RATIO = 0.85
const NEXT_COUNTDOWN = 5

export function useSaveSong() {
  const save = useStore((s) => s.save)
  const streaming = useStore((s) => s.streaming)
  const pushToast = useUI((s) => s.pushToast)
  const openSheet = useUI((s) => s.openSheet)
  return useCallback(
    (song: Song, via: SaveMethod) => {
      const added = save(song.id, 'song', via)
      if (!added) return false
      const provider = streaming ? PROVIDERS[streaming] : null
      pushToast({
        tone: 'save',
        image: song.cover,
        title: via === 'listened' ? 'Saved — you listened all the way through' : 'Saved to your collection',
        detail: provider
          ? `${song.title} · would also go to “${provider.playlistFor(song)}” on ${provider.name} (demo)`
          : `${song.title} · ${creatorById[song.creatorId].name}`,
        action: { label: 'View', run: () => openSheet({ kind: 'library' }) },
      })
      return true
    },
    [save, streaming, pushToast, openSheet],
  )
}

export function Singers({ active }: { active: boolean }) {
  const index = useStore((s) => s.singersIndex)
  const setIndex = useStore((s) => s.setSingersIndex)
  const recordListen = useStore((s) => s.recordListen)
  const saved = useStore((s) => s.saved)
  const unlocked = useUI((s) => s.audioUnlocked)
  const saveSong = useSaveSong()
  const [dir, setDir] = useState<SwipeDir>(-1)
  const [countdown, setCountdown] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const song = songs[index] as Song | undefined
  const creator = song ? creatorById[song.creatorId] : undefined
  const isSaved = song ? saved.some((s) => s.id === song.id) : false

  const onWindowEnd = useCallback(
    ({ listened, length }: WindowEnd) => {
      if (!song) return
      const ratio = listened / length
      recordListen(song.creatorId, ratio, listened)
      if (ratio >= AUTO_SAVE_RATIO) saveSong(song, 'listened')
      setCountdown(NEXT_COUNTDOWN)
    },
    [song, recordListen, saveSong],
  )

  const pb = useWindowedPlayback({
    ref: videoRef,
    itemKey: song?.id ?? 'end',
    start: song?.previewStart ?? 0,
    end: song?.previewEnd ?? 1,
    autoplay: unlocked,
    active,
    onWindowEnd,
  })

  const advance = useCallback(
    (d: SwipeDir) => {
      setCountdown(null)
      setDir(d)
      setIndex(index + 1)
    },
    [index, setIndex],
  )

  const skip = useCallback(() => {
    if (!song) return
    const heard = pb.listened()
    if (heard > 3 && !pb.ended) recordListen(song.creatorId, heard / pb.length, heard)
    advance(-1)
  }, [song, pb, recordListen, advance])

  const keep = useCallback(
    (via: SaveMethod) => {
      if (!song) return
      const heard = pb.listened()
      if (!pb.ended && heard > 3) recordListen(song.creatorId, heard / pb.length, heard)
      saveSong(song, via)
      advance(1)
    },
    [song, pb, recordListen, saveSong, advance],
  )

  // Replaying or scrubbing back after the end cancels the move to the next song.
  const replay = () => {
    setCountdown(null)
    pb.restart()
  }
  const seek = (v: number) => {
    setCountdown(null)
    pb.seek(v)
  }

  const previous = () => {
    if (index === 0) return
    setCountdown(null)
    setDir(1)
    setIndex(index - 1)
  }

  // Countdown to the next discovery after a preview ends.
  useEffect(() => {
    if (countdown === null || !active || !pb.ended) return
    const t =
      countdown <= 0
        ? window.setTimeout(() => advance(isSaved ? 1 : -1), 0)
        : window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000)
    return () => window.clearTimeout(t)
  }, [countdown, active, advance, isSaved, pb.ended])

  useKeys(active && !!song, {
    ArrowLeft: skip,
    ArrowRight: () => keep('button'),
    ' ': pb.toggle,
    r: replay,
  })

  useMediaSession(
    active && !!song,
    song && creator
      ? { title: song.title, artist: creator.name, album: song.release, artwork: song.cover,
          onPlay: pb.play, onPause: pb.pause, onNext: skip, onPrevious: previous }
      : null,
  )

  if (!song || !creator) return <EndOfStation onRestart={() => { setDir(1); setIndex(0) }} />

  const upNext = songs.slice(index + 1, index + 4)

  return (
    <section className="singers" aria-label="Singers — music discovery">
      <div className="singers__stage">
        <div className="deck">
          {upNext.slice(0, 2).map((n, i) => (
            <div key={n.id} className={`deck__under deck__under--${i + 1}`} aria-hidden>
              <img src={n.cover} alt="" />
            </div>
          ))}
          <AnimatePresence custom={dir} initial={false} mode="popLayout">
            <SwipeCard key={song.id} exitDir={dir} onSwipe={(d) => (d === 1 ? keep('swipe') : skip())} className="sleeve">
              <video
                ref={(el) => {
                  if (el) videoRef.current = el
                }}
                className="sleeve__video"
                src={song.video}
                poster={song.poster}
                playsInline
                preload="auto"
                onClick={pb.toggle}
              />
              <div className="sleeve__chrome">
                <span className="tag tag--glass">Official video</span>
                <span className="tag tag--glass">Preview · {formatTime(pb.length)}</span>
              </div>
              {(!pb.playing && !pb.ended) && (
                <button className="sleeve__play" onClick={pb.toggle} aria-label="Play preview">
                  <Play size={30} fill="currentColor" />
                </button>
              )}
              {isSaved && !pb.ended && (
                <span className="sleeve__saved"><Heart size={14} fill="currentColor" /> In your collection</span>
              )}
              <AnimatePresence>
                {pb.ended && (
                  <motion.div className="sleeve__ended" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="eyebrow">Preview complete</p>
                    <p className="sleeve__ended-title">
                      {isSaved ? 'Kept in your collection.' : 'That was the preview.'}
                    </p>
                    <div className="sleeve__ended-actions">
                      <button className="btn btn--light" onClick={replay}><RotateCcw size={16} /> Replay</button>
                      <button className="btn btn--accent" onClick={() => advance(isSaved ? 1 : -1)}>
                        Next song{countdown !== null && countdown > 0 ? ` in ${countdown}` : ''}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </SwipeCard>
          </AnimatePresence>
        </div>

        <div className="transport">
          <div className="transport__meta">
            <h1 className="track-artist">{creator.name}</h1>
            <p className="track-title">{song.title}</p>
            <p className="track-genre">{creator.genre} · {creator.location}</p>
          </div>
          <Dial value={pb.time} max={pb.length} onSeek={seek} label={`Preview of ${song.title}`} />
          <div className="controls">
            <button className="ctl ctl--ghost" onClick={previous} disabled={index === 0} aria-label="Previous discovery">
              <SkipBack size={20} />
            </button>
            <button className="ctl ctl--pass" onClick={skip} aria-label="Skip">
              <X size={26} strokeWidth={2.2} />
            </button>
            <button className="ctl ctl--play" onClick={pb.toggle} aria-label={pb.playing ? 'Pause' : 'Play'}>
              {pb.playing ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" />}
            </button>
            <button className="ctl ctl--keep" onClick={() => keep('button')} aria-label="Save to collection">
              <Heart size={24} strokeWidth={2.2} fill={isSaved ? 'currentColor' : 'none'} />
            </button>
            <button className="ctl ctl--ghost" onClick={replay} aria-label="Replay preview">
              <RotateCcw size={19} />
            </button>
          </div>
          <p className="hint">
            Swipe right to keep, left to pass. Listen to the end and it&rsquo;s saved for you.
          </p>
        </div>
      </div>

      <aside className="singers__info">
        <p className="eyebrow">Now spinning · {index + 1} of {songs.length}</p>
        <h2 className="info-artist">{creator.name}</h2>
        <p className="info-title">“{song.title}”</p>
        <p className="info-meta">{creator.genre} · {creator.location} · {song.release}</p>
        <p className="info-blurb">{song.blurb}</p>
        <ul className="moods">{song.mood.map((m) => <li key={m}>{m}</li>)}</ul>
        <button className="link-btn" onClick={() => useUI.getState().openSheet({ kind: 'profile', creatorId: creator.id })}>
          About {creator.name} →
        </button>
        {upNext.length > 0 && (
          <div className="up-next">
            <p className="eyebrow">Up next</p>
            <ol>
              {upNext.map((n) => (
                <li key={n.id}>
                  <img src={n.cover} alt="" />
                  <span>
                    <strong>{creatorById[n.creatorId].name}</strong>
                    <em>{n.title}</em>
                  </span>
                  <small>{creatorById[n.creatorId].genre}</small>
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>
    </section>
  )
}

function EndOfStation({ onRestart }: { onRestart: () => void }) {
  const openSheet = useUI((s) => s.openSheet)
  const count = useStore((s) => s.saved.filter((x) => x.kind === 'song').length)
  return (
    <section className="end-card">
      <div className="end-card__disc" aria-hidden><span /></div>
      <p className="eyebrow">End of today&rsquo;s rotation</p>
      <h1>That&rsquo;s the station for now.</h1>
      <p>
        You heard every new discovery in today&rsquo;s rotation
        {count ? ` and kept ${count} ${count === 1 ? 'song' : 'songs'}` : ''}. Fresh singers tune in tomorrow.
      </p>
      <div className="end-card__actions">
        <button className="btn btn--accent" onClick={() => openSheet({ kind: 'library' })}>Open your collection</button>
        <button className="btn" onClick={onRestart}>Listen again from the top</button>
      </div>
    </section>
  )
}
