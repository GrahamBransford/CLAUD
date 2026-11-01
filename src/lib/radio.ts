import { episodes, songs } from '../data'
import type { Episode, Song } from '../types'

/**
 * The Radio's running order: music and talk in one stream, the way a station
 * plays a record, then a conversation, then another record. Songs and podcast
 * highlights are spread evenly through the hour, so neither bunches up.
 */
export type RadioEntry = { kind: 'song'; id: string; creatorId: string; song: Song } | { kind: 'episode'; id: string; creatorId: string; ep: Episode }

let cache: { key: string; list: RadioEntry[] } | null = null

export function radioQueue(): RadioEntry[] {
  const key = `${songs.map((s) => s.id).join()}|${episodes.map((e) => e.id).join()}`
  if (cache?.key === key) return cache.list
  const slots: [number, RadioEntry][] = [
    ...songs.map((song, i): [number, RadioEntry] => [i / Math.max(1, songs.length), { kind: 'song', id: song.id, creatorId: song.creatorId, song }]),
    // talk lands between records, never first thing
    ...episodes.map((ep, j): [number, RadioEntry] => [(j + 0.55) / Math.max(1, episodes.length), { kind: 'episode', id: ep.id, creatorId: ep.creatorId, ep }]),
  ]
  const list = slots.sort((a, b) => a[0] - b[0]).map(([, e]) => e)
  cache = { key, list }
  return list
}

/** Where a song or episode sits in the running order (-1 if it isn't on air). */
export const radioIndexOf = (id: string) => radioQueue().findIndex((e) => e.id === id)
