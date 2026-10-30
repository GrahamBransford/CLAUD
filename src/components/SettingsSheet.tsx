import { useState } from 'react'
import { activeSet, chooseSet, contentIndex } from '../data'
import { PROVIDERS, type StreamingProviderId } from '../lib/streaming'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Sheet } from './Sheet'

/** Where saved music goes, which content set is loaded, and a clean slate. */
export function SettingsSheet() {
  const streaming = useStore((s) => s.streaming)
  const setStreaming = useStore((s) => s.setStreaming)
  const [confirm, setConfirm] = useState(false)
  const close = () => useUI.getState().openSheet(null)
  const options: (StreamingProviderId | null)[] = ['spotify', 'apple-music', null]
  return (
    <Sheet label="Settings" onClose={close}>
      <div className="settings">
        <p className="settings__label">Saves go to</p>
        <div className="choices">
          {options.map((id) => (
            <button key={id ?? 'none'} className={`choice ${streaming === id ? 'is-on' : ''}`} onClick={() => setStreaming(id)}>
              <span>{id ? PROVIDERS[id].name : 'Keep in CIRCA'}</span>
              {id && <em>demo</em>}
            </button>
          ))}
        </div>
        <p className="settings__fine">Streaming connections here are demonstrations. Nothing is sent to Spotify or Apple Music.</p>

        {contentIndex.sets.length > 1 && (
          <>
            <p className="settings__label">Content</p>
            <div className="choices">
              {contentIndex.sets.map((s) => (
                <button key={s.id} className={`choice ${s.id === activeSet ? 'is-on' : ''}`} onClick={() => s.id !== activeSet && chooseSet(s.id)}>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {confirm ? (
          <div className="settings__confirm">
            <button className="pill pill--cherry" onClick={() => { useStore.getState().resetDemo(); setConfirm(false); close() }}>Reset everything</button>
            <button className="pill pill--quiet" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        ) : (
          <button className="settings__reset" onClick={() => setConfirm(true)}>Reset demo</button>
        )}
      </div>
    </Sheet>
  )
}
