import { useMemo, useState } from 'react'
import { creatorById, personById } from '../data'
import { useProfile } from '../hooks/useProfile'
import { communitiesOf, matchAll, matchCommunity, whenLabel, type CommunityMatch } from '../lib/communities'
import { coordsFor, distanceLabel } from '../lib/geo'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import * as I from './Icons'
import { Sheet } from './Sheet'
import { Pager } from './Pager'

/** Your location, the matches, and what you've joined: shared by everything community-shaped. */
export function useCommunityMatches() {
  const profile = useProfile('me')
  const location = useStore((s) => s.profile.location)
  const friends = useStore((s) => s.friends)
  return useMemo(() => {
    const here = coordsFor(location)
    const all = profile ? matchAll(profile, here, friends) : []
    return { all, here, location: location.split(',')[0], match: (id: string) => all.find((m) => m.community.id === id) }
  }, [profile, location, friends])
}

/**
 * Communities: where listening turns into people. For you (matched across
 * everything, with the reasons), near you (in person, close by) and online.
 * Opened from a creator, it leads with the communities they curate and the
 * local scenes in their style.
 */
export function CommunitiesSheet({ creatorId }: { creatorId?: string }) {
  const { all, location } = useCommunityMatches()
  const [tab, setTab] = useState<'for-you' | 'near' | 'online'>('for-you')
  const close = () => useUI.getState().openSheet(null)
  const c = creatorId ? creatorById[creatorId] : undefined

  if (c) {
    const theirs = all.filter((m) => m.community.creatorId === c.id)
    const scene = all.filter((m) => m.community.creatorId !== c.id && m.near && (m.community.styles[0] === c.style || m.community.styles[1] === c.genre))
    return (
      <Sheet label={`${c.name}: communities`} onClose={close} tall title="Communities">
        <div className="details">
          {theirs.length ? theirs.map((m) => <CommunityCard key={m.community.id} m={m} />) : <p className="details__note">No communities yet.</p>}
          {c.style && (
            <>
              <p className="settings__label">
                {c.style} near {location || 'you'}
              </p>
              {scene.length ? scene.map((m) => <CommunityCard key={m.community.id} m={m} />) : <p className="details__note">Nothing in person near you yet. The online ones above are open to everyone.</p>}
            </>
          )}
          <p className="sheet__note">Matched from your listening, location and friends · sample groups · demo</p>
        </div>
      </Sheet>
    )
  }

  const listFor = (t: typeof tab) =>
    t === 'near' ? all.filter((m) => m.near).sort((a, b) => (a.km ?? 0) - (b.km ?? 0)) : t === 'online' ? all.filter((m) => m.community.format !== 'In person') : all.slice(0, 8)
  return (
    <Sheet label="Communities" onClose={close} tall title="Communities">
      <div className="details">
        <div className="seg" role="tablist" aria-label="Communities">
          <button role="tab" aria-selected={tab === 'for-you'} onClick={() => setTab('for-you')}>
            For you
          </button>
          <button role="tab" aria-selected={tab === 'near'} onClick={() => setTab('near')}>
            Near {location || 'you'}
          </button>
          <button role="tab" aria-selected={tab === 'online'} onClick={() => setTab('online')}>
            Online
          </button>
        </div>
        <Pager
          ids={['for-you', 'near', 'online'] as const}
          current={tab}
          onChange={setTab}
          render={(t) => (
            <div className="details__body">
              {listFor(t).length ? (
                listFor(t).map((m) => <CommunityCard key={m.community.id} m={m} showCreator />)
              ) : (
                <p className="details__note">Nothing here yet.</p>
              )}
            </div>
          )}
        />
        <p className="sheet__note">Matched from your listening, location and friends · sample groups · demo</p>
      </div>
    </Sheet>
  )
}

