import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, Headphones, Pause, Play, RotateCcw, SkipForward, Tv } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Dial } from '../components/Dial'
import { MediaSurface } from '../components/MediaSurface'
import { SwipeCard, type SwipeDir } from '../components/SwipeCard'
import { TierBadge } from '../components/Tier'
import { Transcript } from '../components/Transcript'
import { creatorById, episodes } from '../data'
import { useKeys } from '../hooks/useKeys'
import { useMediaSession } from '../hooks/useMediaSession'
import { useItemError, useRelationship } from '../hooks/useRelationship'
import { useWindowedPlayback, type WindowEnd } from '../hooks/useWindowedPlayback'
import { formatTime } from '../lib/media'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { Episode, SaveMethod } from '../types'
import { AUTO_SAVE_RATIO, usePlayerRef } from './Artists'

export const hostLine = (ep: Episode) => {
  const c = creatorById[ep.creatorId]
  const hosts = (c?.hosts ?? []).join(' & ')
  return ep.guests.length ? `${hosts} with ${ep.guests.join(' & ')}` : hosts
}

/** Audio-only episodes are presented as audio, never dressed up as video. */
export const isVideo = (ep: Episode) => ep.media.kind === 'video' || ep.media.kind === 'youtube'
export const fullVerb = (ep: Episode) => (isVideo(ep) ? 'Watch' : 'Listen to')

export function useSaveEpisode() {
  const save = useStore((s) => s.save)
  const unsave = useStore((s) => s.unsave)
  const pushToast = useUI((s) => s.pushToast)
  const openSheet = useUI((s) => s.openSheet)
  return useCallback(
    (ep: Episode, via: SaveMethod, toggle = false) => {
      if (toggle && useStore.getState().isSaved(ep.id)) {
        unsave(ep.id)
        pushToast({ tone: 'info', title: 'Removed from your collection', detail: ep.title })
        return
      }
      if (save(ep.id, 'episode', via))
        pushToast({
          tone: 'save',
          image: ep.artwork,
          title: 'Episode saved',
          detail: `${ep.title} · ${creatorById[ep.creatorId]?.name ?? ''}`,
          action: { label: 'View', run: () => openSheet({ kind: 'library' }) },
        })
    },
    [save, unsave, pushToast, openSheet],
  )
}

