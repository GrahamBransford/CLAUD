import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { tick } from '../lib/haptics'

/**
 * Sections side by side, like Instagram's profile tabs: drag sideways and the
 * current section and the next one follow your thumb the whole way, then
 * settle on whichever is closer (or the one you flicked toward). Tapping a
 * tab glides there. Vertical scrolling stays native.
 */
export function Pager<T extends string>({
  ids,
  current,
  onChange,
  render,
  className,
}: {
  ids: readonly T[]
  current: T
  onChange: (id: T) => void
  render: (id: T) => ReactNode
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const pages = useRef<(HTMLDivElement | null)[]>([])
  const [w, setW] = useState(0)
  const [h, setH] = useState<number | undefined>(undefined)
  const x = useMotionValue(0)
  const i = Math.max(0, ids.indexOf(current))

  // width of one section, kept in step with the sheet
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // glide to the current section whenever it changes (a tap on a tab, or a settled swipe)
  useLayoutEffect(() => {
    if (!w) return
    const c = animate(x, -i * w, { type: 'spring', stiffness: 380, damping: 40, mass: 0.8 })
    return () => c.stop()
  }, [i, w, x])

  // the track is as tall as the section in view, so a short section doesn't leave a long empty scroll
  useLayoutEffect(() => {
    const el = pages.current[i]
    if (!el) return
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    setH(el.offsetHeight)
    return () => ro.disconnect()
  }, [i])

  const end = (_: unknown, info: PanInfo) => {
    if (!w) return
    const far = Math.abs(info.offset.x) > w * 0.28
    const flick = Math.abs(info.velocity.x) > 420
    let n = i
    if (far || flick) n = info.offset.x < 0 ? Math.min(ids.length - 1, i + 1) : Math.max(0, i - 1)
    if (n !== i) {
      tick()
      onChange(ids[n])
    } else animate(x, -i * w, { type: 'spring', stiffness: 420, damping: 40 })
  }

  return (
    <div className={`pager ${className ?? ''}`} ref={box} style={{ height: h }}>
      <motion.div
        className="pager__track"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        dragElastic={0.18}
        dragConstraints={{ left: -(ids.length - 1) * w, right: 0 }}
        onDragEnd={end}
      >
        {ids.map((id, k) => (
          <div key={id} className="pager__page" ref={(el) => void (pages.current[k] = el)} role="tabpanel" aria-hidden={k !== i}>
            {render(id)}
          </div>
        ))}
      </motion.div>
    </div>
  )
}
