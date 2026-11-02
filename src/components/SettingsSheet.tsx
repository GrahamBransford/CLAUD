import { useState } from 'react'
import { activeSet, chooseSet, contentIndex, creatorById, credits } from '../data'
import { PODCAST_DESTINATION, PROVIDERS, type StreamingProviderId } from '../lib/streaming'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Sheet } from './Sheet'
import * as I from './Icons'

/** Your account, then where saves go, which content set is loaded, and a clean slate. */
export function SettingsSheet() {
  const streaming = useStore((s) => s.streaming)
  const setStreaming = useStore((s) => s.setStreaming)
  const profile = useStore((s) => s.profile)
  const visibility = useStore((s) => s.vinylVisibility)
  const setVisibility = useStore((s) => s.setVinylVisibility)
  const [confirm, setConfirm] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const close = () => useUI.getState().openSheet(null)
  const options: StreamingProviderId[] = ['spotify', 'apple-music']
  return (
    <Sheet label="Settings" onClose={close} title="Settings">
      <div className="settings">
        <p className="settings__label">Account</p>
        <div className="account">
          <span className="minidisc">
            <img src={profile.avatar} alt="" />
          </span>
          <span className="hit__text">
            <strong>{profile.name || 'You'}</strong>
            <em>@{profile.username} · demo account</em>
          </span>
          <button className="pill pill--quiet" onClick={() => useUI.getState().openSheet({ kind: 'profile' })}>
            Edit profile
          </button>
        </div>
        <button
          className="row-link"
          onClick={() => {
            close()
            useUI.getState().setDrive(true)
          }}
        >
          <I.Car size={18} />
          <span>
            <strong>Drive mode</strong>
            <em>Hands-free: big controls, audio only, for the car</em>
          </span>
        </button>

        <button
          className="row-link"
          onClick={() => {
            close()
            window.location.hash = 'radio'
            useUI.getState().setTouring(true)
          }}
        >
          <I.Spark size={18} />
          <span>
            <strong>Take the tour</strong>
            <em>A quick look at where everything is</em>
          </span>
        </button>

        <p className="settings__label">Who can see your vinyl</p>
        <div className="choices">
          {(
            [
              ['everyone', 'Everyone on CIRCA'],
              ['friends', 'Friends only'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={`choice ${visibility === id ? 'is-on' : ''}`} onClick={() => setVisibility(id)}>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <p className="settings__fine">Demo account on this device. Nothing is sent anywhere.</p>

        <p className="settings__label">Music saves go to</p>
        <div className="choices">
          {options.map((id) => (
            <button key={id} className={`choice ${(streaming ?? 'spotify') === id ? 'is-on' : ''}`} onClick={() => setStreaming(id)}>
              <span>{PROVIDERS[id].name}</span>
              <em>demo</em>
            </button>
          ))}
        </div>
        <p className="settings__label">Podcast saves go to</p>
        <div className="choices">
          <div className="choice is-on">
            <span>
              {PODCAST_DESTINATION.name} · {PODCAST_DESTINATION.list}
            </span>
            <em>demo</em>
          </div>
        </div>
        <p className="settings__fine">Saves go straight to where the creators live. Demo connections.</p>

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

        <button className="row-link" onClick={() => setShowCredits(!showCredits)} aria-expanded={showCredits}>
          <span>
            <strong>Credits</strong>
            <em>Footage, music and licences</em>
          </span>
        </button>
        {showCredits && (
          <div className="credits">
            <p className="settings__fine">
              Artist names, bios and captions are invented for the demo, shown on licensed stock footage of real performers; the performers are not the people named.
              Podcasts are real NASA shows, excerpted; NASA does not endorse CIRCA.
            </p>
            <ul className="credits__list">
              {credits.map((c) => (
                <li key={c.id}>
                  <strong>
                    {creatorById[c.creatorId]?.name} · {c.title}
                  </strong>
                  {c.footage && (
                    <em>
                      Video: <a href={c.footage.url} target="_blank" rel="noopener noreferrer">{c.footage.source}</a> · {c.footage.license}
                    </em>
                  )}
                  {c.music && (
                    <em>
                      Music: “{c.music.title}” by {c.music.artist} · <a href={c.music.url} target="_blank" rel="noopener noreferrer">{c.music.source}</a> · {c.music.license}
                    </em>
                  )}
                </li>
              ))}
            </ul>
          </div>
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
