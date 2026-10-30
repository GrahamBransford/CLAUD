import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Pause, Play, RotateCcw, SkipBack, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dial } from '../components/Dial'
import { MediaSurface } from '../components/MediaSurface'
import { SwipeCard, type SwipeDir } from '../components/SwipeCard'
import { TierBadge } from '../components/Tier'
import { creatorById, songs } from '../data'
import { useKeys } from '../hooks/useKeys'
import { useMediaSession } from '../hooks/useMediaSession'
import { useItemError, useRelationship } from '../hooks/useRelationship'
import { useWindowedPlayback, type WindowEnd } from '../hooks/useWindowedPlayback'
import { formatTime } from '../lib/media'
import type { PlayerLike } from '../lib/players'
import { PROVIDERS } from '../lib/streaming'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { SaveMethod, Song } from '../types'

/** Finishing at least this share of a preview counts as "listened through". */
export const AUTO_SAVE_RATIO = 0.85
const NEXT_COUNTDOWN = 5

export const sourceLabel = (s: Song) =>
  s.media.kind === 'youtube' ? 'Official video · YouTube' : s.media.kind === 'spotify' ? 'Spotify' : 'Official video'

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
        image: song.artwork,
        title: via === 'listened' ? 'Saved. You listened all the way through' : 'Saved to your collection',
        detail: provider
          ? `${song.title} · would also go to “${provider.playlistFor(song)}” on ${provider.name} (demo)`
          : `${song.title} · ${creatorById[song.creatorId]?.name ?? ''}`,
        action: { label: 'View', run: () => openSheet({ kind: 'library' }) },
      })
      return true
    },
    [save, streaming, pushToast, openSheet],
  )
}

/** Keeps a ref to whichever player a MediaSurface creates, and a version to re-wire hooks. */
export function usePlayerRef() {
  const ref = useRef<PlayerLike | null>(null)
  const [version, setVersion] = useState(0)
  const onPlayer = useCallback((p: PlayerLike | null) => {
    if (p) {
      ref.current = p
      setVersion((v) => v + 1)
    }
  }, [])
  return { ref, version, onPlayer }
}

