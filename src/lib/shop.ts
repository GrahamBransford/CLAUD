import { creatorById } from '../data'
import { hash01 } from './profile'

/**
 * Every creator's own shows and merch, sold inside CIRCA. In the prototype
 * the dates and products are demo figures, made up per creator (and said so
 * in the app): no real venue has booked these dates, and nothing here is a
 * real product of the creator or, for the NASA shows, of NASA.
 */

export interface Show {
  id: string
  /** Days from today. */
  inDays: number
  city: string
  venue: string
  kind: 'concert' | 'taping'
}

export interface Merch {
  id: string
  name: string
  price: number
  kind: 'tee' | 'lp' | 'poster' | 'tote' | 'cap' | 'mug' | 'pin' | 'stickers'
}

const VENUES: Record<string, string[]> = {
  'Brooklyn, NY': ['Music Hall of Williamsburg', 'Brooklyn Steel', 'Elsewhere'],
  'New York, NY': ['Bowery Ballroom', 'Webster Hall'],
  'Los Angeles, CA': ['The Fonda Theatre', 'The Troubadour', 'Teragram Ballroom'],
  'Nashville, TN': ['Ryman Auditorium', 'The Basement East'],
  'Chicago, IL': ['Metro', 'Thalia Hall'],
  'Toronto, ON': ['History', 'The Danforth Music Hall'],
  'Boston, MA': ['Paradise Rock Club', 'Royale'],
  'New Orleans, LA': ['Tipitina’s', 'Preservation Hall', 'The Joy Theater'],
  'Mexico City, MX': ['Foro Indie Rocks!', 'Teatro Metropólitan'],
  'London, UK': ['Union Chapel', 'O2 Shepherd’s Bush Empire'],
  'Berlin, DE': ['Columbiahalle', 'Lido'],
  'Austin, TX': ['Mohawk', 'Stubb’s'],
  'Paris, FR': ['La Cigale', 'Le Trianon'],
  'Houston, TX': ['White Oak Music Hall', 'House of Blues Houston'],
  'Washington, DC': ['9:30 Club', 'The Anthem'],
  'Seattle, WA': ['The Showbox', 'Neptune Theatre'],
  'Denver, CO': ['Ogden Theatre', 'Bluebird Theater'],
}
const TOUR = ['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Seattle, WA', 'Denver, CO', 'Austin, TX', 'Boston, MA', 'Toronto, ON', 'London, UK', 'Washington, DC']
// podcasts tape live in halls and theatres, not clubs
const TAPING: Record<string, string> = {
  'Houston, TX': 'Wortham Theater Center',
  'Washington, DC': 'Lisner Auditorium',
  'Pasadena, CA': 'Pasadena Civic Auditorium',
  'Mountain View, CA': 'Computer History Museum',
  'Greenbelt, MD': 'Strathmore Music Center',
  'New York, NY': 'The Town Hall',
  'Chicago, IL': 'Harris Theater',
  'Los Angeles, CA': 'The Wiltern',
  'Seattle, WA': 'Benaroya Hall',
  'Denver, CO': 'Paramount Theatre',
}

/** Upcoming dates: a hometown show and a few more on the road. */
export function showsOf(creatorId: string): Show[] {
  const c = creatorById[creatorId]
  if (!c) return []
  const h = (k: string) => hash01(creatorId + k)
  const podcast = c.kind === 'podcast'
  const home = c.location && (podcast ? TAPING[c.location] : VENUES[c.location]) ? c.location : podcast ? 'Houston, TX' : 'New York, NY'
  const others = (podcast ? Object.keys(TAPING) : TOUR).filter((x) => x !== home)
  const n = podcast ? 2 : 3
  const cities = [home, ...others.sort((a, b) => h(a) - h(b)).slice(0, n - 1)]
  let day = 9 + Math.floor(h('d') * 30)
  return cities.map((city, i) => {
    if (i) day += 5 + Math.floor(h(city) * 24)
    const venue = podcast ? TAPING[city] : VENUES[city][Math.floor(h(city + 'v') * VENUES[city].length)]
    return { id: `${creatorId}-show-${i}`, inDays: day, city, venue, kind: podcast ? 'taping' : 'concert' }
  })
}

const ARTIST_MERCH: [Merch['kind'], string, number][] = [
  ['tee', 'Tour tee', 35],
  ['lp', 'Signed vinyl LP', 32],
  ['poster', 'Gig poster', 24],
  ['tote', 'Canvas tote', 22],
  ['cap', 'Dad cap', 28],
]
const PODCAST_MERCH: [Merch['kind'], string, number][] = [
  ['tee', 'Show tee', 30],
  ['mug', 'Studio mug', 18],
  ['pin', 'Enamel pin', 12],
  ['stickers', 'Sticker pack', 8],
  ['tote', 'Canvas tote', 22],
]

/** Four things from the creator's own store. */
export function merchOf(creatorId: string): Merch[] {
  const c = creatorById[creatorId]
  if (!c) return []
  const list = c.kind === 'podcast' ? PODCAST_MERCH : ARTIST_MERCH
  return [...list]
    .sort((a, b) => hash01(creatorId + a[1]) - hash01(creatorId + b[1]))
    .slice(0, 4)
    .map(([kind, name, price]) => ({ id: `${creatorId}-${kind}`, kind, name, price }))
}

/** A date some days from today, as a ticket stub prints it: "Fri" over "Nov 14". */
export function showDate(inDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + inDays)
  return { day: d.toLocaleDateString('en-US', { weekday: 'short' }), date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
}

/** Front Row: up to this many creators, guaranteed presale access for each. */
export const FRONT_ROW_MAX = 5
export const FRONT_ROW_PRICE = 49
