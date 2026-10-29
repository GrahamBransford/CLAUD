/**
 * Placeholder brand. Everything user-facing reads from here, including the
 * HTML <title> (injected by vite.config.ts), so renaming the product is a
 * one-file change.
 */
export const brand = {
  name: 'Dial',
  tagline: 'Radio, re-tuned.',
  promise: 'Discover more of what you love. Find the people behind it.',
  description:
    'A new kind of radio for music, conversations and the people who make them.',
  stations: {
    singers: { label: 'Singers', frequency: '88.1', kicker: 'Music' },
    speakers: { label: 'Speakers', frequency: '94.5', kicker: 'Conversations' },
    handhelds: { label: 'Handhelds', frequency: '101.9', kicker: 'Behind the work' },
  },
} as const

export type StationId = keyof typeof brand.stations
export const STATION_ORDER: StationId[] = ['singers', 'speakers', 'handhelds']
