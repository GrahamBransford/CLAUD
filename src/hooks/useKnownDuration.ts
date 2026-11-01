import { useEffect, useState, type RefObject } from 'react'
import type { PlayerLike } from '../lib/players'

/**
 * The real length of whatever's playing, once the player knows it. Embedded
 * songs (YouTube) don't carry a duration in the content file, so this is
 * how they learn whether there's more than three minutes to offer.
 */
export function useKnownDuration(ref: RefObject<PlayerLike | null>, version: number) {
  const [known, setKnown] = useState<{ v: number; d: number }>({ v: version, d: 0 })
  useEffect(() => {
    const p = ref.current
    if (!p) return
    const read = () => {
      const d = p.duration
      if (Number.isFinite(d) && d > 0) setKnown({ v: version, d })
    }
    read()
    p.addEventListener('loadedmetadata', read)
    p.addEventListener('play', read)
    p.addEventListener('durationchange', read)
    return () => {
      p.removeEventListener('loadedmetadata', read)
      p.removeEventListener('play', read)
      p.removeEventListener('durationchange', read)
    }
  }, [ref, version])
  return known.v === version ? known.d : 0
}
