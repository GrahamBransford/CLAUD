import { useState, type ChangeEvent } from 'react'
import { creatorById, creators, meSeed, personById } from '../data'
import { useUpdates } from '../hooks/useUpdates'
import { ago } from '../lib/updates'
import { useMyTaste, useFriendActions } from '../hooks/useSocial'
import { useUniverse } from '../hooks/useRelationship'
import { alignment, experienceLine } from '../lib/social'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { ExperienceKind, Profile } from '../types'
import * as I from './Icons'
import { LiveStats } from './ProfileDetails'
import { Sheet } from './Sheet'
import { Pager } from './Pager'

const close = () => useUI.getState().openSheet(null)

/** Shrinks a chosen photo to a small square, so it fits in local storage. */
function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const n = 320
      const c = document.createElement('canvas')
      c.width = c.height = n
      const s = Math.min(img.width, img.height)
      c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, n, n)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/** Who you are, all optional. The record says the rest. */
export function ProfileSheet() {
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const favorites = useStore((s) => s.favorites)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const all = useUniverse()
  const [draft, setDraft] = useState<Profile>(profile)
  const field = (k: 'name' | 'username' | 'bio' | 'location') => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft({ ...draft, [k]: k === 'username' ? e.target.value.replace(/[^a-z0-9._]/gi, '').toLowerCase() : e.target.value })
  const done = () => {
    setProfile(draft)
    close()
  }
  return (
    <Sheet label="Edit profile" onClose={done} title="Edit profile">
      <div className="form">
        <div className="form__photo">
          <span className="minidisc minidisc--lg">
            <img src={draft.avatar} alt="" />
          </span>
          <label className="pill pill--quiet">
            Change photo
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) setDraft({ ...draft, avatar: await readPhoto(f) })
              }}
            />
          </label>
          {draft.avatar !== meSeed.avatar && (
            <button className="form__text-btn" onClick={() => setDraft({ ...draft, avatar: meSeed.avatar })}>
              Use portrait
            </button>
          )}
        </div>
        <label className="form__row">
          <span>Name</span>
          <input value={draft.name} onChange={field('name')} maxLength={40} autoComplete="name" />
        </label>
        <label className="form__row">
          <span>Username</span>
          <input value={draft.username} onChange={field('username')} maxLength={24} autoCapitalize="none" />
        </label>
        <label className="form__row">
          <span>Bio</span>
          <textarea value={draft.bio} onChange={field('bio')} maxLength={120} rows={2} />
        </label>
        <label className="form__row">
          <span>Location</span>
          <input value={draft.location} onChange={field('location')} maxLength={40} placeholder="Optional" />
        </label>
        <label className="form__row">
          <span>Instagram</span>
          <input
            value={draft.socials.instagram ?? ''}
            onChange={(e) => setDraft({ ...draft, socials: { ...draft.socials, instagram: e.target.value.replace(/^@/, '').trim() } })}
            placeholder="Optional · how friends reach you"
            autoCapitalize="none"
          />
        </label>

        <p className="settings__label">Favourites</p>
        <div className="favs">
          {all.map((r) => {
            const c = creators.find((x) => x.id === r.creatorId)!
            const on = favorites.includes(c.id)
            return (
              <button key={c.id} className={`fav ${on ? 'is-on' : ''}`} onClick={() => toggleFavorite(c.id)} aria-pressed={on} aria-label={`Favourite ${c.name}`}>
                <img src={c.avatar} alt="" />
                {on && (
                  <i>
                    <I.Spark size={12} on />
                  </i>
                )}
              </button>
            )
          })}
        </div>
        <p className="settings__fine">Favourites wear a spark on your vinyl.</p>
        <button className="pill pill--cherry form__done" onClick={done}>
          Done
        </button>
      </div>
    </Sheet>
  )
}

const KINDS: { id: ExperienceKind; label: string }[] = [
  { id: 'concert', label: 'Concert' },
  { id: 'festival', label: 'Festival' },
  { id: 'performance', label: 'Live taping or event' },
  { id: 'other', label: 'Something else' },
]

