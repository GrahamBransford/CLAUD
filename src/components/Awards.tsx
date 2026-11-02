import { useState } from 'react'
import { communities } from '../data'
import { useUI } from '../store/useUI'
import type { Award } from '../types'
import * as I from './Icons'

const ICON: Record<Award['kind'], (p: { size?: number }) => React.ReactElement> = {
  host: (p) => <I.Ticket {...p} />,
  industry: (p) => <I.Knob {...p} />,
  top: (p) => <I.Spark on {...p} />,
  tastemaker: (p) => <I.Spark {...p} />,
  founding: (p) => <I.StationCircle {...p} />,
}

/**
 * What someone has earned or does, as small struck medallions: event
 * superhost, an industry role, top 1% of listeners, tastemaker, founding
 * listener. Tap one for the story behind it.
 */
export function Awards({ list }: { list?: Award[] }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!list?.length) return null
  const a = open !== null ? list[open] : undefined
  const community = a?.communityId ? communities.find((c) => c.id === a.communityId) : undefined
  return (
    <div className="awards">
      <ul className="awards__row" aria-label="Awards">
        {list.map((x, i) => (
          <li key={x.title}>
            <button className={`award award--${x.kind} ${open === i ? 'is-open' : ''}`} onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <span className="award__medal" aria-hidden>
                {ICON[x.kind]({ size: 11 })}
              </span>
              {x.title}
            </button>
          </li>
        ))}
      </ul>
      {a && (
        <p className="awards__detail">
          {a.detail}
          {community && (
            <>
              {' · '}
              <button className="awards__link" onClick={() => useUI.getState().openSheet({ kind: 'communities', creatorId: community.creatorId })}>
                {community.name}
              </button>
            </>
          )}
        </p>
      )}
    </div>
  )
}

/** A gold ring round the record: top 1% of listeners this year. */
export const isGilded = (list?: Award[]) => !!list?.some((a) => a.kind === 'top')
