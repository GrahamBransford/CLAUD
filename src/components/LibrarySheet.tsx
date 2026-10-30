import { Pause, Play, Trash2, Tv } from 'lucide-react'
import { useRef, useState } from 'react'
import { creatorById, episodeById, songById } from '../data'
import { useWindowedPlayback } from '../hooks/useWindowedPlayback'
import { formatTime } from '../lib/media'
import { PROVIDERS, type StreamingProviderId } from '../lib/streaming'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { SavedItem, Song } from '../types'
import { Dial } from './Dial'
import { Sheet } from './Sheet'

const VIA: Record<SavedItem['via'], string> = {
  listened: 'Saved by listening all the way through',
  swipe: 'Saved with a swipe',
  button: 'Saved by you',
}

const when = (ts: number) => {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  return h < 24 ? `${h}h ago` : new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function LibrarySheet() {
  const close = () => useUI.getState().openSheet(null)
  const saved = useStore((s) => s.saved)
  const [tab, setTab] = useState<'song' | 'episode'>('song')
  const [playing, setPlaying] = useState<Song | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const items = saved.filter((s) => s.kind === tab)
  const songsCount = saved.filter((s) => s.kind === 'song').length

  return (
    <Sheet title="Your collection" onClose={close}>
      <div className="library">
        <p className="eyebrow">Your collection</p>
        <h2 className="sheet-title">Kept for later.</h2>
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={tab === 'song'} onClick={() => setTab('song')}>
            Songs <em>{songsCount}</em>
          </button>
          <button role="tab" aria-selected={tab === 'episode'} onClick={() => setTab('episode')}>
            Episodes <em>{saved.length - songsCount}</em>
          </button>
        </div>

        {items.length === 0 ? (
          <EmptyShelf kind={tab} />
        ) : (
          <ul className="shelf">
            {items.map((it) => (tab === 'song' ? (
              <SongRow key={it.id} item={it} playing={playing?.id === it.id} onPlay={() => setPlaying(songById[it.id])} />
            ) : (
              <EpisodeRow key={it.id} item={it} />
            )))}
          </ul>
        )}

        {playing && <MiniPlayer song={playing} onDone={() => setPlaying(null)} />}

        <StreamingCard />

        {confirmReset ? (
          <div className="reset-confirm" role="alertdialog" aria-label="Reset demo data">
            <p>Reset the demo? Saved items, follows and listening history go back to their starting state.</p>
            <div>
              <button
                className="btn btn--accent"
                onClick={() => {
                  useStore.getState().resetDemo()
                  setPlaying(null)
                  setConfirmReset(false)
                }}
              >
                Reset demo
              </button>
              <button className="btn" onClick={() => setConfirmReset(false)}>Keep my data</button>
            </div>
          </div>
        ) : (
          <button className="link-btn link-btn--muted reset" onClick={() => setConfirmReset(true)}>
            Reset demo data
          </button>
        )}
      </div>
    </Sheet>
  )
}

function SongRow({ item, playing, onPlay }: { item: SavedItem; playing: boolean; onPlay: () => void }) {
  const song = songById[item.id]
  const streaming = useStore((s) => s.streaming)
  const unsave = useStore((s) => s.unsave)
  if (!song) return null
  return (
    <li className={`shelf__row ${playing ? 'is-playing' : ''}`}>
      <button className="shelf__art" onClick={onPlay} aria-label={`Play ${song.title}`}>
        <img src={song.cover} alt="" />
        <span><Play size={16} fill="currentColor" /></span>
      </button>
      <span className="shelf__text">
        <strong>{song.title}</strong>
        <em>{creatorById[song.creatorId].name}</em>
        <small className={item.via === 'listened' ? 'is-auto' : ''}>{VIA[item.via]} · {when(item.savedAt)}</small>
        {streaming && (
          <small className="shelf__dest">→ “{PROVIDERS[streaming].playlistFor(song)}” on {PROVIDERS[streaming].name} · demo, not sent</small>
        )}
      </span>
      <button className="icon-btn" onClick={() => unsave(item.id)} aria-label={`Remove ${song.title}`}>
        <Trash2 size={16} />
      </button>
    </li>
  )
}

function EpisodeRow({ item }: { item: SavedItem }) {
  const ep = episodeById[item.id]
  const progress = useStore((s) => s.episodeProgress[item.id] ?? 0)
  const unsave = useStore((s) => s.unsave)
  if (!ep) return null
  const open = () => {
    useUI.getState().openSheet(null)
    useUI.getState().openFullEpisode({ episodeId: ep.id, startAt: progress, reason: 'library' })
  }
  return (
    <li className="shelf__row">
      <button className="shelf__art" onClick={open} aria-label={`Watch ${ep.title}`}>
        <img src={ep.art} alt="" />
        <span><Tv size={16} /></span>
      </button>
      <span className="shelf__text">
        <strong>{ep.title}</strong>
        <em>{creatorById[ep.creatorId].name} · {formatTime(ep.full.duration)}</em>
        <small>{progress > 5 ? `Resume at ${formatTime(progress)}` : 'Not started'} · {when(item.savedAt)}</small>
      </span>
      <button className="icon-btn" onClick={() => unsave(item.id)} aria-label={`Remove ${ep.title}`}>
        <Trash2 size={16} />
      </button>
    </li>
  )
}

function MiniPlayer({ song, onDone }: { song: Song; onDone: () => void }) {
  const ref = useRef<HTMLAudioElement>(null)
  const pb = useWindowedPlayback({
    ref,
    itemKey: song.id,
    start: song.previewStart,
    end: song.previewEnd,
    autoplay: true,
    active: true,
    onWindowEnd: onDone,
  })
  return (
    <div className="mini-player">
      {/* audio-only rendition of the same file: no video needed in the library */}
      <audio ref={ref} src={song.video} preload="auto" />
      <img src={song.cover} alt="" />
      <div className="mini-player__body">
        <strong>{song.title}</strong>
        <Dial value={pb.time} max={pb.length} onSeek={pb.seek} label={`Preview of ${song.title}`} />
      </div>
      <button className="ctl ctl--play ctl--sm" onClick={pb.toggle} aria-label={pb.playing ? 'Pause' : 'Play'}>
        {pb.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>
    </div>
  )
}

function EmptyShelf({ kind }: { kind: 'song' | 'episode' }) {
  return (
    <div className="empty empty--shelf">
      <div className="empty__art" aria-hidden><span /></div>
      <h3>{kind === 'song' ? 'Nothing on the shelf yet.' : 'No episodes saved yet.'}</h3>
      <p>
        {kind === 'song'
          ? 'Swipe right on a song in Singers — or simply listen to a preview all the way through — and it lands here.'
          : 'Tap the bookmark on a conversation in Speakers to keep it for later, ready to play in full.'}
      </p>
    </div>
  )
}

function StreamingCard() {
  const streaming = useStore((s) => s.streaming)
  const setStreaming = useStore((s) => s.setStreaming)
  return (
    <div className="streaming">
      <div className="streaming__head">
        <p className="eyebrow">Streaming destination</p>
        <span className="tag tag--demo">Simulated</span>
      </div>
      {streaming ? (
        <>
          <p>
            <strong>{PROVIDERS[streaming].name}</strong> (demo connection). In the full product, every song you keep would also be
            added to your {PROVIDERS[streaming].name} library and filed into a playlist that matches its mood.
            <strong> Nothing is sent from this prototype.</strong>
          </p>
          <button className="link-btn" onClick={() => setStreaming(null)}>Disconnect demo</button>
        </>
      ) : (
        <>
          <p>Choose where kept songs should go. This is a demonstration of the planned integration — no account is connected.</p>
          <div className="streaming__options">
            {(Object.keys(PROVIDERS) as StreamingProviderId[]).map((id) => (
              <button key={id} className="btn btn--outline" onClick={() => setStreaming(id)}>
                {PROVIDERS[id].name} <span className="btn__aside">demo</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
