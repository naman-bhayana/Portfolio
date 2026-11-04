// The panel's line icons, drawn on a 24 px grid (stroke styles in concierge.css).
const SHAPES = {
  x: <path d="M6 6l12 12M18 6L6 18" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  keys: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
    </>
  ),
  send: <path d="M12 19V5M6 11l6-6 6 6" />,
  end: <path d="M3.5 14.5c4.7-4.2 12.3-4.2 17 0l-2.1 2.4-3.4-1.3v-2.2a10.6 10.6 0 0 0-6 0v2.2l-3.4 1.3z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
}

export default function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {SHAPES[name]}
    </svg>
  )
}
