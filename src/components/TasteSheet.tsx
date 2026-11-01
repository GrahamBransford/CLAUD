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
    <Sheet label="Taste twin" onClose={close} tall title="Taste twin">
      <div className="details">
        <p className="details__note">Creators whose own listening is closest to yours.</p>
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
        <p className="sheet__note">Estimates from sample listening · demo</p>
      </div>
    </Sheet>
  )
}
