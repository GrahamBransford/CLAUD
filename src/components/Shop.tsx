import { useMemo } from 'react'
import { creatorById, creators } from '../data'
import { FRONT_ROW_MAX, FRONT_ROW_PRICE, merchOf, showDate, showsOf, type Merch } from '../lib/shop'
import { fmtCount, reachOf } from '../lib/creators'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import * as I from './Icons'
import { Sheet } from './Sheet'

const toast = (title: string, detail?: string) => useUI.getState().pushToast({ title, detail, ms: 3600 })
const demoNote = (creatorId: string) =>
  creatorById[creatorId]?.kind === 'podcast' ? 'Demo dates and products: not real events or merchandise of the show, or of NASA.' : 'Demo dates and products, made up for the prototype.'

/** The creator's upcoming shows (live tapings, for a podcast), with presale status. */
export function CreatorShows({ creatorId }: { creatorId: string }) {
  const c = creatorById[creatorId]
  const shows = useMemo(() => showsOf(creatorId), [creatorId])
  const front = useStore((s) => s.frontRow)
  if (!c || !shows.length) return null
  const yours = front.member && front.picks.includes(creatorId)
  return (
    <section className="shop" aria-label={c.kind === 'podcast' ? 'Live tapings' : 'Shows'}>
      <p className="readouts__head">
        <span>{c.kind === 'podcast' ? 'Live tapings' : 'On tour'}</span>
        <span>{yours ? 'Front Row · presale guaranteed' : `${shows.length} dates`}</span>
      </p>
      <ul className="shows">
        {shows.map((s) => (
          <li key={s.id} className="show">
            <span className="show__date">
              <b>{showDate(s.inDays).day}</b>
              {showDate(s.inDays).date}
            </span>
            <span className="show__where">
              <strong>{s.city}</strong>
              <em>{s.venue}</em>
            </span>
            <button
              className={`show__btn ${yours ? 'is-presale' : ''}`}
              onClick={() =>
                yours
                  ? toast('Your presale is held', `${c.name} · ${s.city} · Front Row · demo`)
                  : toast('Tickets', `${c.name} · ${s.venue} · demo checkout`)
              }
            >
              {yours ? 'Presale' : 'Tickets'}
            </button>
          </li>
        ))}
      </ul>
      {!yours && (
        <button className="shop__frontrow" onClick={() => useUI.getState().openSheet({ kind: 'frontrow' })}>
          <I.Ticket size={15} /> Never miss a presale: add {c.name} to Front Row
        </button>
      )}
    </section>
  )
}

/** The creator's own merch, sold right here; every sale goes to them. */
export function CreatorMerch({ creatorId }: { creatorId: string }) {
  const c = creatorById[creatorId]
  const items = useMemo(() => merchOf(creatorId), [creatorId])
  if (!c || !items.length) return null
  return (
    <section className="shop" aria-label="Merch">
      <p className="readouts__head">
        <span>Merch</span>
        <span>Straight from {c.kind === 'podcast' ? 'the show' : c.name}</span>
      </p>
      <div className="merch">
        {items.map((m) => (
          <button key={m.id} className="merch__item" onClick={() => toast(`${m.name} · $${m.price}`, `${c.name} · demo checkout`)}>
            <MerchArt kind={m.kind} creatorId={creatorId} />
            <strong>{m.name}</strong>
            <em>${m.price}</em>
          </button>
        ))}
      </div>
      <p className="shop__note">{demoNote(creatorId)}</p>
    </section>
  )
}

