import { useMemo } from 'react'
import { personFor, profileForMe, profileForPerson, type ListeningProfile, type Owner } from '../lib/profile'
import { useStore } from '../store/useStore'
import { useUniverse } from './useRelationship'

/** The listening profile behind any vinyl: yours, a friend's, or a creator's. */
export function useProfile(owner: Owner): ListeningProfile | null {
  const rels = useUniverse()
  const experiences = useStore((s) => s.experiences)
  const signals = useStore((s) => s.signals)
  return useMemo(() => {
    if (owner === 'me') return profileForMe(rels, experiences, signals)
    const p = personFor(owner)
    return p ? profileForPerson(owner, p) : null
  }, [owner, rels, experiences, signals])
}
