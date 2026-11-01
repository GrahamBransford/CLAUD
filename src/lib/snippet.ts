import type { Song } from '../types'

/**
 * Songs on the radio and in Music play up to three minutes: nobody wants
 * longer than that of a song they've never heard unless they choose it.
 * Anything longer offers "Full song", the way podcasts offer the full episode.
 */
export const SNIPPET_MAX = 180

export function songWindow(song: Song, full = false) {
  const start = song.preview.start
  const duration = song.duration ?? song.preview.end
  const capped = Math.min(duration, start + SNIPPET_MAX)
  return { start, end: full ? duration : capped, more: duration > capped + 1 }
}
