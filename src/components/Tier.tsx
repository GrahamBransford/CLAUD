import { TIERS, tierIndex, type Relationship, type TierId } from '../lib/affinity'
import { creatorById } from '../data'

const STAR = Array.from({ length: 24 }, (_, i) => {
  const r = i % 2 ? 11.2 : 15.5
  const a = (i / 24) * Math.PI * 2 - Math.PI / 2
  return `${16 + Math.cos(a) * r},${16 + Math.sin(a) * r}`
}).join(' ')

/**
 * The tier mark, a record label seen from above: each step inward fills one
 * more ring; the top 1% is a gold starburst.
 */
export function TierBadge({ tier }: { tier: TierId }) {
  const n = tierIndex(tier)
  const label = TIERS.find((t) => t.id === tier)!.label
  return (
    <span className={`tier tier--${tier}`}>
      <svg viewBox="0 0 32 32" aria-hidden>
        {tier === 'top1' ? (
          <>
            <polygon points={STAR} fill="var(--mustard)" />
            <circle cx="16" cy="16" r="9.5" fill="var(--cherry)" />
            <circle cx="16" cy="16" r="2.2" fill="var(--mustard)" />
          </>
        ) : (
          <>
            <circle cx="16" cy="16" r="15" fill="var(--vinyl)" />
            {[13, 10.4, 7.8, 5.2].map((r, i) => (
              <circle key={r} cx="16" cy="16" r={r} fill="none" stroke={i < n ? 'var(--mustard)' : 'rgba(255,255,255,.16)'} strokeWidth={i < n ? 1.6 : 0.8} />
            ))}
            <circle cx="16" cy="16" r="2.4" fill={n >= 3 ? 'var(--cherry)' : 'rgba(255,255,255,.35)'} />
          </>
        )}
      </svg>
      <span className="tier__label">{label}</span>
    </span>
  )
}

/**
 * How a creator could reward their closest fans. Shown only once earned.
 * Demo only: nothing here is offered by, or agreed with, the creator.
 */
export function RewardCard({ rel }: { rel: Relationship }) {
  const c = creatorById[rel.creatorId]
  if (!c || (rel.tier.id !== 'top1' && rel.tier.id !== 'inner')) return null
  const top = rel.tier.id === 'top1'
  const perk =
    c.kind === 'podcast'
      ? top ? 'Next week’s episode, two days early.' : 'Early access to bonus episodes.'
      : top ? 'Early access to the next release is waiting for you.' : 'A presale code for the next tour.'
  return (
    <div className={`reward ${top ? 'reward--top' : ''}`}>
      <p className="reward__title">{top ? `You’re in ${c.name}’s Inner Circle.` : `You’re close to ${c.name}.`}</p>
      <p className="reward__body">{perk}</p>
      <span className="reward__demo">Demo reward</span>
    </div>
  )
}
