import { Lock, Sparkles } from 'lucide-react'
import { TIERS, tierIndex, type Relationship, type TierId } from '../lib/affinity'
import { creatorById } from '../data'

const STAR = Array.from({ length: 24 }, (_, i) => {
  const r = i % 2 ? 11.2 : 15.5
  const a = (i / 24) * Math.PI * 2 - Math.PI / 2
  return `${16 + Math.cos(a) * r},${16 + Math.sin(a) * r}`
}).join(' ')

/**
 * Tier mark, drawn like a record label seen from above: each step inward
 * fills one more ring; the top 1% becomes a gold starburst.
 */
export function TierBadge({ tier, size = 'md' }: { tier: TierId; size?: 'sm' | 'md' | 'lg' }) {
  const n = tierIndex(tier) // 0 discovered … 4 top 1%
  const label = TIERS.find((t) => t.id === tier)!.label
  const px = size === 'sm' ? 30 : size === 'lg' ? 64 : 42
  return (
    <span className={`tier-badge tier-badge--${tier} tier-badge--${size}`} title={label}>
      <svg width={px} height={px} viewBox="0 0 32 32" aria-hidden>
        {tier === 'top1' ? (
          <>
            <polygon points={STAR} fill="var(--mustard)" />
            <circle cx="16" cy="16" r="9.5" fill="var(--cherry)" />
            <circle cx="16" cy="16" r="6.5" fill="none" stroke="var(--mustard)" strokeWidth="1" />
            <circle cx="16" cy="16" r="2.2" fill="var(--mustard)" />
          </>
        ) : (
          <>
            <circle cx="16" cy="16" r="15" fill="var(--vinyl)" stroke="rgba(255,255,255,.28)" strokeWidth="1" />
            {[13, 10.4, 7.8, 5.2].map((r, i) => (
              <circle key={r} cx="16" cy="16" r={r} fill="none" stroke={i < n ? 'var(--mustard)' : 'rgba(255,255,255,.14)'} strokeWidth={i < n ? 1.6 : 0.8} />
            ))}
            <circle cx="16" cy="16" r="2.4" fill={n >= 3 ? 'var(--cherry)' : 'rgba(255,255,255,.3)'} />
          </>
        )}
      </svg>
      {size !== 'sm' && <span className="tier-badge__label">{label}</span>}
    </span>
  )
}

/** The five steps from the edge to the centre, with where you stand. */
export function TierLadder({ rel }: { rel: Relationship }) {
  const order = [...TIERS].reverse() // discovered … top1
  const here = tierIndex(rel.tier.id)
  return (
    <ol className="tier-ladder" aria-label="Tiers from the outer edge to the centre">
      {order.map((t, i) => (
        <li key={t.id} className={i < here ? 'is-past' : i === here ? 'is-here' : ''}>
          <span className="tier-ladder__dot" />
          <span className="tier-ladder__label">{t.label}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * How a creator could reward their closest fans. Demo only: nothing here is
 * offered by, or has been agreed with, the real creator.
 */
export function RewardCard({ rel }: { rel: Relationship }) {
  const c = creatorById[rel.creatorId]
  if (!c) return null
  const unlocked = rel.tier.id === 'top1' || rel.tier.id === 'inner'
  const perk =
    c.kind === 'podcast'
      ? rel.tier.id === 'top1'
        ? 'Hear next week’s episode two days early, and send a question for the mailbag.'
        : 'Early access to bonus episodes.'
      : rel.tier.id === 'top1'
        ? 'Early access to the next release is waiting for you.'
        : 'A presale code for the next tour.'
  return (
    <div className={`reward ${unlocked ? 'is-unlocked' : ''} ${rel.tier.id === 'top1' ? 'is-top' : ''}`}>
      <div className="reward__head">
        <span className="reward__kicker">{unlocked ? <Sparkles size={14} /> : <Lock size={14} />} {unlocked ? 'Unlocked' : 'Inner Circle reward'}</span>
        <span className="tag tag--demo">Demo reward</span>
      </div>
      {unlocked ? (
        <>
          <p className="reward__title">
            {rel.tier.id === 'top1' ? `You’re in ${c.name}’s Inner Circle.` : `You’re close to ${c.name}.`}
          </p>
          <p className="reward__body">{perk}</p>
        </>
      ) : (
        <>
          <p className="reward__title">Rewards open at Inner Circle.</p>
          <p className="reward__body">
            Creators could offer early releases, VIP shows and unreleased work to their closest listeners.
            {rel.next ? ` You’re ${rel.next.hint} from ${rel.next.tier.label}.` : ''}
          </p>
        </>
      )}
      <p className="reward__fine">Illustrates a future creator feature. Nothing has been offered or redeemed.</p>
    </div>
  )
}
