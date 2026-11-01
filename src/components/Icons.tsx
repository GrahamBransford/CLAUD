import type { ReactNode } from 'react'

/**
 * CIRCA's icon family, drawn from the markings on tape decks, turntables and
 * radio fascias: solid transport symbols (play, pause, skip, wind), a REC
 * roundel for Save, and fine-line outlines for everything else. All share a
 * 24-unit grid, a 1.8 line and round ends.
 */
function Svg({ size = 24, children, className }: { size?: number; children: ReactNode; className?: string }) {
  return (
    <svg
      className={`icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}
type P = { size?: number; on?: boolean }

/** Save: the REC button. Lit, the roundel fills. */
export const Save = ({ size, on }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="8.6" />
    <circle cx="12" cy="12" r={on ? 5.2 : 3.4} fill="currentColor" stroke="none" />
  </Svg>
)

/** Skip: the transport ⏭. */
export const Skip = ({ size }: P) => (
  <Svg size={size}>
    <path d="M5.5 6.2v11.6l8.6-5.8z" fill="currentColor" />
    <path d="M18 6.4v11.2" strokeWidth="2.2" />
  </Svg>
)

export const Play = ({ size }: P) => (
  <Svg size={size}>
    <path d="M7.5 5.4v13.2l10.6-6.6z" fill="currentColor" />
  </Svg>
)

export const Pause = ({ size }: P) => (
  <Svg size={size}>
    <rect x="6.6" y="5.6" width="3.6" height="12.8" rx="1" fill="currentColor" stroke="none" />
    <rect x="13.8" y="5.6" width="3.6" height="12.8" rx="1" fill="currentColor" stroke="none" />
  </Svg>
)

/** Tape wind, with the seconds it moves. */
export const Rewind = ({ size, by = 15 }: P & { by?: number }) => (
  <Svg size={size}>
    <path d="M11.6 4.6 5.4 9l6.2 4.4zM18.6 4.6 12.4 9l6.2 4.4z" fill="currentColor" strokeWidth="1.2" />
    <text x="12" y="21.6" textAnchor="middle" fontSize="6.6" fontWeight="700" fill="currentColor" stroke="none" fontFamily="var(--display)">{by}</text>
  </Svg>
)
export const Wind = ({ size, by = 30 }: P & { by?: number }) => (
  <Svg size={size}>
    <path d="M5.4 4.6 11.6 9l-6.2 4.4zM12.4 4.6 18.6 9l-6.2 4.4z" fill="currentColor" strokeWidth="1.2" />
    <text x="12" y="21.6" textAnchor="middle" fontSize="6.6" fontWeight="700" fill="currentColor" stroke="none" fontFamily="var(--display)">{by}</text>
  </Svg>
)

/** Sound off: a speaker cone, struck through. */
export const Muted = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 9.4h3.2L12 5.6v12.8l-4.8-3.8H4z" />
    <path d="M15.6 9.4l5 5.2M20.6 9.4l-5 5.2" />
  </Svg>
)

/** Drive: a rounded fifties coupé. */
export const Car = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3 15.6v-2.4c0-1 .7-1.8 1.6-2l2.2-.5 2.3-3a2.4 2.4 0 0 1 1.9-.9h3.4c.8 0 1.6.4 2 1.1l1.8 2.8 1.8.4c1 .2 1.7 1 1.7 2v2.5c0 .5-.4.9-.9.9H3.9a.9.9 0 0 1-.9-.9z" />
    <circle cx="7.4" cy="16.6" r="1.9" fill="var(--icon-bg, #0b1d14)" />
    <circle cx="16.6" cy="16.6" r="1.9" fill="var(--icon-bg, #0b1d14)" />
    <path d="M8.6 10.6h7.4" />
  </Svg>
)

export const Close = ({ size }: P) => (
  <Svg size={size}>
    <path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6" />
  </Svg>
)
export const Down = ({ size }: P) => (
  <Svg size={size}>
    <path d="M6 9.4l6 6 6-6" />
  </Svg>
)
export const Plus = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 5.4v13.2M5.4 12h13.2" />
  </Svg>
)
export const Check = ({ size }: P) => (
  <Svg size={size}>
    <path d="M5.4 12.6l4.2 4.2 9-9.6" />
  </Svg>
)

/** Inner Circle love: a plain heart, kept apart from Save. */
export const Love = ({ size, on }: P) => (
  <Svg size={size}>
    <path d="M12 19.4s-7.4-4.3-7.4-9.6A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.4 2.5c0 5.3-7.4 9.6-7.4 9.6z" fill={on ? 'currentColor' : 'none'} />
  </Svg>
)

/** The whole thing: four corners opening out (full episode). */
export const Expand = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4.8 9.4V4.8h4.6M14.6 4.8h4.6v4.6M19.2 14.6v4.6h-4.6M9.4 19.2H4.8v-4.6" />
  </Svg>
)

/** Comments: a speech balloon, rounded like the rest. */
export const Comment = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 4.6c4.6 0 8.2 3 8.2 6.8s-3.6 6.8-8.2 6.8c-1 0-2-.1-2.9-.4L5 19.4l1.2-3.4C4.8 14.8 3.8 13.2 3.8 11.4 3.8 7.6 7.4 4.6 12 4.6z" />
  </Svg>
)

/** Send: a paper plane, kept simple. */
export const Send = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4.6 11.6 19.4 4.6l-4.8 15-3-6.2z" />
    <path d="M11.6 13.4 19.4 4.6" />
  </Svg>
)

/** A ticket stub: shows, festivals, live tapings. */
export const Ticket = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 7.4h16v2.8a1.8 1.8 0 0 0 0 3.6v2.8H4v-2.8a1.8 1.8 0 0 0 0-3.6z" />
    <path d="M14.6 7.8v1.4M14.6 11.3v1.4M14.6 14.8v1.4" />
  </Svg>
)

/** The catalogue lens. */
export const Search = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="10.6" cy="10.6" r="6" />
    <path d="M15 15l4.8 4.8" />
  </Svg>
)

/** A four-point spark, the atomic-age favourite mark. */
export const Spark = ({ size, on }: P) => (
  <Svg size={size}>
    <path d="M12 3.6c.6 4.6 1.8 5.8 6.4 6.4-4.6.6-5.8 1.8-6.4 6.4-.6-4.6-1.8-5.8-6.4-6.4 4.6-.6 5.8-1.8 6.4-6.4z" fill={on ? 'currentColor' : 'none'} transform="translate(0 2)" />
  </Svg>
)

/** Friends: two people, side by side. */
export const People = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="9" cy="8.6" r="3.2" />
    <path d="M3.4 18.8c.5-3 2.7-4.7 5.6-4.7s5.1 1.7 5.6 4.7" />
    <circle cx="16.4" cy="9.4" r="2.6" />
    <path d="M15.6 14.2c2.6-.2 4.4 1.3 5 4" />
  </Svg>
)

export const AddPerson = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="9.6" cy="8.4" r="3.6" />
    <path d="M3.6 19.2c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2M18.6 8v6M15.6 11h6" />
  </Svg>
)

export const Pin = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 20.4s-6-5.6-6-10.2a6 6 0 0 1 12 0c0 4.6-6 10.2-6 10.2z" />
    <circle cx="12" cy="10.2" r="2.1" />
  </Svg>
)

export const Edit = ({ size }: P) => (
  <Svg size={size}>
    <path d="M5 19l1-4.2 9.6-9.6a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L9.2 18z" />
    <path d="M13.8 7l3.2 3.2" />
  </Svg>
)

/** Tuning: the settings knob, with its pointer. */
export const Knob = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="7.6" />
    <path d="M12 12V6.6" />
    <path d="M12 1.8v1.2M12 21v1.2M1.8 12h1.2M21 12h1.2" />
  </Svg>
)

/** Artists, podcasts, Inner Circle: each a ringed station mark. */
export const StationRadio = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="10" />
    {/* a little cabinet radio: grille on the left, dial on the right */}
    <rect x="6" y="8" width="12" height="8.6" rx="1.8" />
    <path d="M8.2 10.6h3.2M8.2 12.4h3.2M8.2 14.2h3.2" />
    <circle cx="15" cy="12.3" r="1.7" />
    <path d="M9 8 11.6 5.6" />
  </Svg>
)
export const StationArtists = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="10" />
    <path d="M10.6 15.6V7.6l5-1.2v2.4l-5 1.2" />
    <circle cx="9.1" cy="15.8" r="1.9" fill="currentColor" stroke="none" />
  </Svg>
)
export const StationPodcasts = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="10" />
    <rect x="9.6" y="5.6" width="4.8" height="8.2" rx="2.4" />
    <path d="M7.4 11.6a4.6 4.6 0 0 0 9.2 0M12 16.2v2.2" />
  </Svg>
)
export const StationCircle = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="5.6" />
    {/* the centre of the circle, lit */}
    <circle className="icon__glow" cx="12" cy="12" r="2.3" stroke="none" />
  </Svg>
)
