'use client'

import { useRef, useState, useSyncExternalStore } from 'react'

const subscribe = () => () => {}

// Progressive enhancement over the mailto link. The button is hidden in the server HTML
// (useless without JavaScript) and appears once the page hydrates. The status region is
// in the DOM from the start so screen readers announce the result (WCAG 4.1.3).
export default function CopyEmail({ email, targetId, labels }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  const [status, setStatus] = useState('')
  const showTimer = useRef(0)
  const clearTimer = useRef(0)

  // Empty the region first and fill it a moment later, so a second copy is announced too
  // (screen readers only speak changes).
  function announce(message) {
    window.clearTimeout(showTimer.current)
    window.clearTimeout(clearTimer.current)
    setStatus('')
    showTimer.current = window.setTimeout(() => setStatus(message), 50)
    clearTimer.current = window.setTimeout(() => setStatus(''), 8000)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(email)
      announce(labels.done)
    } catch {
      // No clipboard access: select the visible address so Ctrl+C works.
      const target = document.getElementById(targetId)
      if (target) {
        const range = document.createRange()
        range.selectNodeContents(target)
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
      }
      announce(labels.fallback)
    }
  }

  // Both elements join the row of contact buttons; CSS puts the status on its own line.
  return (
    <>
      <button type="button" className="pill pill-ghost" onClick={copy} hidden={!hydrated} data-copy-email>
        {labels.button}
      </button>
      <p role="status" className="copystatus">
        {status}
      </p>
    </>
  )
}
