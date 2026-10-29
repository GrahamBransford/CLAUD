import type { Song } from '../types'

/**
 * Seam for future streaming-service integrations (Spotify, Apple Music).
 *
 * The prototype ships only a *simulated* provider: it never contacts an
 * external service. A real implementation would handle OAuth, then call the
 * provider's "save track" and "add to playlist" endpoints in `addToLibrary`.
 */
export type StreamingProviderId = 'spotify' | 'apple-music'

export interface StreamingProvider {
  id: StreamingProviderId
  name: string
  simulated: boolean
  /** Which playlist a saved song would be filed into. */
  playlistFor(song: Song): string
}

const PLAYLISTS: [string[], string][] = [
  [['late night', 'after hours', 'intimate', 'slow'], 'Late Night Rotation'],
  [['acoustic', 'open air', 'morning'], 'Open Windows'],
  [['joyful', 'groove', 'summer'], 'Sunlight Grooves'],
  [['dreamy', 'driving', 'wide'], 'Night Drive'],
  [['ambient', 'calm', 'focus'], 'Slow Mornings'],
]

const playlistFor = (song: Song) =>
  PLAYLISTS.find(([moods]) => song.mood.some((m) => moods.includes(m)))?.[1] ?? 'New Discoveries'

export const PROVIDERS: Record<StreamingProviderId, StreamingProvider> = {
  spotify: { id: 'spotify', name: 'Spotify', simulated: true, playlistFor },
  'apple-music': { id: 'apple-music', name: 'Apple Music', simulated: true, playlistFor },
}
