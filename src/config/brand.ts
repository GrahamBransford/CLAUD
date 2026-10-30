/**
 * Brand: CIRCA (as in "circa 1940"). Everything user-facing reads from here,
 * including the HTML <title> (injected by vite.config.ts).
 */
export const brand = {
  name: 'CIRCA',
  tagline: 'Radio, re-tuned.',
  promise: 'You discover someone at the edge. You listen, you return, you move closer to the centre.',
  description: 'A new kind of radio for music, conversations and the people who make them.',
  vinyl: { label: 'My Vinyl', kicker: 'Your taste, pressed into a record' },
  stations: {
    artists: { label: 'Artists', frequency: '88.1', kicker: 'Music' },
    podcasts: { label: 'Podcasts', frequency: '94.5', kicker: 'Conversations' },
    'inner-circle': { label: 'Inner Circle', frequency: '101.9', kicker: 'Behind the work' },
  },
} as const

export type StationId = keyof typeof brand.stations
export type RouteId = StationId | 'vinyl'
export const STATION_ORDER: StationId[] = ['artists', 'podcasts', 'inner-circle']
/** The bottom bar, left to right: three ways in, then you. */
export const ROUTES: RouteId[] = [...STATION_ORDER, 'vinyl']
