import type { Cue } from '../types'

/** The line being spoken right now, set as an editorial pull quote. */
export function Transcript({ cues, time, speakers }: { cues: Cue[]; time: number; speakers: Record<string, { name: string }> }) {
  let i = cues.findIndex((c) => time >= c.start - 0.05 && time < c.end + 0.6)
  if (i < 0) {
    // between lines: hold the most recent one
    i = cues.findLastIndex((c) => c.start <= time)
  }
  const cur = i >= 0 ? cues[i] : cues[0]
  if (!cur) return null
  const prev = i > 0 && cues[i - 1].speaker === cur.speaker ? cues[i - 1] : null
  return (
    <figure className="transcript" aria-live="off">
      <figcaption>{speakers[cur.speaker]?.name ?? cur.speaker}</figcaption>
      <blockquote key={i}>
        {prev && <span className="transcript__prev">{prev.text} </span>}
        {cur.text}
      </blockquote>
    </figure>
  )
}