/** The shows and moments that shaped you. Self-reported, and said so. */
export function LiveSheet() {
  const experiences = useStore((s) => s.experiences)
  const add = useStore((s) => s.addExperience)
  const remove = useStore((s) => s.removeExperience)
  const [kind, setKind] = useState<ExperienceKind>('concert')
  const [creatorId, setCreatorId] = useState('')
  const [title, setTitle] = useState('')
  const [place, setPlace] = useState('')
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const c = creators.find((x) => x.id === creatorId)
  const canAdd = !!(c || title.trim())
  const submit = () => {
    if (!canAdd) return
    add({ kind, creatorId: c?.id, title: title.trim() || c!.name, place: place.trim() || undefined, year: Number(year) || undefined })
    setTitle('')
    setPlace('')
    setCreatorId('')
    useUI.getState().pushToast({ image: c?.avatar, title: 'Added to your vinyl', detail: c && kind !== 'other' ? 'Etched in the run-out · self-reported' : 'Self-reported' })
  }
  return (
    <Sheet label="Live" onClose={close} title="Live">
      <div className="form">
        {experiences.length > 0 && <LiveStats experiences={experiences} />}
        <p className="settings__label">On your record</p>
        {experiences.length ? (
          <ul className="live-list">
            {experiences.map((x) => (
              <li key={x.id}>
                {x.creatorId && creatorById[x.creatorId] ? <img className="live-list__face" src={creatorById[x.creatorId].avatar} alt="" /> : <I.Ticket size={18} />}
                <span>{experienceLine(x)}</span>
                <button className="icon-btn" onClick={() => remove(x.id)} aria-label={`Remove ${experienceLine(x)}`}>
                  <I.Close size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="settings__fine">Nothing yet. Add a show you went to.</p>
        )}

        <p className="settings__label">Add an experience</p>
        <div className="chips">
          {KINDS.map((k) => (
            <button key={k.id} className={`chip ${kind === k.id ? 'is-on' : ''}`} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
        </div>
        <label className="form__row">
          <span>Who</span>
          <select value={creatorId} onChange={(e) => setCreatorId(e.target.value)}>
            <option value="">Someone not on CIRCA</option>
            {creators.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        {(kind === 'festival' || kind === 'other' || !c) && (
          <label className="form__row">
            <span>{kind === 'festival' ? 'Festival' : 'What'}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'festival' ? 'e.g. Sound on the Water' : 'e.g. First record I ever bought'} maxLength={60} />
          </label>
        )}
        <div className="form__pair">
          <label className="form__row">
            <span>Where</span>
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Venue or city" maxLength={50} />
          </label>
          <label className="form__row form__row--year">
            <span>Year</span>
            <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" />
          </label>
        </div>
        <button className="pill pill--cherry form__done" onClick={submit} disabled={!canAdd}>
          <I.Ticket size={16} /> Add to my vinyl
        </button>
        <p className="settings__fine">Self-reported, never verified. A show brings that creator closer on your record.</p>
      </div>
    </Sheet>
  )
}

/** Requests, friends, and updates from the vinyls you follow. No messaging, on purpose. */
export function FriendsSheet() {
  const friends = useStore((s) => s.friends)
  const experiences = useStore((s) => s.experiences)
  const markSeen = useStore((s) => s.markUpdatesSeen)
  const mine = useMyTaste()
  const act = useFriendActions()
  const updates = useUpdates()
  const [tab, setTab] = useState<'updates' | 'friends'>('updates')
  const ids = (st: string) => Object.keys(friends).filter((id) => friends[id] === st && personById[id])
  // what you've looked at here counts as seen, once you leave
  const seenAll = () => markSeen(updates.list.map((u) => u.key))
  const open = (id: string) => {
    seenAll()
    useUI.getState().openPerson(id)
  }
  const score = (id: string) => alignment(mine, personById[id].points, experiences, personById[id].experiences).score
  return (
    <Sheet
      label="Friends"
      title="Friends"
      tall
      onClose={() => {
        seenAll()
        close()
      }}
    >
      <div className="form form--tabs">
        <div className="seg" role="tablist" aria-label="Friends">
          <button role="tab" aria-selected={tab === 'updates'} onClick={() => setTab('updates')}>
            Updates{updates.unseen + updates.incoming > 0 ? <i className="seg__count">{updates.unseen + updates.incoming}</i> : null}
          </button>
          <button role="tab" aria-selected={tab === 'friends'} onClick={() => setTab('friends')}>
            Friends · {ids('friends').length}
          </button>
        </div>

        <Pager
          ids={['updates', 'friends'] as const}
          current={tab}
          onChange={setTab}
          render={(t) =>
            t === 'updates' ? (
          <div className="form__page">
            {ids('incoming').map((id) => (
              <div key={id} className="request">
                <button className="person-row__who" onClick={() => open(id)}>
                  <span className="minidisc"><img src={personById[id].avatar} alt="" /></span>
                  <span className="hit__text">
                    <strong>{personById[id].name}</strong>
                    <em>Wants to be friends · {score(id)}% aligned</em>
                  </span>
                </button>
                <div className="request__actions">
                  <button className="pill pill--cherry" onClick={() => act.accept(id)}>Accept</button>
                  <button className="pill pill--quiet" onClick={() => act.decline(id)}>Decline</button>
                </div>
              </div>
            ))}
            {updates.list.length ? (
              <ul className="notes">
                {updates.list.map((u) => {
                  const c = u.creatorId ? creatorById[u.creatorId] : undefined
                  return (
                    <li key={u.key}>
                      <button className={`note ${updates.seen.has(u.key) ? '' : 'is-new'}`} onClick={() => open(u.personId)}>
                        <span className="minidisc"><img src={personById[u.personId].avatar} alt="" /></span>
                        <span className="note__text">{u.text}</span>
                        {c && <img className="note__creator" src={c.avatar} alt="" />}
                        <span className="note__ago">{ago(u.hoursAgo)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="settings__fine">When friends add to their vinyl, go to a show or move someone closer, it shows up here.</p>
            )}
            <p className="settings__fine">From friends whose updates you follow · sample listeners</p>
          </div>
            ) : (
          <div className="form__page">
            {ids('friends').length ? (
              ids('friends').map((id) => (
                <button key={id} className="person-row person-row__who" onClick={() => open(id)}>
                  <span className="minidisc"><img src={personById[id].avatar} alt="" /></span>
                  <span className="hit__text">
                    <strong>{personById[id].name}</strong>
                    <em>@{personById[id].username}</em>
                  </span>
                  <span className="hit__match">{score(id)}%</span>
                </button>
              ))
            ) : (
              <p className="settings__fine">Search for people above your record, and open their vinyl to add them.</p>
            )}
            {ids('outgoing').map((id) => (
              <div key={id} className="person-row">
                <button className="person-row__who" onClick={() => open(id)}>
                  <span className="minidisc"><img src={personById[id].avatar} alt="" /></span>
                  <span className="hit__text">
                    <strong>{personById[id].name}</strong>
                    <em>Request sent</em>
                  </span>
                </button>
                <button className="pill pill--quiet" onClick={() => act.cancel(id)}>Cancel</button>
              </div>
            ))}
            <p className="settings__fine">No messaging in CIRCA: to talk, use the socials on someone’s vinyl. Sample listeners.</p>
          </div>
            )
          }
        />
      </div>
    </Sheet>
  )
}
