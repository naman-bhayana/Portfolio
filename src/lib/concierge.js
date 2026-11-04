// Events shared by the concierge's pieces (Concierge.jsx, ConciergeEntry.jsx). The build flag,
// NEXT_PUBLIC_CONCIERGE, is read where each piece is imported (layout.js, Contact.jsx), as a
// condition the bundler can settle: anything but 'on' leaves the site exactly as it was.

// Any part of the page opens the concierge with
//   window.dispatchEvent(new CustomEvent('concierge:open', { detail: { chip, mode, entry } }))
// chip: 'help' | 'problem' | 'engagement'; mode: 'text' | 'voice'; entry: 'launcher' | 'chip' | 'contact'.
export const OPEN_EVENT = 'concierge:open'
// Hover, focus or touch on an entry point: warm the panel's chunk before the click.
export const WARM_EVENT = 'concierge:warm'