/** A product shot drawn in the creator's own colours. */
function MerchArt({ kind, creatorId }: { kind: Merch['kind']; creatorId: string }) {
  const c = creatorById[creatorId]
  const [a, b] = [c?.palette?.[0] ?? '#2c4a3a', c?.palette?.[1] ?? c?.palette?.[0] ?? '#1a2e24']
  const id = `m-${creatorId}-${kind}`
  const ink = '#f4ead6'
  const initials = (c?.name ?? '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <svg className="merch__art" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
        <clipPath id={`${id}-sq`}>
          <rect x="22" y="22" width="44" height="44" rx="1" />
        </clipPath>
        <clipPath id={`${id}-po`}>
          <rect x="30" y="22" width="40" height="34" />
        </clipPath>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-bg)`} />
      <rect width="100" height="100" fill="#000" opacity="0.18" />
      {kind === 'tee' && (
        <>
          <path d="M30 24 L42 18 Q50 25 58 18 L70 24 L82 38 L71 45 L71 84 L29 84 L29 45 L18 38 Z" fill={ink} />
          <text x="50" y="58" textAnchor="middle" fontSize="11" fontWeight="800" fill={a} fontFamily="Archivo Variable, sans-serif">{initials}</text>
        </>
      )}
      {kind === 'lp' && (
        <>
          <circle cx="62" cy="44" r="24" fill="#111" />
          <circle cx="62" cy="44" r="7" fill={ink} />
          <rect x="22" y="22" width="44" height="44" fill={ink} />
          {c?.avatar && <image href={c.avatar} x="22" y="22" width="44" height="44" clipPath={`url(#${id}-sq)`} preserveAspectRatio="xMidYMid slice" />}
          <path d="M60 60 l8 -8" stroke={ink} strokeWidth="1.5" opacity="0.8" />
          <text x="44" y="80" textAnchor="middle" fontSize="6.5" fill={ink} fontFamily="Archivo Variable, sans-serif" letterSpacing="1">SIGNED</text>
        </>
      )}
      {kind === 'poster' && (
        <>
          <rect x="26" y="16" width="48" height="68" fill={ink} />
          {c?.avatar && <image href={c.avatar} x="30" y="22" width="40" height="34" clipPath={`url(#${id}-po)`} preserveAspectRatio="xMidYMid slice" />}
          <rect x="30" y="61" width="40" height="5" fill={a} />
          <rect x="34" y="70" width="32" height="3" fill={b} opacity="0.7" />
          <rect x="38" y="76" width="24" height="3" fill={b} opacity="0.5" />
        </>
      )}
      {kind === 'tote' && (
        <>
          <path d="M38 34 Q38 18 50 18 Q62 18 62 34" fill="none" stroke={ink} strokeWidth="3" />
          <path d="M26 34 L74 34 L70 84 L30 84 Z" fill={ink} />
          <text x="50" y="64" textAnchor="middle" fontSize="11" fontWeight="800" fill={a} fontFamily="Archivo Variable, sans-serif">{initials}</text>
        </>
      )}
      {kind === 'cap' && (
        <>
          <path d="M24 60 Q24 30 50 30 Q76 30 76 60 Z" fill={ink} />
          <path d="M60 60 Q84 60 88 68 L56 68 Z" fill={ink} opacity="0.85" />
          <circle cx="50" cy="31" r="2.5" fill={a} />
          <text x="48" y="53" textAnchor="middle" fontSize="10" fontWeight="800" fill={a} fontFamily="Archivo Variable, sans-serif">{initials}</text>
        </>
      )}
      {kind === 'mug' && (
        <>
          <path d="M68 40 Q82 40 82 52 Q82 64 68 64" fill="none" stroke={ink} strokeWidth="5" />
          <rect x="26" y="30" width="44" height="50" rx="5" fill={ink} />
          <text x="48" y="60" textAnchor="middle" fontSize="11" fontWeight="800" fill={a} fontFamily="Archivo Variable, sans-serif">{initials}</text>
        </>
      )}
      {kind === 'pin' && (
        <>
          <circle cx="50" cy="50" r="26" fill={ink} />
          <circle cx="50" cy="50" r="21" fill={a} />
          <path d="M50 36 l3.6 9 9.4 0.6 -7.3 6 2.4 9.2 -8.1 -5.2 -8.1 5.2 2.4 -9.2 -7.3 -6 9.4 -0.6 Z" fill={ink} />
        </>
      )}
      {kind === 'stickers' && (
        <>
          <rect x="22" y="30" width="34" height="34" rx="8" fill={ink} transform="rotate(-10 39 47)" />
          <circle cx="62" cy="40" r="15" fill={ink} opacity="0.9" />
          <rect x="44" y="52" width="34" height="22" rx="11" fill={ink} transform="rotate(8 61 63)" />
          <text x="39" y="51" textAnchor="middle" fontSize="10" fontWeight="800" fill={a} fontFamily="Archivo Variable, sans-serif" transform="rotate(-10 39 47)">{initials}</text>
        </>
      )}
    </svg>
  )
}

