'use client'

import { useSyncExternalStore } from 'react'
import { OPEN_EVENT, WARM_EVENT } from '@/lib/concierge'
import { spaced } from '@/lib/spaced'

const subscribe = () => () => {}

// The concierge's entry in Contact, where the launcher steps aside. Like the copy button, it
// is hidden in the server HTML (useless without JavaScript) and appears once the page hydrates.
// It opens the concierge by event, so the launcher keeps the one panel.
export default function ConciergeEntry({ text, chips }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  const open = (detail) => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { ...detail, entry: 'contact' } }))
  const warm = () => window.dispatchEvent(new Event(WARM_EVENT))

  return (
    <div className="cg-entry" data-concierge="" hidden={!hydrated} onPointerEnter={warm} onFocus={warm} onTouchStart={warm}>
      <p className="cg-entryline">
        {text.lead} <em>{text.em}</em>
      </p>
      <div className="cg-entrychips">
        {spaced([
          ...chips.map((chip) => (
            <button key={chip.id} type="button" className="cg-chip" data-chip={chip.id} onClick={() => open({ chip: chip.id, mode: 'text' })}>
              {chip.label}
            </button>
          )),
          <button key="talk" type="button" className="cg-chip cg-chip-voice" id="cg-entry-talk" onClick={() => open({ mode: 'voice' })}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
            {text.talk}
          </button>,
        ])}
      </div>
    </div>
  )
}