export function Podcasts({ active }: { active: boolean }) {
  const index = useStore((s) => s.podcastsIndex)
  const setIndex = useStore((s) => s.setPodcastsIndex)
  const recordListen = useStore((s) => s.recordListen)
  const saved = useStore((s) => s.saved)
  const unlocked = useUI((s) => s.audioUnlocked)
  const openFull = useUI((s) => s.openFullEpisode)
  const saveEpisode = useSaveEpisode()
  const [dir, setDir] = useState<SwipeDir>(-1)
  const [handoff, setHandoff] = useState<Episode | null>(null)
  const player = usePlayerRef()

  const ep = episodes[index] as Episode | undefined
  const show = ep ? creatorById[ep.creatorId] : undefined
  const isSaved = ep ? saved.some((s) => s.id === ep.id) : false
  const rel = useRelationship(ep?.creatorId)
  const [error, setError] = useItemError(ep?.id)

  const onWindowEnd = useCallback(
    ({ listened, length }: WindowEnd) => {
      if (!ep) return
      const ratio = listened / length
      recordListen(ep.creatorId, ep.id, listened, ratio >= AUTO_SAVE_RATIO)
      // Listening through the highlight means "I want more": keep going.
      if (ratio >= AUTO_SAVE_RATIO) setHandoff(ep)
    },
    [ep, recordListen],
  )

  const pb = useWindowedPlayback({
    ref: player.ref,
    itemKey: `${ep?.id ?? 'end'}:${player.version}`,
    start: ep?.highlight.start ?? 0,
    end: ep?.highlight.end ?? 1,
    autoplay: unlocked,
    active: active && !handoff && !error,
    onWindowEnd,
  })

  // Seamless progression into the complete episode, right after the highlight.
  useEffect(() => {
    if (!handoff) return
    const t = window.setTimeout(() => {
      openFull({ episodeId: handoff.id, startAt: handoff.highlight.end, reason: 'auto' })
      setDir(1)
      setIndex(index + 1)
      setHandoff(null)
    }, 2600)
    return () => window.clearTimeout(t)
  }, [handoff, openFull, setIndex, index])

  const next = useCallback(
    (d: SwipeDir) => {
      setDir(d)
      setIndex(index + 1)
    },
    [index, setIndex],
  )

  const pass = useCallback(() => {
    if (!ep) return
    const heard = pb.listened()
    if (heard > 3 && !pb.ended) recordListen(ep.creatorId, ep.id, heard, false)
    next(-1)
  }, [ep, pb, recordListen, next])

  const saveAndNext = useCallback(
    (via: SaveMethod) => {
      if (!ep) return
      saveEpisode(ep, via)
      next(1)
    },
    [ep, saveEpisode, next],
  )

  const watchFull = useCallback(() => {
    if (!ep) return
    pb.pause()
    // pick up the full episode at exactly the moment the highlight reached
    openFull({ episodeId: ep.id, startAt: ep.highlight.start + pb.time, reason: 'manual' })
  }, [ep, pb, openFull])

  useKeys(active && !!ep, { ArrowLeft: pass, ArrowRight: () => saveAndNext('button'), ' ': pb.toggle, r: pb.restart, f: watchFull })

  useMediaSession(
    active && !!ep && !handoff,
    ep && show
      ? { title: ep.title, artist: show.name, album: 'Highlight', artwork: ep.artwork, onPlay: pb.play, onPause: pb.pause, onNext: pass }
      : null,
  )

  if (!ep || !show)
    return (
      <section className="end-card end-card--podcasts">
        <div className="end-card__disc" aria-hidden><span /></div>
        <p className="eyebrow">That&rsquo;s every conversation for today</p>
        <h1>New ideas arrive tomorrow.</h1>
        <p>Saved episodes are waiting in your collection, ready to play in full.</p>
        <div className="end-card__actions">
          <button className="btn btn--accent" onClick={() => useUI.getState().openSheet({ kind: 'library' })}>Open your collection</button>
          <button className="btn" onClick={() => { setDir(1); setIndex(0) }}>Start again</button>
        </div>
      </section>
    )

  const h = ep.highlight
  const video = isVideo(ep)
  const embed = ep.media.kind === 'youtube' || ep.media.kind === 'spotify'
  const total = ep.duration
  return (
    <section className="podcasts" aria-label="Podcasts — conversation discovery">
      <header className="podcasts__masthead">
        <p className="eyebrow">Today&rsquo;s conversations · {index + 1} of {episodes.length}</p>
        <p className="podcasts__dek">Five minutes of the best part. Stay for the rest if it earns it.</p>
      </header>

      <div className="podcasts__grid">
        <div className="podcasts__screen">
          <AnimatePresence custom={dir} initial={false} mode="popLayout">
            <SwipeCard key={ep.id} exitDir={dir} className={`screen-card ${embed ? 'screen-card--embed' : ''} ${video ? '' : 'screen-card--audio'}`}
              onSwipe={(d) => (d === 1 ? saveAndNext('swipe') : pass())}>
              <div className="screen-card__frame">
                {video ? (
                  <MediaSurface source={ep.media} start={h.start} className="screen-card__video" onPlayer={player.onPlayer} onError={setError} onClick={pb.toggle} />
                ) : (
                  <div className="audio-stage">
                    <div className={`audio-stage__disc ${pb.playing ? 'is-spinning' : ''}`} aria-hidden>
                      <img src={ep.artwork} alt="" />
                    </div>
                    <div className="audio-stage__text">
                      <span className="tag tag--band"><Headphones size={12} /> Audio episode</span>
                      <strong>{show.name}</strong>
                    </div>
                    <MediaSurface source={ep.media} onPlayer={player.onPlayer} onError={setError} />
                  </div>
                )}
                {!embed && (
                  <div className="screen-card__chrome">
                    <span className="tag tag--glass">Highlight · {formatTime(h.end - h.start)}</span>
                  </div>
                )}
                {!embed && !pb.playing && !pb.ended && !handoff && !error && (
                  <button className="sleeve__play" onClick={pb.toggle} aria-label="Play highlight">
                    <Play size={30} fill="currentColor" />
                  </button>
                )}
                {error && (
                  <div className="sleeve__error">
                    <p className="eyebrow">Can&rsquo;t play here</p>
                    <p>{error}</p>
                    <button className="btn btn--light" onClick={pass}>Pass to the next conversation</button>
                  </div>
                )}
                <AnimatePresence>
                  {handoff && (
                    <motion.div className="handoff" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p className="eyebrow">You stayed for the whole highlight</p>
                      <p className="handoff__title">Continuing the full episode…</p>
                      <div className="handoff__bar"><span /></div>
                      <button className="btn btn--light" onClick={() => setHandoff(null)}>Stay in discovery</button>
                    </motion.div>
                  )}
                  {pb.ended && !handoff && (
                    <motion.div className="sleeve__ended" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p className="eyebrow">Highlight complete</p>
                      <div className="sleeve__ended-actions">
                        <button className="btn btn--light" onClick={pb.restart}><RotateCcw size={16} /> Replay</button>
                        <button className="btn btn--accent" onClick={watchFull}>{fullVerb(ep)} full episode</button>
                        <button className="btn btn--light" onClick={() => next(-1)}>Next conversation</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {embed && (
                <div className="sleeve__band">
                  <span className="sleeve__grip" aria-hidden />
                  <span className="sleeve__band-text">
                    <strong>{show.name}</strong>
                    <em>{ep.title}</em>
                  </span>
                  <span className="tag tag--band">Highlight · {formatTime(h.end - h.start)}</span>
                </div>
              )}
            </SwipeCard>
          </AnimatePresence>

          <div className="podcasts__transport">
            <Dial value={pb.time} max={pb.length} onSeek={pb.seek} label={`Highlight from ${ep.title}`} />
            {pb.blocked && embed && !error && (
              <p className="hint hint--strong">Your browser wants a tap on the video itself to start it. Tap the video once.</p>
            )}
            <div className="controls controls--podcasts">
              <button className="ctl ctl--ghost" onClick={pb.restart} aria-label="Replay highlight"><RotateCcw size={19} /></button>
              <button className="ctl ctl--pass" onClick={pass} aria-label="Pass"><SkipForward size={22} /></button>
              <button className="ctl ctl--play" onClick={pb.toggle} aria-label={pb.playing ? 'Pause' : 'Play'}>
                {pb.playing ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" />}
              </button>
              <button className={`ctl ctl--keep ${isSaved ? 'is-on' : ''}`} onClick={() => saveEpisode(ep, 'button', true)}
                aria-label={isSaved ? 'Remove from collection' : 'Save episode'} aria-pressed={isSaved}>
                <Bookmark size={22} fill={isSaved ? 'currentColor' : 'none'} />
              </button>
              <button className="ctl ctl--ghost" onClick={watchFull} aria-label={`${fullVerb(ep)} full episode`}>
                {video ? <Tv size={19} /> : <Headphones size={19} />}
              </button>
            </div>
          </div>
        </div>

        <article className="podcasts__story">
          <button className="show-line" onClick={() => useUI.getState().openSheet({ kind: 'profile', creatorId: show.id })}>
            <img src={show.avatar} alt="" />
            <span>
              <strong>{show.name}</strong>
              <em>{ep.number ? `Episode ${ep.number} · ` : ''}{show.genre}</em>
            </span>
            {rel && rel.points > 0 && <TierBadge tier={rel.tier.id} size="sm" />}
          </button>
          <h1 className="episode-title">{ep.title}</h1>
          {hostLine(ep) && <p className="episode-hosts">{hostLine(ep)}</p>}
          <p className="episode-topic">{ep.topic}</p>

          {ep.cues && ep.speakers ? (
            <Transcript cues={ep.cues} time={h.start + pb.time} speakers={ep.speakers} />
          ) : null}

          <div className="provenance">
            {total ? (
              <div className="provenance__bar" aria-hidden>
                <span style={{ left: `${(h.start / total) * 100}%`, width: `${((h.end - h.start) / total) * 100}%` }} />
              </div>
            ) : null}
            <p>
              <strong>“{h.title}”</strong>, picked from {formatTime(h.start)}–{formatTime(h.end)}
              {total ? ` of the ${formatTime(total)} episode` : ' of the episode'}. Finish it and the full episode keeps playing.
              {h.note ? ` ${h.note}` : ''}
            </p>
          </div>
          <button className="btn btn--outline btn--full" onClick={watchFull}>
            {video ? <Tv size={17} /> : <Headphones size={17} />} {fullVerb(ep)} full episode
            <span className="btn__aside">picks up at {formatTime(h.start + pb.time)}</span>
          </button>
        </article>
      </div>
    </section>
  )
}
