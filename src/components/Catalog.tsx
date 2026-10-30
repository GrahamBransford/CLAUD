import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { creators, meSeed, people } from '../data'
import { useMyTaste } from '../hooks/useSocial'
import { coordsFor, distanceLabel, km, nearAndAligned } from '../lib/geo'
import { alignment, search } from '../lib/social'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { Person } from '../types'
import * as I from './Icons'

/**
 * Search, as a record catalogue: a lens in the corner of the vinyl area that
 * opens out into the full search page. Two drawers only: creators appear as
 * medallions; people as small records with their face on the label.
 */
export function Catalog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const mine = useMyTaste()
  const experiences = useStore((s) => s.experiences)
  const friends = useStore((s) => s.friends)
  const location = useStore((s) => s.profile.location)

  useEffect(() => onOpenChange(open), [open, onOpenChange])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const match = (p: Person) => alignment(mine, p.points, experiences, p.experiences).score
  // Where you are, from your profile (no GPS in the demo).
  const here = coordsFor(location) ?? (location === meSeed.location ? meSeed.coords : undefined)
  const away = (p: Person) => (here && p.coords ? km(here, p.coords) : undefined)
  const results = useMemo(() => {
    if (q.trim()) return search(q)
    // Nothing typed: people you could actually go to a show with — shared taste, then nearness — and every creator.
    const others = people.filter((p) => friends[p.id] !== 'friends')
    const rank = (p: Person) => nearAndAligned(match(p), away(p))
    return { creators, people: others.sort((a, b) => rank(b) - rank(a)).slice(0, 5) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, friends, mine, experiences, location])

  function close() {
    setOpen(false)
    setQ('')
    input.current?.blur()
  }
  const pick = (fn: () => void) => {
    close()
    fn()
  }

  return (
    <>
      {/* collapsed: just the lens, in the corner of the vinyl area */}
      <button className="catalog__open" onClick={() => setOpen(true)} aria-label="Search artists, podcasts and people" aria-expanded={open}>
        <I.Search size={20} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="catalog is-open"
            role="dialog"
            aria-label="Search"
            initial={{ clipPath: 'circle(24px at 36px 36px)' }}
            animate={{ clipPath: 'circle(150% at 36px 36px)', transition: { duration: 0.42, ease: [0.4, 0, 0.2, 1] } }}
            exit={{ clipPath: 'circle(24px at 36px 36px)', transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] } }}
            onAnimationComplete={() => input.current?.focus()}
          >
            <div className="catalog__bar">
              <label className="catalog__field">
                <I.Search size={18} />
                <input
                  ref={input}
                  type="search"
                  value={q}
                  placeholder="Artists, podcasts, people"
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search artists, podcasts and people"
                  enterKeyHint="search"
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <button className="catalog__cancel" onClick={close}>
                Cancel
              </button>
            </div>
            <div className="catalog__results">
            {results.people.length > 0 && (
              <section>
                <h2 className="catalog__drawer">{q.trim() ? 'People' : here ? 'People near you who share your taste' : 'People who share your taste'}</h2>
                {!q.trim() && here && <p className="catalog__note">Closest taste first, weighted toward people near {location}. From your profile location, not GPS.</p>}
                {results.people.map((p) => (
                  <button key={p.id} className="hit hit--person" onClick={() => pick(() => useUI.getState().openPerson(p.id))}>
                    <span className="minidisc">
                      <img src={p.avatar} alt="" />
                    </span>
                    <span className="hit__text">
                      <strong>{p.name}</strong>
                      <em>
                        {p.location ?? `@${p.username}`}
                        {away(p) !== undefined ? ` · ${distanceLabel(away(p)!)}` : ''}
                      </em>
                    </span>
                    <span className="hit__match">
                      {friends[p.id] === 'friends' && <I.Check size={14} />}
                      {match(p)}%
                    </span>
                  </button>
                ))}
              </section>
            )}
            {results.creators.length > 0 && (
              <section>
                <h2 className="catalog__drawer">Creators</h2>
                {results.creators.map((c) => (
                  <button key={c.id} className="hit hit--creator" onClick={() => pick(() => useUI.getState().openSheet({ kind: 'creator', creatorId: c.id }))}>
                    <img className="medallion" src={c.avatar} alt="" />
                    <span className="hit__text">
                      <strong>{c.name}</strong>
                      <em>{c.genre}</em>
                    </span>
                  </button>
                ))}
              </section>
            )}
            {!results.people.length && !results.creators.length && <p className="catalog__none">Nothing in the catalogue for “{q}”.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
