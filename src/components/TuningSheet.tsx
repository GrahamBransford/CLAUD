import { creatorById } from '../data'
import { rankCircle, WEIGHTS } from '../lib/affinity'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Sheet } from './Sheet'

/** Plain-language explanation of how Handhelds is ordered, with the live numbers. */
export function TuningSheet() {
  const close = () => useUI.getState().openSheet(null)
  const follows = useStore((s) => s.follows)
  const listening = useStore((s) => s.listening)
  const saved = useStore((s) => s.saved)
  const circle = rankCircle(follows, listening, saved)
  return (
    <Sheet title="How Handhelds is ordered" onClose={close}>
      <div className="tuning">
        <p className="eyebrow">How Handhelds is ordered</p>
        <h2 className="sheet-title">Tuned by listening, not by likes.</h2>
        <ol className="tuning__rules">
          <li>
            <strong>Only people you follow.</strong> Nobody else can reach this feed — not trends, not ads, not strangers.
          </li>
          <li>
            <strong>Ordered by what you actually listen to.</strong> How often you play someone ({Math.round(WEIGHTS.plays * 100)}%), how
            much of their work you finish ({Math.round(WEIGHTS.completion * 100)}%) and what you keep ({Math.round(WEIGHTS.saves * 100)}%).
          </li>
          <li>
            <strong>Then by recency.</strong> Within a creator, newest first. The feed ends when you&rsquo;re caught up.
          </li>
        </ol>
        <table className="tuning__table">
          <thead>
            <tr><th>Creator</th><th>Plays</th><th>Finished</th><th>Saved</th><th>Score</th></tr>
          </thead>
          <tbody>
            {circle.map((a) => (
              <tr key={a.creatorId}>
                <td>{creatorById[a.creatorId].name}</td>
                <td>{a.plays}</td>
                <td>{Math.round(a.completion * 100)}%</td>
                <td>{a.saves}</td>
                <td><strong>{a.score}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="fine">
          Demo note: play counts start from a simulated listening history standing in for a connected Spotify or Apple Music
          account. Everything you do in Singers and Speakers is added on top, so the order changes as you listen.
        </p>
      </div>
    </Sheet>
  )
}
