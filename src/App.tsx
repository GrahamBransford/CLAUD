import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { tick } from './lib/haptics'
import { TabBar } from './components/Chrome'
import { CommentsSheet } from './components/CommentsSheet'
import { CommunitiesSheet } from './components/Communities'
import { TasteSheet } from './components/TasteSheet'
import { CreatorSheet } from './components/CreatorSheet'
import { FriendsSheet, LiveSheet, ProfileSheet } from './components/IdentitySheets'
import { PersonVinyl } from './components/PersonVinyl'
import { ProfileDetails } from './components/ProfileDetails'
import { Splash } from './components/Logo'
import { SettingsSheet } from './components/SettingsSheet'
import { Toasts } from './components/Toasts'
import { ROUTES, type RouteId } from './config/brand'
import { Artists } from './screens/Artists'
import { Drive } from './screens/Drive'
import { FullEpisode } from './screens/FullEpisode'
import { InnerCircle } from './screens/InnerCircle'
import { MyVinyl } from './screens/MyVinyl'
import { Radio } from './screens/Radio'
import { useUI } from './store/useUI'

const fromHash = (): RouteId => {
  const h = window.location.hash.replace('#', '')
  if (h === 'home') return 'vinyl' // earlier links
  if (h === 'podcasts') return 'radio' // podcasts now play on the Radio
  // opening the app lands on Home, where the intro's C clicks into the tonearm
  return ROUTES.includes(h as RouteId) ? (h as RouteId) : 'vinyl'
}

export default function App() {
  const [route, setRoute] = useState<RouteId>(fromHash)
  const [splash, setSplash] = useState(true)
  const sheet = useUI((s) => s.sheet)
  const fullEpisode = useUI((s) => s.fullEpisode)
  const drive = useUI((s) => s.drive)
  const person = useUI((s) => s.person)
  const unlockAudio = useUI((s) => s.unlockAudio)

  useEffect(() => {
    const onHash = () => setRoute(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // The first touch anywhere turns the sound on.
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true, capture: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock)
    }
  }, [unlockAudio])

  const go = (r: RouteId) => {
    useUI.getState().openPerson(null)
    if (window.location.hash !== `#${r}`) window.history.replaceState(null, '', `#${r}`)
    setRoute(r)
  }

  // Swipe between pages, like Instagram. On the Radio and in Music a sideways swipe is Save or
  // Skip, so there a page swipe starts at the screen's edge (like the iPhone's back gesture).
  // In Inner Circle (which scrolls vertically) and on Home, anywhere works, except on the record,
  // which you turn by hand.
  const stage = useRef<HTMLElement>(null)
  const nav = useRef({ route, blocked: false })
  useEffect(() => {
    nav.current = { route, blocked: !!fullEpisode || drive || splash || !!person || !!sheet }
  })
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const EDGE = 26
    let start: { x: number; y: number; t: number; id: number } | null = null
    const down = (e: PointerEvent) => {
      start = null
      const { route: r, blocked } = nav.current
      if (blocked || (e.target as HTMLElement).closest('.catalog, .hifi__record, input, [data-noswipe]')) return
      const edge = e.clientX < EDGE || e.clientX > window.innerWidth - EDGE
      if ((r === 'radio' || r === 'artists') && !edge) return
      if (r === 'radio' || r === 'artists') e.stopPropagation() // the reel doesn't take an edge swipe as Save or Skip
      start = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId }
    }
    const up = (e: PointerEvent) => {
      const s = start
      start = null
      if (!s || s.id !== e.pointerId) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      const fast = Math.abs(dx) / Math.max(1, e.timeStamp - s.t) > 0.35
      if (Math.abs(dx) < (fast ? 45 : 80) || Math.abs(dx) < Math.abs(dy) * 1.6) return
      const i = ROUTES.indexOf(nav.current.route)
      const next = ROUTES[i + (dx < 0 ? 1 : -1)]
      if (next) {
        tick()
        go(next)
      }
    }
    const cancel = () => (start = null)
    el.addEventListener('pointerdown', down, { capture: true })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      el.removeEventListener('pointerdown', down, { capture: true })
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const overlay = !!fullEpisode || drive || splash || !!person
  const isActive = (r: RouteId) => route === r && !overlay

  return (
    <div className="app" data-route={route}>
      <main className="stage" ref={stage}>
        {ROUTES.map((r) => (
          <div
            key={r}
            className="view"
            data-active={route === r ? '' : undefined}
            // pages slide in from the side they sit on in the bar, like turning to the next page
            data-pos={route === r ? undefined : ROUTES.indexOf(r) < ROUTES.indexOf(route) ? 'before' : 'after'}
            aria-hidden={route !== r}
          >
            {r === 'radio' && <Radio active={isActive('radio')} />}
            {r === 'artists' && <Artists active={isActive('artists')} />}
            {r === 'inner-circle' && <InnerCircle active={isActive('inner-circle')} />}
            {r === 'vinyl' && <MyVinyl active={isActive('vinyl')} />}
          </div>
        ))}
      </main>
      <TabBar route={route} onChange={go} />

      <AnimatePresence>{person && <PersonVinyl key={person} id={person} />}</AnimatePresence>
      <AnimatePresence>
        {sheet?.kind === 'creator' && <CreatorSheet key={`c-${sheet.creatorId}-${sheet.owner ?? 'me'}`} creatorId={sheet.creatorId} owner={sheet.owner ?? 'me'} />}
        {sheet?.kind === 'taste' && <TasteSheet key="taste" />}
        {sheet?.kind === 'communities' && <CommunitiesSheet key={`cm-${sheet.creatorId ?? 'all'}`} creatorId={sheet.creatorId} />}
        {sheet?.kind === 'details' && <ProfileDetails key={`d-${sheet.owner}-${sheet.tab}`} owner={sheet.owner} tab={sheet.tab} />}
        {sheet?.kind === 'settings' && <SettingsSheet key="settings" />}
        {sheet?.kind === 'profile' && <ProfileSheet key="profile" />}
        {sheet?.kind === 'live' && <LiveSheet key="live" />}
        {sheet?.kind === 'friends' && <FriendsSheet key="friends" />}
        {sheet?.kind === 'comments' && <CommentsSheet key={`cm-${sheet.postId}`} postId={sheet.postId} />}
      </AnimatePresence>
      <AnimatePresence>
        {fullEpisode && <FullEpisode key={`${fullEpisode.episodeId}-${fullEpisode.startAt}`} request={fullEpisode} />}
      </AnimatePresence>
      <AnimatePresence>{drive && <Drive key="drive" initial={route === 'artists' ? 'artists' : 'radio'} />}</AnimatePresence>
      {splash && <Splash onDone={() => setSplash(false)} />}
      <Toasts />
    </div>
  )
}
