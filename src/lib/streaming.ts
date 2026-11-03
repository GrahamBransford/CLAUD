import type { Song } from '../types'

/**
 * Where saves go. CIRCA keeps no library of its own: it is a funnel to the
 * creators, so a saved song goes to your streaming service and a saved
 * episode goes to YouTube, where the long form lives.
 *
 * The prototype only simulates these connections: it never contacts an
 * external service. A real implementation would handle OAuth, then call the
 * provider's "save track" / "add to playlist" endpoints, and YouTube's
 * playlist API for Watch Later.
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

/** Where podcast saves go: the full episode, wherever the listener keeps their shows. */
export type PodcastDestinationId = 'youtube' | 'spotify' | 'apple-podcasts'
export const PODCAST_DESTINATIONS: Record<PodcastDestinationId, { id: PodcastDestinationId; name: string; list: string }> = {
  youtube: { id: 'youtube', name: 'YouTube', list: 'Watch later' },
  spotify: { id: 'spotify', name: 'Spotify', list: 'Your Episodes' },
  'apple-podcasts': { id: 'apple-podcasts', name: 'Apple Podcasts', list: 'Saved episodes' },
}
/** The listener's choice, YouTube unless they've changed it. */
export const podcastDestination = (id: PodcastDestinationId | null | undefined) => PODCAST_DESTINATIONS[id ?? 'youtube'] ?? PODCAST_DESTINATIONS.youtube
