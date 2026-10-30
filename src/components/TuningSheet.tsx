import { creatorById } from '../data'
import { useUniverse } from '../hooks/useRelationship'
import { formatTop, SIGNAL_LABELS, WEIGHTS } from '../lib/affinity'
import { Sheet } from './Sheet'
import { TierBadge } from './Tier'
import { useUI } from '../store/useUI'

/** Plain-language explanation of how relationships are scored, with live numbers. */
export function TuningSheet() {
  const close = () => useUI.getState().openSheet(null)
  const all = useUniverse()
  const rows = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).sort((a, b) => WEIGHTS[b] - WEIGHTS[a])
  return (
    <Sheet title="How closeness is measured" onClose={close}>
      <div className="tuning">
        <p className="eyebrow">How closeness is measured</p>
        <h2 className="sheet-title">Measured by listening, not by likes.</h2>
        <ol className="tuning__rules">
          <li><strong>Inner Circle only shows people you follow.</strong> No trends, ads or strangers.</li>
          <li><strong>Closest relationships come first.</strong> Each signal below adds points. A show you went to is worth ninety times a like.</li>
          <li><strong>Points become an estimated percentile</strong> against a modelled audience for that creator, which places them on your record.</li>
        </ol>
        <table className="tuning__table">
          <thead><tr><th>Signal</th><th>Points each</th></tr></thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k}><td>{SIGNAL_LABELS[k]}</td><td>{WEIGHTS[k]}{k === 'minutes' ? ' per minute' : ''}</td></tr>
            ))}
          </tbody>
        </table>
        <table className="tuning__table">
          <thead><tr><th>Creator</th><th>Points</th><th>Estimate</th><th>Tier</th></tr></thead>
          <tbody>
            {all.map((r) => (
              <tr key={r.creatorId}>
                <td>{creatorById[r.creatorId]?.name}{r.followed ? '' : ' (not followed)'}</td>
                <td>{r.points}</td>
                <td>{formatTop(r.top)}</td>
                <td><TierBadge tier={r.tier.id} size="sm" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="fine">
          Demo note: the numbers start from a simulated listening history standing in for a connected streaming account.
          Everything you do in CIRCA is added on top. Percentiles are estimates, not verified rankings.
        </p>
      </div>
    </Sheet>
  )
}
