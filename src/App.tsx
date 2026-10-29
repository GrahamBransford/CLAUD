import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { BottomNav, Header } from './components/Chrome'
import { LibrarySheet } from './components/LibrarySheet'
import { ProfileSheet } from './components/ProfileSheet'
import { Toasts } from './components/Toasts'
import { TuningSheet } from './components/TuningSheet'
import { Welcome } from './components/Welcome'
import { STATION_ORDER, type StationId } from './config/brand'
import { Drive } from './screens/Drive'
import { FullEpisode } from './screens/FullEpisode'
import { Handhelds } from './screens/Handhelds'
import { Singers } from './screens/Singers'
import { Speakers } from './screens/Speakers'
import { useUI } from './store/useUI'

const fromHash = (): StationId => {
  const h = window.location.hash.replace('#', '') as StationId
  return STATION_ORDER.includes(h) ? h : 'singers'
}

const WELCOMED = 'circa-welcomed'

export default function App() {
  const [station, setStation] = useState<StationId>(fromHash)
  const sheet = useUI((s) => s.sheet)
  const fullEpisode = useUI((s) => s.fullEpisode)
  const drive = useUI((s) => s.drive)
  const unlockAudio = useUI((s) => s.unlockAudio)
  const [welcome, setWelcome] = useState(() => {
    try {
      return sessionStorage.getItem(WELCOMED) !== '1'
    } catch {
      return true
    }
  })

  useEffect(() => {
    const onHash = () => setStation(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Any first interaction counts as permission to play sound.
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [unlockAudio])

  const go = (s: StationId) => {
    if (window.location.hash !== `#${s}`) window.location.hash = s
    setStation(s)
    window.scrollTo({ top: 0 })
  }

  const overlay = !!fullEpisode || drive
  const isActive = (s: StationId) => station === s && !overlay && !welcome

  return (
    <div className={`app app--${station}`} data-overlay={overlay ? '' : undefined}>
      <Header station={station} onChange={go} />
      <main className="stage">
        <div className="station-view" hidden={station !== 'singers'}>
          <Singers active={isActive('singers')} />
        </div>
        <div className="station-view" hidden={station !== 'speakers'}>
          <Speakers active={isActive('speakers')} />
        </div>
        <div className="station-view" hidden={station !== 'handhelds'}>
          <Handhelds active={isActive('handhelds')} />
        </div>
      </main>
      <BottomNav station={station} onChange={go} />

      <AnimatePresence>
        {sheet?.kind === 'library' && <LibrarySheet key="library" />}
        {sheet?.kind === 'profile' && <ProfileSheet key={`p-${sheet.creatorId}`} creatorId={sheet.creatorId} />}
        {sheet?.kind === 'tuning' && <TuningSheet key="tuning" />}
      </AnimatePresence>
      <AnimatePresence>
        {fullEpisode && <FullEpisode key={`${fullEpisode.episodeId}-${fullEpisode.startAt}`} request={fullEpisode} />}
      </AnimatePresence>
      <AnimatePresence>{drive && <Drive key="drive" initial={station === 'speakers' ? 'speakers' : 'singers'} />}</AnimatePresence>
      <AnimatePresence>
        {welcome && (
          <Welcome
            key="welcome"
            onTuneIn={() => {
              unlockAudio()
              try {
                sessionStorage.setItem(WELCOMED, '1')
              } catch {
                /* private mode: the splash simply shows again next visit */
              }
              setWelcome(false)
              go('singers')
            }}
          />
        )}
      </AnimatePresence>
      <Toasts />
    </div>
  )
}
