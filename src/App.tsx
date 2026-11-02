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
import { isPinching } from './lib/pinch'
import { MiniPlayer } from './components/MiniPlayer'
import { Tour, tourSeen } from './components/Tour'
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
  // opening the app lands on the Radio; the intro's C clicks into its corner
  return ROUTES.includes(h as RouteId) ? (h as RouteId) : 'radio'
}

export default function App() {
  const [route, setRoute] = useState<RouteId>(fromHash)
  const [splash, setSplash] = useState(true)
  const sheet = useUI((s) => s.sheet)
  const fullEpisode = useUI((s) => s.fullEpisode)
  const drive = useUI((s) => s.drive)
  const person = useUI((s) => s.person)
  const touring = useUI((s) => s.touring)
  const unlockAudio = useUI((s) => s.unlockAudio)

  useEffect(() => {
    const onHash = () => setRoute(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Sound is on from the start wherever the browser allows. Where it doesn't, the first touch of any
  // kind (a tap, a swipe, a scroll, a key) turns it on, inside the touch itself, as phones require.
  useEffect(() => {
    const events = ['pointerdown', 'touchend', 'click', 'keydown', 'wheel'] as const
    const unlock = () => {
      document.querySelectorAll<HTMLMediaElement>('video, audio').forEach((m) => {
        if (m.classList.contains('prefetch') || 'silent' in m.dataset) return
        m.muted = false
      })
      unlockAudio()
      events.forEach((t) => window.removeEventListener(t, unlock, { capture: true }))
    }
    events.forEach((t) => window.addEventListener(t, unlock, { capture: true, passive: true }))
    return () => events.forEach((t) => window.removeEventListener(t, unlock, { capture: true }))
  }, [unlockAudio])

  const go = (r: RouteId) => {
    useUI.getState().openPerson(null)
    if (window.location.hash !== `#${r}`) window.history.replaceState(null, '', `#${r}`)
    setRoute(r)
  }

  // Swipe between pages, like Instagram: the page follows your thumb, with the next one coming in
  // beside it, and settles on release. On the Radio and in Music a sideways swipe is Save or Skip,
  // so there a page swipe starts at the screen's edge (like the iPhone's back gesture). Inner Circle
  // only swipes back to Music, never on to Home. On Home the record turns by hand, so it's left alone.
  const stage = useRef<HTMLElement>(null)
  const nav = useRef({ route, blocked: false })
  useEffect(() => {
    nav.current = { route, blocked: !!fullEpisode || drive || splash || !!person || !!sheet || touring }
  })
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const EDGE = 26
    let g: { x: number; y: number; t: number; id: number; on: boolean; dx: number } | null = null
    const neighbour = (dx: number) => {
      const r = nav.current.route
      const i = ROUTES.indexOf(r)
      const next = ROUTES[i + (dx < 0 ? 1 : -1)]
      if (r === 'inner-circle' && next === 'vinyl') return undefined
      return next
    }
    const paint = (dx: number) => {
      const next = neighbour(dx)
      const w = el.clientWidth
      const d = next ? dx : dx * 0.25 // nothing that way: a little give, then resistance
      el.style.setProperty('--dx', `${d}px`)
      el.querySelectorAll<HTMLElement>('.view').forEach((v) => {
        const id = v.dataset.route
        v.toggleAttribute('data-peek', !!next && id === next)
        if (id === next) v.style.setProperty('--side', dx < 0 ? `${w}px` : `${-w}px`)
      })
    }
    const clear = () => {
      el.removeAttribute('data-drag')
      el.style.removeProperty('--dx')
      el.querySelectorAll<HTMLElement>('.view[data-peek]').forEach((v) => v.removeAttribute('data-peek'))
    }
    const down = (e: PointerEvent) => {
      g = null
      const { route: r, blocked } = nav.current
      if (blocked || e.button > 0 || (e.target as HTMLElement).closest('.catalog, .hifi__record, input, [data-noswipe], .mini')) return
      const edge = e.clientX < EDGE || e.clientX > window.innerWidth - EDGE
      if ((r === 'radio' || r === 'artists') && !edge) return
      if (r === 'radio' || r === 'artists') e.stopPropagation() // the reel doesn't take an edge swipe as Save or Skip
      g = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, on: false, dx: 0 }
    }
    const move = (e: PointerEvent) => {
      if (!g || g.id !== e.pointerId) return
      if (isPinching()) return void (cancel())
      const dx = e.clientX - g.x
      const dy = e.clientY - g.y
      if (!g.on) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) return void (g = null) // a scroll, not a swipe
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return
        g.on = true
        el.setAttribute('data-drag', '')
      }
      g.dx = dx
      paint(dx)
    }
    function cancel() {
      g = null
      clear()
    }
    const up = (e: PointerEvent) => {
      const s = g
      g = null
      if (!s || s.id !== e.pointerId || !s.on) return
      const fast = Math.abs(s.dx) / Math.max(1, e.timeStamp - s.t) > 0.45
      const next = neighbour(s.dx)
      const commit = !!next && (Math.abs(s.dx) > el.clientWidth * 0.33 || (fast && Math.abs(s.dx) > 40))
      // let go: transitions come back on, so the pages glide on from wherever the thumb left them
      clear()
      if (commit && next) {
        tick()
        go(next)
      }
    }
    el.addEventListener('pointerdown', down, { capture: true })
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      el.removeEventListener('pointerdown', down, { capture: true })
      window.removeEventListener('pointermove', move)
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
            data-route={r}
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
      <MiniPlayer />
      {touring && <Tour onDone={() => useUI.getState().setTouring(false)} />}
      {splash && (
        <Splash
          onDone={() => {
            setSplash(false)
            // first time here: a short tour of the real app
            if (!tourSeen()) useUI.getState().setTouring(true)
          }}
        />
      )}
      <Toasts />
    </div>
  )
}
