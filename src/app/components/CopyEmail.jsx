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
  const timer = useRef(0)

  function announce(message) {
    setStatus(message)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus(''), 8000)
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

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <button type="button" className="btn btn-secondary" onClick={copy} hidden={!hydrated} data-copy-email>
        {labels.button}
      </button>
      <p role="status" className="text-sm text-muted">
        {status}
      </p>
    </div>
  )
}
