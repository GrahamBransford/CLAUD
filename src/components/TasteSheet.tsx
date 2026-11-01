import { useMemo } from 'react'
import { creatorById } from '../data'
import { useMyTaste } from '../hooks/useSocial'
import { tasteTwins } from '../lib/creators'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Sheet } from './Sheet'

export function useTasteTwins() {
  const mine = useMyTaste()
  const experiences = useStore((s) => s.experiences)
  return useMemo(() => tasteTwins(mine, experiences), [mine, experiences])
}

/** The creators whose own listening is closest to yours. */
export function TasteSheet() {
  const twins = useTasteTwins()
  const close = () => useUI.getState().openSheet(null)
  return (
    <Sheet label="Closest taste" onClose={close}>
      <div className="details">
        <header className="details__head">
          <h2>Your taste, matched</h2>
          <span className="details__demo">Estimate · demo</span>
        </header>
        <p className="details__note">The creators whose own vinyl is closest to yours: what they listen to, and the shows they’ve been to.</p>
        <ol className="ranks">
          {twins.map((t, i) => {
            const c = creatorById[t.creatorId]
            const shared = t.shared.map((id) => creatorById[id]?.name).filter(Boolean)
            return (
              <li key={t.creatorId}>
                <button className="rank" onClick={() => useUI.getState().openPerson(`creator:${t.creatorId}`)}>
                  <span className="rank__n">{i + 1}</span>
                  <img className="rank__img" src={c.avatar} alt="" />
                  <span className="rank__text">
                    <strong>{c.name}</strong>
                    <em>{shared.length ? `You both love ${shared.slice(0, 2).join(' and ')}` : c.genre}</em>
                  </span>
                  <span className="rank__right">
                    <strong>{t.score}%</strong>
                    <em>match</em>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </Sheet>
  )
}
