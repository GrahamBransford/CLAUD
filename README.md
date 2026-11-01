# CIRCA — creative discovery prototype

A new kind of radio. Discover music and conversations, and watch your relationship with the people behind them grow, from the outer edge of your record to the centre.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also prints a Network address for phones on the same Wi-Fi)
npm run build      # static site in dist/ — host anywhere (Netlify, any web server)
```

## What's in it

The app opens with a short brand animation (the two Cs of CIRCA are records), then CIRCA folds into a single C that flies to the tonearm's pivot on Home and settles into place (the app opens on Home; opened from a link to another page, the C lands in the Home record in the bar instead). Pages slide in from the side they sit on in the bar; every button answers a press (and a light haptic tick where the phone allows: Android's Vibration API, or the system switch tick on iPhone). The bottom bar has four destinations, each shown as a small record with its name underneath (Radio, Music, Inner Circle, Home): three full-screen ways in, then you. A little tonearm glides along the bar to whichever one you choose and sets down on it, and only that record spins.

| Destination | What it does |
| --- | --- |
| **Radio** | Everything at once, like a wireless on the sideboard: music and podcast highlights in one running order, spread evenly so neither bunches up. The credit is identical for both (same size, same place); a small brass note or microphone beside the name says which it is. Swipe right to **SAVE**, left to **SKIP**, up/down for next/previous; tap to pause. A song heard all the way through saves itself; a podcast highlight (with live captions) has **Full episode**, and finishing the highlight hands off to the full episode. The demo catalogue has songs and podcast highlights; audio-only items play on the Radio as a spinning record. |
| **Music** | Just the music: full-screen video with the artist and title over it, the same gestures. Songs play up to **three minutes**; anything longer offers **Full song**, the way podcasts offer the full episode. (The demo songs are all under three minutes, so they play whole.) |
| **Inner Circle** | A full-screen, sideways feed of behind-the-scenes moments from **creators you follow**, closest first. It scrolls like a feed: swipe up for the next moment, down to go back. Double-tap a moment to love it, as on Instagram: the screen's edges pulse in the love button's bronze and a heart blooms where you tapped. Friends never appear here. |
| **My Vinyl** | Your identity on CIRCA: a radiogram, the deck seen from straight above on the top half, its front with your nameplate and knobs on the bottom half (side by side on desktop). |

### Standing out

- **Creators** show their follower count, and follow other creators only: their vinyl shows who they follow, as a row of faces.
- **Listeners earn awards**, shown as small medallions on their vinyl (tap one for the story): **Event superhost** (runs gatherings for a community, linked to it), an **industry role** (self-reported), **Tastemaker**, **Founding listener**, and **Top 1% of listeners this year**, which also puts a gold ring round their record.
- **Taste twin.** Your vinyl shows the creator whose own listening is closest to yours ("Teodora Blue · 87% match"); tap for the full ranking, and open any of their vinyls. With real profiles this becomes artists and well-known names.

### Communities

Finding your people is the point. Every creator can have communities: ones they curate themselves, and ones their fans run, online, in person, or both, each with how often it meets and its next gathering.

- **On a creator's vinyl** and their profile sheet: their communities, and the **local scenes in their style** near you.
- **Communities for you** (from search, or the Communities window on your vinyl): matched across everything, with the reasons shown ("You're in the top 1% of Juniper Vale's listeners", "Soul & R&B is 62% of your music", "Meets 12 km from you", "Maya is a member"). Tabs for near you and online.
- **Join** and **I'll be there** are demo actions: nothing is sent. Groups, members and gatherings are fictional demo data (`content/demo/people.json` → `communities`); "near you" uses your profile location, not GPS.

### Where this is going (not built in the prototype)

- An AI that matches people to the creator communities that fit them best, online and in real life, including local communities around a genre or an artist you've just found.
- Free to listen, because it's a radio: sponsored songs, podcasts and a single, conscious ad every 15 to 30 minutes, never enough to bend anyone's own tailoring.
- A premium home for the music that matters to you, alongside the playlists people keep elsewhere: favourite artists, the songs you keep because they mean something.
- Human creativity first: AI for the engineering, never in place of the art.
- Hands-free discovery: abbreviated music and conversations you can take in while driving, through a legal car mode (Drive), where scrolling a video feed isn't possible.

### Look and feel

Every colour comes from a vintage cabinet radio and gramophone, held back so it reads as material rather than decoration: deep bottle green with a fine grain is the ground on nearly every page, antique brass and a little rose gold are the hardware (machined knobs, hairline rules, the tonearm, the C), ivory is the type. Fine lines instead of thick outlines, no glossy highlights. Tokens live in `src/styles/tokens.css`.

### My Vinyl: the record is the profile

- **Everything behind the readouts.** Every window on the front opens one sheet with five tabs, the same for every account (yours, a friend's, a creator's): **Listening** (minutes this week, month, year and all time, the last eight weeks, music vs talk, how much is heard all the way through, when they listen most), **Artists** (top ten; when one style carries a big share of their music, a toggle shows their top three in it), **Podcasts** (top five, with episodes finished), **Genres** (share of the music and how it's listened to, kept separate from the artist list) and **Live** (shows, artists, venues and a year-by-year timeline). Periods, time-of-day habits and "following since" are estimates, labelled as such.
- **Tap a face, see the relationship.** The creator sheet shows the stats of whoever's vinyl you tapped it on: minutes, songs heard in full or episodes finished, most played, following since, shows, recent activity, percentile and relationship level. On your record that's you; on a friend's, it's them (with your own standing underneath).
- **Creators' records are special editions,** pressed on cream: artists get a green label and brass hardware ("Special edition"); podcasters get a bronze label, rose-gold hardware and fewer, wider grooves, like a spoken-word pressing.
- **Updates.** The Friends knob opens on **Updates**: friend requests and what changed on the vinyls of friends you follow, newest first, with a small lamp on the knob (and on the My Vinyl tab) when something's new.
- **The C** sits on the tonearm's pivot and opens your account and settings; the feeds keep their corners clear.
- **Twelve faces on the record,** the closest; everyone else is in the lists.

- **The record.** Your photo is the centre label. Every creator you listen to sits in the grooves: the closer to the label, the stronger the relationship; new discoveries sit at the edge. Creators you've seen live wear a ticket pip, favourites a spark. Shows you've been to are etched into the run-out groove. Tap a face for that creator's profile.
- **Your record, every day.** Under your name, backlit readouts in the spirit of an annual Wrapped, except updated daily: minutes on record (a tape counter), top artist, top podcast, your sound (leading genre and its share), shows seen live, and your newest find. All from what CIRCA knows; in the demo that includes a simulated history, and it says so.
- **Turn it by hand.** Touch and drag the record and it turns under your finger; flick it and it carries the spin, then eases back to 33⅓. A tap on a face still opens that creator.
- **The deck.** Seen from straight above and full-bleed: the record on a brass platter, the tonearm, and the search knob in the top-left corner, level with the arm's pivot (the C on every feed sits in exactly the same spot). A fine brass seam folds the deck into the front below.
- **The front.** Your name, with @username, location and Instagram (a brass Instagram mark and your handle) under a brass rule, sits between two machined knobs with their symbols engraved in the face: **Friends** on the left (a small pilot lamp shows new requests) and **Live** on the right. Below are your bio and the readouts in brass-edged windows. Edit profile and settings open from the C in the top bar (the CIRCA logo on the desktop rail).
- **Live** lists the concerts, festivals and events you've added; they're self-reported, labelled as such, and a show with someone on CIRCA also counts toward closeness.
- **Search** is the knob on the record player's lid; tapping it opens the full search page, with two drawers: **Creators** (shown as medallions) and **People** (shown as small records with their face on the label, plus your shared-taste %).
- **People near you.** With nothing typed, search suggests people you could actually go to a show with: closest taste first, weighted toward people near your profile location (from your profile text, not GPS; demo coordinates), each with their distance.
- **Creators have vinyls too.** A creator's profile has **Their vinyl**: the artists and podcasts they listen to, and shows they've been to, on the same turntable, with Listen and Follow.
- **Other people's vinyl.** Open anyone's record to see what they love. Creators you share are ringed in rose gold; a VU meter shows how musically aligned you are (cosine similarity of your listening, plus shared live shows, from local data: an estimate, marked demo), with "You both love…" and "You both saw … live". Mutual friends are shown.
- **Friends** are people, not creators. Add friend, accept or decline requests, remove friends, and follow a friend's vinyl updates (**Friends** key). Requests you send to the sample listeners are accepted after a moment, and the toast says it's simulated. There is **no messaging**: people connect through the socials on their vinyl.
- **Top listeners.** Every creator profile has **See top listeners** (demo), so fans can find each other and open each other's vinyl.

The eight other listeners (`content/demo/people.json`) and their portraits are fictional demo data.

**Saves** never stay in CIRCA: it's a funnel to the creators. Songs go to the streaming service chosen in settings (Spotify or Apple Music), and podcast episodes go to YouTube (Watch later), where the long form lives. All of these are demo connections that send nothing, and the toast says so. Swiping is the only visible save/skip control; screen readers get hidden buttons and keyboards the arrow keys.

**Drive** (car button) is audio-only with two stations, Radio (the same mixed running order) and Music, big controls and no moving video. Auto-save and the highlight→episode hand-off keep working.

Sound starts muted, as browsers require, and turns on with the first touch. Icons are CIRCA's own (`src/components/Icons.tsx`), drawn from tape-deck and radio markings: a REC roundel for Save, ⏭ for Skip, the same in every section.

### How closeness works

Points per creator come from meaningful signals (`src/lib/affinity.ts`):
minutes listened (1/min), full listens (8), coming back to something (5), saves (12), following (20), **shows attended (90)**, Inner Circle moments watched (3), reactions (1). Points become an **estimated** percentile against a modelled audience for that creator, which sets the tier and the position on your vinyl. Everything you do in the app moves creators; the demo also starts from a simulated listening history. **Percentiles are estimates, not verified rankings,** and the UI says so.

To demo the top tier: open My Vinyl, tap Juniper Vale → **Went to a show**. She crosses into the Top 1% and the reward card unlocks.

## Content: real media without rebuilding

Content is loaded at runtime from `public/content/` (or `dist/content/` after a build), so you can add or replace artists, videos, episodes and Inner Circle moments by editing JSON and reloading.

- `public/content/index.json` lists the content sets and which one is the default. Settings (the knob on My Vinyl) switches between sets; `?content=<id>` in the URL does too.
- `public/content/demo.json` is the original, fully offline demo set (fictional creators, generated media).
- Some creators are **catalogue-only** (`catalogOnly: true`): heard through a connected service, shown in listening histories and search, but with nothing playable in the feeds yet. Their avatars come from `scripts/media/catalog_avatars.py`; `style` groups genres into families and `works` lists their titles.
- `public/content/real.json` is the starter for real artists and podcasts. Add it to `index.json` once it has items.

Every item names its creator, metadata and a **media source**:

```json
{ "kind": "youtube", "id": "VIDEO_ID" }            // official YouTube video, via the YouTube IFrame Player API
{ "kind": "spotify", "uri": "spotify:track:ID" }    // Spotify embed (iFrame API)
{ "kind": "audio",   "src": "https://…/episode.mp3" } // e.g. a podcast RSS enclosure
{ "kind": "video",   "src": "media/clip.mp4" }       // a self-hosted file
{ "kind": "image",   "src": "media/photo.jpg" }
```

Songs: `media` (the video), optional `audio` (Spotify or a file, used in Drive), `preview: {start, end}`.
Episodes: `media` (the full episode), optional `audio`, `highlight: {start, end, title}` inside it, optional `audioHighlight` when the audio's timing differs.

### Helpers

```bash
# Add an official YouTube music video (checked via YouTube oEmbed; refuses private or non-embeddable videos)
npm run content:youtube -- "https://www.youtube.com/watch?v=…" --creator some-artist --into public/content/real.json --preview 30-105
# … or an Inner Circle moment (e.g. an official YouTube Short)
npm run content:youtube -- "https://youtube.com/shorts/…" --creator some-artist --as moment --into public/content/real.json

