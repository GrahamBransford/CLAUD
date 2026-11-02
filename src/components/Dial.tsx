import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { formatTime } from '../lib/media'

interface Props {
  value: number
  max: number
  onSeek?: (v: number) => void
  /** Shaded ranges, e.g. where a highlight sits inside the full episode. */
  ranges?: { start: number; end: number; label?: string }[]
  /** Small markers, e.g. chapter starts. */
  marks?: number[]
  label: string
  size?: 'md' | 'lg' | 'slim'
  tone?: 'light' | 'dark'
  showTimes?: boolean
}

const TICKS = 48

/** A radio-dial style progress scale: the needle is the playhead. */
export function Dial({ value, max, onSeek, ranges, marks, label, size = 'md', tone = 'light', showTimes = true }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const dragging = useRef(false)

  const seekFromEvent = (e: PointerEvent) => {
    const el = track.current
    if (!el || !onSeek) return
    const r = el.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * max)
  }
  const onKey = (e: KeyboardEvent) => {
    if (!onSeek) return
    const step = e.shiftKey ? 15 : 5
    if (e.key === 'ArrowRight') onSeek(Math.min(max, value + step))
    else if (e.key === 'ArrowLeft') onSeek(Math.max(0, value - step))
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className={`dial dial--${size} dial--${tone}`}>
      <div
        className="dial__track"
        ref={track}
        role="slider"
        tabIndex={onSeek ? 0 : -1}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(max)}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${formatTime(value)} of ${formatTime(max)}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          if (!onSeek) return
          dragging.current = true
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          seekFromEvent(e)
        }}
        onPointerMove={(e) => dragging.current && seekFromEvent(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        {ranges?.map((r, i) => (
          <div
            key={i}
            className="dial__range"
            style={{ left: `${(r.start / max) * 100}%`, width: `${((r.end - r.start) / max) * 100}%` }}
            title={r.label}
          />
        ))}
        <div className="dial__ticks" aria-hidden>
          {Array.from({ length: TICKS + 1 }, (_, i) => (
            <span
              key={i}
              className={i % 8 === 0 ? 'is-major' : i % 4 === 0 ? 'is-mid' : ''}
              data-lit={i / TICKS <= pct ? '' : undefined}
            />
          ))}
        </div>
        {marks?.map((m, i) => (
          <i key={i} className="dial__mark" style={{ left: `${(m / max) * 100}%` }} aria-hidden />
        ))}
        <div className="dial__needle" style={{ left: `${pct * 100}%` }} aria-hidden>
          <span />
        </div>
      </div>
      {showTimes && (
        <div className="dial__times" aria-hidden>
          <span>{formatTime(value)}</span>
          <span>−{formatTime(Math.max(0, max - value))}</span>
        </div>
      )}
    </div>
  )
}
