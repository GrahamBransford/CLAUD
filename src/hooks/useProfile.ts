import { useMemo } from 'react'
import { personFor, profileForMe, profileForPerson, type ListeningProfile, type Owner } from '../lib/profile'
import { useStore } from '../store/useStore'
import { useUniverse } from './useRelationship'

/** The listening profile behind any vinyl: yours, a friend's, or a creator's. */
export function useProfile(owner: Owner): ListeningProfile | null {
  const rels = useUniverse()
  const experiences = useStore((s) => s.experiences)
  const signals = useStore((s) => s.signals)
  const omit = useStore((s) => s.omitStats)
  return useMemo(() => {
    if (owner === 'me') {
      // creators you've left out of your stats don't count anywhere in them
      const out = new Set(omit ?? [])
      if (!out.size) return profileForMe(rels, experiences, signals)
      return profileForMe(
        rels.filter((r) => !out.has(r.creatorId)),
        experiences.filter((x) => !x.creatorId || !out.has(x.creatorId)),
        Object.fromEntries(Object.entries(signals).filter(([id]) => !out.has(id))),
      )
    }
    const p = personFor(owner)
    return p ? profileForPerson(owner, p) : null
  }, [owner, rels, experiences, signals, omit])
}
