// Turns a public podcast RSS feed into CIRCA content entries (real titles,
// hosts, artwork, descriptions and playable audio enclosures).
//   node scripts/content/import-podcast.mjs <feed-url> [--episodes 3] [--id my-show] [--into public/content/real.json]
// Without --into, prints the JSON to paste into a content file.
//
// The highlight window can't be chosen automatically yet, so each episode gets
// a placeholder window clearly marked in `highlight.note`. Edit start/end
// (seconds) after listening, or use the feed's chapters where it has them.
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const feed = args.find((a) => !a.startsWith('--'))
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`)
  return i >= 0 ? args[i + 1] : d
}
if (!feed) {
  console.error('Usage: node scripts/content/import-podcast.mjs <feed-url> [--episodes 3] [--id show-id] [--into file.json]')
  process.exit(1)
}

const xml = await (await fetch(feed)).text()
const decode = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
const tag = (src, name) => decode(src.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1])
const attr = (src, name, a) => src.match(new RegExp(`<${name}[^>]*\\s${a}="([^"]+)"`))?.[1]
const seconds = (d = '') => d.split(':').reduce((acc, n) => acc * 60 + Number(n), 0) || undefined
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
const short = (s, n = 280) => (s.length > n ? `${s.slice(0, n).replace(/\s\S*$/, '')}…` : s)

const channel = xml.split('<item')[0]
const title = tag(channel, 'title')
const id = opt('id', slug(title))
const artwork = attr(channel, 'itunes:image', 'href') ?? tag(channel.match(/<image>[\s\S]*?<\/image>/)?.[0] ?? '', 'url')
const author = tag(channel, 'itunes:author')

const creator = {
  id,
  kind: 'podcast',
  name: title,
  avatar: artwork,
  genre: attr(channel, 'itunes:category', 'text') ?? 'Podcast',
  bio: short(tag(channel, 'description') || tag(channel, 'itunes:summary'), 320),
  hosts: author ? author.split(/,| and | & /).map((s) => s.trim()).filter(Boolean) : [],
  palette: ['#1f8a87', '#f2b42c'],
  links: [{ label: 'Podcast feed', url: feed }],
}

const items = xml.split('<item').slice(1, 1 + Number(opt('episodes', 3)))
const episodes = items.map((it) => {
  const t = tag(it, 'title')
  const enclosure = attr(it, 'enclosure', 'url')
  const type = attr(it, 'enclosure', 'type') ?? ''
  const duration = seconds(tag(it, 'itunes:duration'))
  const video = type.startsWith('video/')
  const hs = Math.min(300, Math.max(0, (duration ?? 900) * 0.25))
  return {
    id: `${id}-${slug(t)}`,
    creatorId: id,
    number: Number(tag(it, 'itunes:episode')) || undefined,
    title: t,
    guests: [],
    topic: short(tag(it, 'description') || tag(it, 'itunes:summary')),
    artwork: attr(it, 'itunes:image', 'href') ?? artwork,
    published: tag(it, 'pubDate'),
    media: video ? { kind: 'video', src: enclosure } : { kind: 'audio', src: enclosure },
    audio: video ? undefined : { kind: 'audio', src: enclosure },
    duration,
    highlight: {
      start: Math.round(hs),
      end: Math.round(hs + 300),
      title: 'Highlight',
      note: 'Placeholder window: not yet chosen by an editor.',
    },
  }
})

const into = opt('into')
if (into) {
  const set = JSON.parse(readFileSync(into, 'utf8'))
  set.creators = [...set.creators.filter((c) => c.id !== id), creator]
  set.episodes = [...set.episodes.filter((e) => e.creatorId !== id), ...episodes]
  writeFileSync(into, JSON.stringify(set, null, 1))
  console.log(`Added ${title} (${episodes.length} episodes) to ${into}`)
} else {
  console.log(JSON.stringify({ creators: [creator], episodes }, null, 2))
}