# Import real episodes (titles, hosts, artwork, descriptions, audio) from a public podcast RSS feed
npm run content:podcast -- https://feeds.example.com/show.xml --episodes 3 --into public/content/real.json

# Check every item in a set actually plays (YouTube embeddable? Spotify ID real? files reachable?)
npm run content:verify -- public/content/real.json
```

Creators need an entry in `creators` (an artist's id, name, avatar URL, genre, bio). Imported podcast highlights get a placeholder window marked in `highlight.note`; set `start`/`end` after listening.

### Platform rules this prototype follows

- **YouTube**: played only through the official player, fully visible, with nothing layered over it. Previews use the player's own start/end and seek controls. No audio extraction, no hidden-player playback. YouTube items are therefore left out of Drive unless they also have a Spotify or audio source.
- **Spotify**: the official embed stays visible. Listeners not signed in to Spotify in that browser get 30-second previews; signed-in listeners get full tracks. The app reads the real duration and never claims otherwise.
- **Podcasts**: RSS enclosures are the files publishers distribute for playback in apps.
- **Where real media plays**: run locally or on a normal host. The private claude.ai artifact link blocks third-party embeds and media, so it can only run the offline demo set.

## Project structure

```
src/
  config/brand.ts         name, tagline, destination names
  data/index.ts           runtime content loader
  lib/players.ts          YouTube + Spotify adapters with one player interface
  lib/affinity.ts         points, simulated percentiles, tiers
  lib/social.ts           shared-taste alignment, people's vinyls, top listeners, search
  hooks/                  preview windows + honest listen tracking, relationships, social, keys, media session
  components/             Turntable, PersonVinyl, Catalog (search), Icons, Logo + splash, Reel (swipe),
                          MediaSurface, dial, tab bar, sheets, tier/reward
  screens/                Radio, Artists (Music), InnerCircle, MyVinyl, FullEpisode, Drive
  styles/                 tokens.css (palette, type, motion), app.css
scripts/content/          add-youtube, import-podcast, verify, build-demo
scripts/media/            generators for the original demo media (people.py: listener portraits)
content/demo/             generator sources for the demo set
public/content/           content sets loaded at runtime
```