/** The membership card in Settings: made to stand out. */
export function FrontRowCard() {
  const front = useStore((s) => s.frontRow)
  const open = () => useUI.getState().openSheet({ kind: 'frontrow' })
  return (
    <section className="frontrow" aria-label="CIRCA Front Row">
      <p className="frontrow__kicker">
        <I.Ticket size={14} /> CIRCA Front Row
      </p>
      <h3 className="frontrow__title">Never miss a show.</h3>
      <p className="frontrow__body">
        Choose up to {FRONT_ROW_MAX} creators. Whenever one of them announces dates, you’re guaranteed presale access: no queues, no bots, no luck needed.
      </p>
      {front.member ? (
        <>
          <span className="frontrow__faces">
            {front.picks.map((id) => (
              <img key={id} src={creatorById[id]?.avatar} alt={creatorById[id]?.name} />
            ))}
          </span>
          <button className="frontrow__cta frontrow__cta--quiet" onClick={open}>
            Member · {front.picks.length} of {FRONT_ROW_MAX} chosen · Manage
          </button>
        </>
      ) : (
        <button className="frontrow__cta" onClick={open}>
          Choose your {FRONT_ROW_MAX} · ${FRONT_ROW_PRICE} a year
        </button>
      )}
    </section>
  )
}

/** Choosing your five, then joining (a demo: nothing is charged). */
export function FrontRowSheet() {
  const front = useStore((s) => s.frontRow)
  const setFront = useStore((s) => s.setFrontRow)
  const close = () => useUI.getState().openSheet(null)
  // the biggest names first: reach across every platform
  const list = useMemo(() => [...creators].sort((x, y) => reachOf(y.id).listeners - reachOf(x.id).listeners), [])
  const picks = front.picks
  const toggle = (id: string) =>
    setFront({ ...front, picks: picks.includes(id) ? picks.filter((p) => p !== id) : picks.length < FRONT_ROW_MAX ? [...picks, id] : picks })
  const join = () => {
    setFront({ member: true, picks })
    useUI.getState().pushToast({ title: 'Welcome to Front Row', detail: `Presales held for your ${picks.length} · demo, nothing charged`, ms: 4200 })
    close()
  }
  return (
    <Sheet label="Front Row" title="Front Row" onClose={close} tall>
      <div className="form frontrow-sheet">
        <p className="frontrow__body">
          ${FRONT_ROW_PRICE} a year. Pick up to {FRONT_ROW_MAX} creators; when they announce a tour or a live taping, a presale ticket is held for you before tickets go on sale. Swap a pick any time.
        </p>
        <p className="settings__label">
          Your {FRONT_ROW_MAX} · {picks.length} chosen
        </p>
        <div className="frontrow__picks">
          {list.map((c) => {
            const on = picks.includes(c.id)
            const full = !on && picks.length >= FRONT_ROW_MAX
            return (
              <button key={c.id} className={`pick ${on ? 'is-on' : ''}`} onClick={() => toggle(c.id)} disabled={full} aria-pressed={on}>
                <img src={c.avatar} alt="" />
                <span>
                  <strong>{c.name}</strong>
                  <em>{fmtCount(reachOf(c.id).listeners)} listeners</em>
                </span>
                <i aria-hidden>{on ? <I.Check size={16} /> : <I.Plus size={16} />}</i>
              </button>
            )
          })}
        </div>
        {front.member ? (
          <div className="frontrow__actions">
            <button className="frontrow__cta" onClick={close}>
              Done
            </button>
            <button className="form__text-btn" onClick={() => { setFront({ member: false, picks }); close() }}>
              Cancel membership
            </button>
          </div>
        ) : (
          <button className="frontrow__cta" onClick={join} disabled={!picks.length}>
            {picks.length ? `Join Front Row · $${FRONT_ROW_PRICE} a year` : `Choose at least one`}
          </button>
        )}
        <p className="settings__fine">A demo membership: nothing is charged, and no tickets are real.</p>
      </div>
    </Sheet>
  )
}
