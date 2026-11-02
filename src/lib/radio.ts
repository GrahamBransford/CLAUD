import { creatorById, episodes, songs } from '../data'
import type { BgItem } from './background'
import { songWindow } from './snippet'
import type { Episode, MediaSource, Song } from '../types'

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

/** A file the background player can play as audio (self-hosted video or audio; never an embed). */
const fileOf = (...ms: (MediaSource | undefined)[]) => {
  for (const m of ms) if (m && (m.kind === 'video' || m.kind === 'audio') && m.src) return m.src
  return undefined
}

/** A song as the background player plays it: the same up-to-three-minute window as the feed. */
export function songAudio(song: Song | undefined): BgItem | undefined {
  const src = song && fileOf(song.audio, song.media)
  if (!song || !src) return undefined
  const w = songWindow(song)
  return { id: song.id, src, start: w.start, end: w.end, title: song.title, artist: creatorById[song.creatorId]?.name ?? '', artwork: song.artwork }
}

/** A podcast highlight as the background player plays it. */
export function episodeAudio(ep: Episode | undefined): BgItem | undefined {
  const src = ep && fileOf(ep.audio, ep.media)
  if (!ep || !src) return undefined
  return { id: ep.id, src, start: ep.highlight.start, end: ep.highlight.end, title: ep.title, artist: creatorById[ep.creatorId]?.name ?? '', artwork: ep.artwork }
}

export const entryAudio = (e: RadioEntry | undefined) => (!e ? undefined : e.kind === 'song' ? songAudio(e.song) : episodeAudio(e.ep))
