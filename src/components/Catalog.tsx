import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { creators, people } from '../data'
import { useMyTaste } from '../hooks/useSocial'
import { alignment, search } from '../lib/social'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { Person } from '../types'
import * as I from './Icons'

/**
 * Search, as a record catalogue: two drawers only. Creators appear as
 * medallions; people appear as small records with their face on the label.
 */
export function Catalog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const mine = useMyTaste()
  const experiences = useStore((s) => s.experiences)
  const friends = useStore((s) => s.friends)

  useEffect(() => onOpenChange(open), [open, onOpenChange])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const match = (p: Person) => alignment(mine, p.points, experiences, p.experiences).score
  const results = useMemo(() => {
    if (q.trim()) return search(q)
    // Nothing typed: people whose taste is close to yours, and every creator.
    const others = people.filter((p) => friends[p.id] !== 'friends')
    return { creators, people: others.sort((a, b) => match(b) - match(a)).slice(0, 5) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, friends, mine, experiences])

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
    <div className={`catalog ${open ? 'is-open' : ''}`}>
      <div className="catalog__bar">
        <label className="catalog__field">
          <I.Search size={18} />
          <input
            ref={input}
            type="search"
            value={q}
            placeholder="Search artists, podcasts and people"
            onFocus={() => setOpen(true)}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search artists, podcasts and people"
            enterKeyHint="search"
            autoComplete="off"
          />
        </label>
        {open && (
          <button className="catalog__cancel" onClick={close}>
            Cancel
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="catalog__results"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.22 } }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            {results.people.length > 0 && (
              <section>
                <h2 className="catalog__drawer">{q.trim() ? 'People' : 'People who share your taste'}</h2>
                {results.people.map((p) => (
                  <button key={p.id} className="hit hit--person" onClick={() => pick(() => useUI.getState().openPerson(p.id))}>
                    <span className="minidisc">
                      <img src={p.avatar} alt="" />
                    </span>
                    <span className="hit__text">
                      <strong>{p.name}</strong>
                      <em>
                        @{p.username}
                        {p.location ? ` · ${p.location}` : ''}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