/** One community: who curates it, where and how often it meets, who's in it, why it suits you, and the next gathering. */
export function CommunityCard({ m, showCreator = false, compact = false }: { m: CommunityMatch; showCreator?: boolean; compact?: boolean }) {
  const cm = m.community
  const creator = creatorById[cm.creatorId]
  const joined = useStore((s) => s.joined.includes(cm.id))
  const going = useStore((s) => s.going.includes(cm.id))
  const toggleJoin = useStore((s) => s.toggleJoin)
  const toggleGoing = useStore((s) => s.toggleGoing)
  const toast = useUI((s) => s.pushToast)
  const where = cm.format === 'Online' ? 'Online' : `${cm.format === 'In person' ? '' : 'Online + '}${cm.city?.split(',')[0]}${m.km !== undefined ? ` · ${distanceLabel(m.km)}` : ''}`
  const join = () => {
    const on = toggleJoin(cm.id)
    toast({ image: creator?.avatar, title: on ? `Joined ${cm.name}` : `Left ${cm.name}`, detail: on ? 'Demo' : undefined })
  }
  const rsvp = () => {
    const on = toggleGoing(cm.id)
    if (on) toast({ image: creator?.avatar, title: `You’re going: ${cm.next.title}`, detail: `${whenLabel(cm.next.inDays)} · ${cm.next.place}` })
  }
  return (
    <article className={`community ${cm.by === 'creator' ? 'community--curated' : ''} ${m.near ? 'is-near' : ''}`}>
      <header className="community__head">
        {showCreator && creator && <img className="community__creator" src={creator.avatar} alt="" />}
        <div className="community__title">
          <p className="community__by">
            {cm.by === 'creator' ? <>Curated by {creator?.name}</> : <>Fan-run{showCreator && creator ? ` · ${creator.name}` : ''}</>}
          </p>
          <h3>{cm.name}</h3>
          <p className="community__where">
            {cm.format === 'Online' ? <I.Knob size={12} /> : <I.Pin size={12} />} {where} · {cm.rhythm}
          </p>
        </div>
      </header>
      {!compact && <p className="community__about">{cm.about}</p>}
      {m.reasons.length > 0 && (
        <ul className="community__why" aria-label="Why it suits you">
          {m.reasons.slice(0, compact ? 2 : 3).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <div className="community__members">
        <span className="match__faces">
          {cm.memberIds.slice(0, 3).map((id) => personById[id] && <img key={id} src={personById[id].avatar} alt="" />)}
        </span>
        <span>
          {(cm.members + (joined ? 1 : 0)).toLocaleString()} members{m.friends.length ? ` · ${m.friends.length} ${m.friends.length === 1 ? 'friend' : 'friends'}` : ''}
        </span>
      </div>
      <div className="community__next">
        <span className="community__date">{whenLabel(cm.next.inDays)}</span>
        <span className="community__event">
          <strong>{cm.next.title}</strong>
          <em>{cm.next.place}</em>
        </span>
      </div>
      <div className="community__actions">
        <button className={`pill ${joined ? 'pill--quiet' : 'pill--cherry'}`} onClick={join} aria-pressed={joined}>
          {joined ? (
            <>
              <I.Check size={15} /> Joined
            </>
          ) : (
            'Join'
          )}
        </button>
        <button className="pill pill--quiet" onClick={rsvp} aria-pressed={going}>
          {going ? (
            <>
              <I.Check size={15} /> Going
            </>
          ) : (
            <>
              <I.Ticket size={15} /> I’ll be there
            </>
          )}
        </button>
      </div>
    </article>
  )
}

/** A one-line summary for a creator: "3 communities · 1 near you". */
export function useCreatorCommunities(creatorId: string) {
  const { all } = useCommunityMatches()
  return useMemo(() => {
    const own = communitiesOf(creatorId)
    const matches = all.filter((m) => m.community.creatorId === creatorId)
    return { count: own.length, near: matches.filter((m) => m.near).length, matches }
  }, [all, creatorId])
}

export { matchCommunity }
