import type { Song } from '../types'

/**
 * Songs on the radio and in Music play up to three minutes: nobody wants
 * longer than that of a song they've never heard unless they choose it.
 * Anything longer offers "Full song", the way podcasts offer the full episode.
 */
export const SNIPPET_MAX = 180

/** `known` is the player's own duration, for songs whose content entry doesn't give one. */
export function songWindow(song: Song, full = false, known = 0) {
  const start = song.preview.start
  const duration = song.duration ?? (known > 0 ? known : song.preview.end)
  const capped = Math.min(duration, start + SNIPPET_MAX)
  return { start, end: full ? duration : capped, more: duration > capped + 1 }
}