export function Artists({ active }: { active: boolean }) {
  const index = useStore((s) => s.artistsIndex)
  const setIndex = useStore((s) => s.setArtistsIndex)
  const recordListen = useStore((s) => s.recordListen)
  const saved = useStore((s) => s.saved)
  const unlocked = useUI((s) => s.audioUnlocked)
  const saveSong = useSaveSong()
  const [dir, setDir] = useState<SwipeDir>(-1)
  const [countdown, setCountdown] = useState<number | null>(null)
  const player = usePlayerRef()

  const song = songs[index] as Song | undefined
  const creator = song ? creatorById[song.creatorId] : undefined
  const isSaved = song ? saved.some((s) => s.id === song.id) : false
  const rel = useRelationship(song?.creatorId)
  const [error, setError] = useItemError(song?.id)

  const onWindowEnd = useCallback(
    ({ listened, length }: WindowEnd) => {
      if (!song) return
      const ratio = listened / length
      recordListen(song.creatorId, song.id, listened, ratio >= AUTO_SAVE_RATIO)
      if (ratio >= AUTO_SAVE_RATIO) saveSong(song, 'listened')
      setCountdown(NEXT_COUNTDOWN)
    },
    [song, recordListen, saveSong],
  )

  const pb = useWindowedPlayback({
    ref: player.ref,
    itemKey: `${song?.id ?? 'end'}:${player.version}`,
    start: song?.preview.start ?? 0,
    end: song?.preview.end ?? 1,
    autoplay: unlocked,
    active: active && !error,
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

  const logPartial = useCallback(() => {
    if (!song) return
    const heard = pb.listened()
    if (heard > 3 && !pb.ended) recordListen(song.creatorId, song.id, heard, false)
  }, [song, pb, recordListen])

  const pass = useCallback(() => {
    logPartial()
    advance(-1)
  }, [logPartial, advance])

  const keep = useCallback(
    (via: SaveMethod) => {
      if (!song) return
      logPartial()
      saveSong(song, via)
      advance(1)
    },
    [song, logPartial, saveSong, advance],
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

  useKeys(active && !!song, { ArrowLeft: pass, ArrowRight: () => keep('button'), ' ': pb.toggle, r: replay })

  useMediaSession(
    active && !!song,
    song && creator
      ? { title: song.title, artist: creator.name, album: song.release, artwork: song.artwork,
          onPlay: pb.play, onPause: pb.pause, onNext: pass, onPrevious: previous }
      : null,
  )

  if (!song || !creator) return <EndOfStation onRestart={() => { setDir(1); setIndex(0) }} />

  const upNext = songs.slice(index + 1, index + 4)
  const embed = song.media.kind === 'youtube' || song.media.kind === 'spotify'

  return (
    <section className="artists" aria-label="Artists — music discovery">
      <div className="artists__stage">
        <div className={`deck ${embed ? 'deck--embed' : ''}`}>
          {upNext.slice(0, 2).map((n, i) => (
            <div key={n.id} className={`deck__under deck__under--${i + 1}`} aria-hidden>
              <img src={n.artwork} alt="" />
            </div>
          ))}
          <AnimatePresence custom={dir} initial={false} mode="popLayout">
            <SwipeCard key={song.id} exitDir={dir} onSwipe={(d) => (d === 1 ? keep('swipe') : pass())} className={`sleeve ${embed ? 'sleeve--embed' : ''}`}>
              <div className="sleeve__screen">
                <MediaSurface
                  source={song.media}
                  start={song.preview.start}
                  className="sleeve__video"
                  onPlayer={player.onPlayer}
                  onError={setError}
                  onClick={pb.toggle}
                />
                {!embed && (
                  <div className="sleeve__chrome">
                    <span className="tag tag--glass">{sourceLabel(song)}</span>
                    <span className="tag tag--glass">Preview · {formatTime(pb.length)}</span>
                  </div>
                )}
                {!embed && !pb.playing && !pb.ended && !error && (
                  <button className="sleeve__play" onClick={pb.toggle} aria-label="Play preview">
                    <Play size={30} fill="currentColor" />
                  </button>
                )}
                {error && (
                  <div className="sleeve__error">
                    <p className="eyebrow">Can&rsquo;t play here</p>
                    <p>{error}</p>
                    <button className="btn btn--light" onClick={pass}>Pass to the next song</button>
                  </div>
                )}
                <AnimatePresence>
                  {pb.ended && (
                    <motion.div className="sleeve__ended" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p className="eyebrow">Preview complete</p>
                      <p className="sleeve__ended-title">{isSaved ? 'Saved to your collection.' : 'That was the preview.'}</p>
                      <div className="sleeve__ended-actions">
                        <button className="btn btn--light" onClick={replay}><RotateCcw size={16} /> Replay</button>
                        <button className="btn btn--accent" onClick={() => advance(isSaved ? 1 : -1)}>
                          Next song{countdown !== null && countdown > 0 ? ` in ${countdown}` : ''}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {embed && (
                <div className="sleeve__band">
                  <span className="sleeve__grip" aria-hidden />
                  <span className="sleeve__band-text">
                    <strong>{creator.name}</strong>
                    <em>{song.title}</em>
                  </span>
                  <span className="tag tag--band">{sourceLabel(song)} · preview {formatTime(pb.length)}</span>
                </div>
              )}
              {isSaved && !pb.ended && <span className="sleeve__saved"><Heart size={13} fill="currentColor" /> Saved</span>}
            </SwipeCard>
          </AnimatePresence>
        </div>

        <div className="transport">
          <div className="transport__meta">
            <h1 className="track-artist">{creator.name}</h1>
            <p className="track-title">{song.title}</p>
            <p className="track-genre">{creator.genre}{creator.location ? ` · ${creator.location}` : ''}</p>
          </div>
          <Dial value={pb.time} max={pb.length} onSeek={seek} label={`Preview of ${song.title}`} />
          {pb.blocked && embed && !error && (
            <p className="hint hint--strong">Your browser wants a tap on the video itself to start it. Tap the video once.</p>
          )}
          <div className="controls">
            <button className="ctl ctl--ghost" onClick={previous} disabled={index === 0} aria-label="Previous discovery">
              <SkipBack size={20} />
            </button>
            <button className="ctl ctl--pass" onClick={pass} aria-label="Pass">
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
          <p className="hint">Swipe right to save, left to pass. Hear the whole preview and it saves itself.</p>
        </div>
      </div>

      <aside className="artists__info">
        <p className="eyebrow">Now spinning · {index + 1} of {songs.length}</p>
        <h2 className="info-artist">{creator.name}</h2>
        <p className="info-title">“{song.title}”</p>
        <p className="info-meta">{creator.genre}{creator.location ? ` · ${creator.location}` : ''} · {song.release}</p>
        <p className="info-blurb">{song.blurb}</p>
        <ul className="moods">{song.mood.map((m) => <li key={m}>{m}</li>)}</ul>
        {rel && (
          <button className="rel-line" onClick={() => useUI.getState().openSheet({ kind: 'profile', creatorId: creator.id })}>
            <TierBadge tier={rel.tier.id} size="sm" />
            <span>
              <strong>{rel.points > 0 ? `You and ${creator.name}: ${rel.tier.label}` : `New to your record`}</strong>
              <em>{rel.next ? `Next: ${rel.next.tier.label}, ${rel.next.hint}` : rel.tier.line}</em>
            </span>
          </button>
        )}
        {upNext.length > 0 && (
          <div className="up-next">
            <p className="eyebrow">Up next</p>
            <ol>
              {upNext.map((n) => (
                <li key={n.id}>
                  <img src={n.artwork} alt="" />
                  <span>
                    <strong>{creatorById[n.creatorId]?.name}</strong>
                    <em>{n.title}</em>
                  </span>
                  <small>{creatorById[n.creatorId]?.genre}</small>
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
        {count ? ` and saved ${count} ${count === 1 ? 'song' : 'songs'}` : ''}. New artists tune in tomorrow.
      </p>
      <div className="end-card__actions">
        <button className="btn btn--accent" onClick={() => openSheet({ kind: 'library' })}>Open your collection</button>
        <button className="btn" onClick={onRestart}>Listen again from the top</button>
      </div>
    </section>
  )
}
