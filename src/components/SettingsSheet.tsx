import { useState } from 'react'
import { activeSet, chooseSet, contentIndex, creatorById, credits } from '../data'
import { PODCAST_DESTINATIONS, podcastDestination, PROVIDERS, type PodcastDestinationId, type StreamingProviderId } from '../lib/streaming'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Sheet } from './Sheet'
import * as I from './Icons'
import { FrontRowCard } from './Shop'

const ABOUT: [string, string][] = [
  ['No AI. Ever.', 'Every song, show and recommendation comes from people, and from what you actually play. Nothing is generated.'],
  ['Creators paid properly', 'One 10-second ad every 10 minutes, and those ads pay the people you listen to, not fractions of a cent per play.'],
  ['Credit where it’s due', 'Every song and show is credited to a person, and found through them.'],
  ['Your taste, your call', 'You choose what’s on your vinyl and what counts in your stats. We don’t sell your listening.'],
  ['Real people, real places', 'Community online and in your city: listening nights, record swaps, shows together.'],
]

/** Drive mode, Front Row, where saves go, the tour, and what CIRCA stands for. Your profile lives on your vinyl. */
export function SettingsSheet() {
  const streaming = useStore((s) => s.streaming)
  const setStreaming = useStore((s) => s.setStreaming)
  const podcastSaves = podcastDestination(useStore((s) => s.podcastSaves)).id
  const setPodcastSaves = useStore((s) => s.setPodcastSaves)
  const [confirm, setConfirm] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const close = () => useUI.getState().openSheet(null)
  const options: StreamingProviderId[] = ['spotify', 'apple-music']
  return (
    <Sheet label="Settings" onClose={close} title="Settings">
      <div className="settings">
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
            <em>Hands-free: big controls, audio only</em>
          </span>
        </button>

        <FrontRowCard />

        <SaveTo
          label="Music saves go to"
          current={streaming ?? 'spotify'}
          options={options.map((id) => ({ id, name: PROVIDERS[id].name }))}
          onChange={(id) => setStreaming(id as StreamingProviderId)}
        />
        <SaveTo
          label="Podcast saves go to"
          current={podcastSaves}
          options={Object.values(PODCAST_DESTINATIONS).map((d) => ({ id: d.id, name: d.name, detail: d.list }))}
          onChange={(id) => setPodcastSaves(id as PodcastDestinationId)}
        />
        <p className="settings__fine">Saves go straight to where the creators live. Demo connections.</p>

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

        <p className="settings__label">About CIRCA</p>
        <div className="about">
          <p className="about__lede">
            CIRCA is built by creators: musicians, podcasters, and the people who love them. We think the people who make what you listen to belong at the center of it: seen, credited, and paid properly.
          </p>
          <ul className="about__values">
            {ABOUT.map(([title, text]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <button className="row-link" onClick={() => setShowCredits(!showCredits)} aria-expanded={showCredits}>
            <span>
              <strong>Credits</strong>
              <em>Footage, music and licences</em>
            </span>
          </button>
          {showCredits && (
            <div className="credits">
              <p className="settings__fine">
                Artist names, bios and captions are invented for the demo, shown on licensed stock footage of real performers; the performers are not the people named. Listener photos are from Unsplash (Unsplash License); the people pictured are not the listeners named.
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
        </div>

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

/** Where a kind of save goes: what it is now, and a Change button that opens the choices. */
function SaveTo({ label, current, options, onChange }: { label: string; current: string; options: { id: string; name: string; detail?: string }[]; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const now = options.find((o) => o.id === current) ?? options[0]
  return (
    <div className={`saveto ${open ? 'is-open' : ''}`}>
      <div className="saveto__row">
        <span className="saveto__text">
          <em>{label}</em>
          <strong>
            {now.name}
            {now.detail ? ` · ${now.detail}` : ''}
          </strong>
        </span>
        <button className="saveto__change" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Done' : 'Change'}
          <I.Down size={14} />
        </button>
      </div>
      {open && (
        <ul className="saveto__menu" role="listbox" aria-label={label}>
          {options.map((o) => (
            <li key={o.id}>
              <button
                role="option"
                aria-selected={o.id === current}
                className={`saveto__option ${o.id === current ? 'is-on' : ''}`}
                onClick={() => {
                  onChange(o.id)
                  setOpen(false)
                }}
              >
                <span>
                  {o.name}
                  {o.detail && <em>{o.detail}</em>}
                </span>
                {o.id === current && <I.Check size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

