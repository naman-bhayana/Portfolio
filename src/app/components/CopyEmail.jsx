'use client'

import { useRef, useState, useSyncExternalStore } from 'react'

const subscribe = () => () => {}
const COPIED_MS = 1600 // how long the button says "Copied"

// Progressive enhancement over the mailto link. The button is hidden in the server HTML
// (useless without JavaScript) and appears once the page hydrates. It says "Copied" for a
// moment after a copy, and its name says what it copies (the hint is read, not shown). The
// status region is in the DOM from the start, visually hidden, so screen readers announce the
// result (WCAG 4.1.3) without anything on the page moving.
export default function CopyEmail({ email, targetId, labels, className = 'pill pill-ghost' }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  const [status, setStatus] = useState('')
  const [copied, setCopied] = useState(false)
  const showTimer = useRef(0)
  const clearTimer = useRef(0)
  const copiedTimer = useRef(0)

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
      window.clearTimeout(copiedTimer.current)
      setCopied(true)
      copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
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
    <>
      <button type="button" className={className} onClick={copy} hidden={!hydrated} data-copy-email>
        {copied ? labels.copied : labels.button}
        {labels.hint && <span className="sr"> {labels.hint}</span>}
      </button>
      <p role="status" className="copystatus">
        {status}
      </p>
    </>
  )
}
