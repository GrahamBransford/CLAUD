// Checks every media reference in a CIRCA content file is real and playable.
//   node scripts/content/verify.mjs public/content/real.json
// YouTube: oEmbed answers 200 only for public, embeddable videos (401 = embedding disabled).
// Spotify: oEmbed confirms the URI exists. Files and feeds: a HEAD/GET must succeed.
import { readFileSync } from 'node:fs'

const file = process.argv[2] ?? 'public/content/demo.json'
const set = JSON.parse(readFileSync(file, 'utf8'))
const base = new URL(`file://${process.cwd()}/public/`)

const checks = []
const add = (where, media) => media && checks.push({ where, media })
for (const s of set.songs ?? []) {
  add(`song ${s.id}`, s.media)
  add(`song ${s.id} (audio)`, s.audio)
}
for (const e of set.episodes ?? []) {
  add(`episode ${e.id}`, e.media)
  add(`episode ${e.id} (audio)`, e.audio)
}
for (const p of set.innerCircle ?? []) add(`inner circle ${p.id}`, p.media)
for (const c of set.creators ?? []) add(`avatar ${c.id}`, { kind: 'image', src: c.avatar })

async function check({ media }) {
  if (media.kind === 'youtube') {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${media.id}`)
    if (!r.ok) return { ok: false, info: r.status === 401 ? 'embedding disabled by owner' : `HTTP ${r.status}` }
    const j = await r.json()
    return { ok: true, info: `${j.title} — ${j.author_name}` }
  }
  if (media.kind === 'spotify') {
    const url = `https://open.spotify.com/${media.uri.split(':').slice(1).join('/')}`
    const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
    if (!r.ok) return { ok: false, info: `HTTP ${r.status}` }
    const j = await r.json()
    return { ok: true, info: j.title }
  }
  const src = media.src
  if (!/^https?:/.test(src)) {
    try {
      readFileSync(new URL(src, base))
      return { ok: true, info: 'local file' }
    } catch {
      return { ok: false, info: 'missing local file' }
    }
  }
  const r = await fetch(src, { method: 'HEAD', redirect: 'follow' }).catch((e) => ({ ok: false, status: e.message }))
  return { ok: r.ok, info: r.ok ? `${r.headers.get('content-type') ?? ''}` : `HTTP ${r.status}` }
}

let bad = 0
for (const c of checks) {
  const res = await check(c).catch((e) => ({ ok: false, info: e.message }))
  if (!res.ok) bad++
  console.log(`${res.ok ? 'ok  ' : 'FAIL'}  ${c.where.padEnd(42)} ${c.media.kind.padEnd(8)} ${res.info}`)
}
console.log(`\n${checks.length - bad}/${checks.length} playable${bad ? ` — fix the ${bad} marked FAIL` : ''}`)
process.exit(bad ? 1 : 0)
