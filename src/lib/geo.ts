import type { Coords } from '../types'

/**
 * Rough places for the demo. The prototype reads your location from your
 * profile text rather than asking for GPS; a real app would ask, and keep it
 * to a city-level fix.
 */
const PLACES: [string, Coords][] = [
  ['brooklyn', [40.6782, -73.9442]],
  ['queens', [40.7282, -73.7949]],
  ['manhattan', [40.7831, -73.9712]],
  ['new york', [40.7128, -74.006]],
  ['jersey city', [40.7178, -74.0431]],
  ['philadelphia', [39.9526, -75.1652]],
  ['boston', [42.3601, -71.0589]],
  ['toronto', [43.6532, -79.3832]],
  ['chicago', [41.8781, -87.6298]],
  ['nashville', [36.1627, -86.7816]],
  ['los angeles', [34.0522, -118.2437]],
  ['mexico city', [19.4326, -99.1332]],
  ['london', [51.5072, -0.1276]],
  ['paris', [48.8566, 2.3522]],
  ['berlin', [52.52, 13.405]],
  ['stockholm', [59.3293, 18.0686]],
  ['lagos', [6.5244, 3.3792]],
  ['new orleans', [29.9511, -90.0715]],
  ['austin', [30.2672, -97.7431]],
  ['houston', [29.7604, -95.3698]],
  ['pasadena', [34.1478, -118.1445]],
  ['mountain view', [37.3861, -122.0839]],
  ['washington', [38.9072, -77.0369]],
  ['greenbelt', [39.0046, -76.8755]],
  ['kennedy space center', [28.5729, -80.649]],
]

export function coordsFor(location: string | undefined): Coords | undefined {
  const l = location?.toLowerCase() ?? ''
  return PLACES.find(([name]) => l.includes(name))?.[1]
}

/** Great-circle distance in km. */
export function km(a: Coords, b: Coords) {
  const r = (d: number) => (d * Math.PI) / 180
  const dLat = r(b[0] - a[0])
  const dLon = r(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export const distanceLabel = (d: number) => (d < 5 ? 'nearby' : d < 100 ? `${Math.round(d)} km` : `${Math.round(d / 10) * 10} km`)

/**
 * Who you could actually go to a show with: shared taste, weighted toward
 * people near you (half the pull at ~600 km). Taste still leads.
 */
export const nearAndAligned = (score: number, d: number | undefined) => (d === undefined ? score * 0.5 : score * (0.4 + 0.6 * Math.exp(-d / 870)))
