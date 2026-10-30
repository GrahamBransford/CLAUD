// Adds an official YouTube video to a content file, using YouTube's oEmbed
// data so the title, channel and thumbnail are the real ones.
//   node scripts/content/add-youtube.mjs <youtube-url-or-id> --creator juniper-vale [--as song|moment]
//     [--title "Song title"] [--into public/content/real.json] [--preview 30-105]
// Fails (and adds nothing) if the video is private, removed or not embeddable.
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const ref = args.find((a) => !a.startsWith('--'))
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`)
  return i >= 0 ? args[i + 1] : d
}
const id = ref?.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/)?.[1] ?? ref
if (!id || !/^[\w-]{11}$/.test(id)) {
  console.error('Give a YouTube URL or 11-character video ID.')
  process.exit(1)
}
const r = await fetch(`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${id}`)
if (!r.ok) {
  console.error(r.status === 401 ? 'The owner does not allow this video to be embedded.' : `YouTube said HTTP ${r.status}.`)
  process.exit(1)
}
const o = await r.json()
const creatorId = opt('creator')
if (!creatorId) {
  console.error('--creator <id> is required (the creator must exist in the content file).')
  process.exit(1)
}
const [ps, pe] = opt('preview', '30-105').split('-').map(Number)
const as = opt('as', 'song')
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

const entry =
  as === 'moment'
    ? {
        id: `ic-${slug(o.title)}`,
        creatorId,
        caption: opt('caption', o.title),
        context: opt('context', `Posted on ${o.author_name}`),
        postedHoursAgo: Number(opt('hours', 24)),
        media: { kind: 'youtube', id },
      }
    : {
        id: slug(opt('title', o.title)),
        creatorId,
        title: opt('title', o.title.replace(/\s*[([].*?(official|video|audio|lyric).*?[)\]]/gi, '').replace(/^.*? - /, '').trim()),
        release: opt('release', 'Single'),
        year: Number(opt('year', new Date().getFullYear())),
        blurb: opt('blurb', ''),
        mood: [],
        artwork: o.thumbnail_url,
        media: { kind: 'youtube', id },
        preview: { start: ps, end: pe },
        source: { channel: o.author_name, title: o.title },
      }

const into = opt('into')
if (into) {
  const set = JSON.parse(readFileSync(into, 'utf8'))
  const key = as === 'moment' ? 'innerCircle' : 'songs'
  set[key] = [...set[key].filter((x) => x.id !== entry.id), entry]
  writeFileSync(into, JSON.stringify(set, null, 1))
  console.log(`Added “${o.title}” (${o.author_name}) to ${into}`)
} else console.log(JSON.stringify(entry, null, 2))
