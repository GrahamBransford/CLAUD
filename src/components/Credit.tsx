import { creatorById } from '../data'
import { useUI } from '../store/useUI'
import type { ReactNode } from 'react'

/** A small engraved mark: a note for music, a microphone for a conversation. */
function KindMark({ kind }: { kind: 'song' | 'episode' }) {
  return (
    <svg className="credit__mark" viewBox="0 0 12 12" aria-hidden>
      {kind === 'song' ? (
        <>
          <path d="M4.6 9.2V2.4l5-1.1v6.2" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="3.3" cy="9.3" r="1.5" fill="currentColor" />
          <circle cx="8.3" cy="7.6" r="1.5" fill="currentColor" />
        </>
      ) : (
        <>
          <rect x="4.1" y="1" width="3.8" height="6.2" rx="1.9" fill="currentColor" />
          <path d="M2.4 5.6a3.6 3.6 0 0 0 7.2 0M6 9.3v1.7" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

/**
 * The credit at the foot of every reel, identical on the Radio and in Music:
 * the creator as a wall label (with a note or a microphone), then the title
 * in a two-line slot that's always the same height, so nothing shifts as you
 * scroll between songs and conversations.
 */
export function Credit({ kind, creatorId, title, children }: { kind: 'song' | 'episode'; creatorId: string; title: string; children?: ReactNode }) {
  const c = creatorById[creatorId]
  return (
    <div className="reel__meta">
      {children}
      <button className="reel__who" onClick={() => useUI.getState().openSheet({ kind: 'creator', creatorId })} aria-label={`${c?.name}, ${kind === 'song' ? 'music' : 'podcast'}`}>
        <KindMark kind={kind} />
        <span>{c?.name}</span>
      </button>
      <div className="reel__slot">
        <p className="reel__title">{title}</p>
      </div>
    </div>
  )
}
