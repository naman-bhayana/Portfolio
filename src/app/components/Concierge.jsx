'use client'

import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { OPEN_EVENT, WARM_EVENT } from '@/lib/concierge'

// The concierge's launcher and its one peek of quick questions. Everything else (the panel, the
// conversation, the ElevenLabs client) is a separate chunk, fetched only once the visitor shows
// intent: a click, or a hover, focus or touch that warms it a moment early. Nothing here is in
// the server HTML, and nothing runs at rest: three observers and one arrival timer.

const load = () => import('./concierge/Panel')

// If the chunk can't be fetched (offline, or a new deploy has replaced it), the panel closes and
// focus goes to the email address instead: a failed lazy import must never take the page down.
function Unavailable({ onFail }) {
  useEffect(() => {
    onFail()
  }, [onFail])
  return null
}
// React.lazy keeps a failed import for good, so each failure makes a fresh one for the next try.
const lazyPanel = () => lazy(() => load().catch(() => ({ default: Unavailable })))
let Panel = lazyPanel()

// Anything the concierge throws while rendering closes it; the page carries on.
class Guard extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

const subscribe = () => () => {}
const LANDING_CAP_MS = 5000 // the hero's arrival takes 2.2 s (Hero.jsx); never wait longer than this
const IDLE_MS = 1200
const PEEKED = 'cg-peeked' // sessionStorage: the quick questions show once per visit
const MODES = ['text', 'voice']
const ENTRIES = ['launcher', 'chip', 'contact']
const ELEVENLABS = 'https://api.elevenlabs.io'

let warmed = false
function warm() {
  if (warmed) return
  warmed = true
  load().catch(() => {
    warmed = false
  })
  // One early connection to ElevenLabs, never a second link for it.
  if (document.head.querySelector(`link[rel="preconnect"][href^="${ELEVENLABS}"]`)) return
  const link = document.createElement('link')
  link.rel = 'preconnect'
  link.href = ELEVENLABS
  link.crossOrigin = ''
  document.head.append(link)
}

const remembered = () => {
  try {
    return sessionStorage.getItem(PEEKED) === '1'
  } catch {
    return false
  }
}
const remember = () => {
  try {
    sessionStorage.setItem(PEEKED, '1')
  } catch {}
}

// Somewhere focus can go back to: still in the page, drawn and not hidden.
const usable = (el) => !!el && el !== document.body && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'

const X = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export default function Concierge({ text }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  const [arrived, setArrived] = useState(false)
  const [folded, setFolded] = useState(false)
  const [atContact, setAtContact] = useState(false)
  const [peek, setPeek] = useState(false)
  // What the panel was opened for, while it is open: { n, chip, mode, entry }.
  const [request, setRequest] = useState(null)
  const open = request !== null
  const openRef = useRef(false)
  const rootRef = useRef(null)
  const launchRef = useRef(null)
  const peekRef = useRef(null)
  const backRef = useRef(null)

  useEffect(() => {
    openRef.current = open
  }, [open])

  // Arrival: once the hero has landed (its own arrival animations have finished; at once with
  // reduced motion or the pause switch), then on the first scroll or when the browser is idle,
  // whichever comes first. Never while the hero is still arriving.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1))
    const cancelIdle = window.cancelIdleCallback ?? clearTimeout
    let cancelled = false
    let landed = false
    let scrolled = false
    let idleId = 0
    let cap = 0
    const arrive = () => {
      if (!cancelled) setArrived(true)
    }
    const landing = (document.querySelector('.hero')?.getAnimations({ subtree: true }) ?? [])
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => {}))
    const capped = new Promise((resolve) => {
      cap = setTimeout(resolve, LANDING_CAP_MS)
    })
    Promise.race([Promise.all(landing), capped]).then(() => {
      clearTimeout(cap)
      landed = true
      if (scrolled) arrive()
      else if (!cancelled) idleId = idle(arrive, { timeout: IDLE_MS })
    })
    const onScroll = () => {
      scrolled = true
      if (landed) arrive()
    }
    window.addEventListener('scroll', onScroll, { once: true, passive: true })
    return () => {
      cancelled = true
      clearTimeout(cap)
      cancelIdle(idleId)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Past the hero the label folds into the disc; while Contact is on screen the launcher steps
  // aside for the inline entry; the first time the studio comes up, the quick questions peek.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const observers = []
    const watch = (el, options, handle) => {
      if (!el) return
      const observer = new IntersectionObserver(([entry]) => handle(entry), options)
      observer.observe(el)
      observers.push(observer)
    }
    watch(document.querySelector('.hero'), { threshold: 0.15 }, (entry) => setFolded(!entry.isIntersecting))
    watch(document.getElementById('contact'), { threshold: 0.3 }, (entry) => {
      setAtContact(entry.isIntersecting)
      if (entry.isIntersecting) setPeek(false)
    })
    let peeked = remembered()
    watch(document.getElementById('nexerah'), { rootMargin: '0px 0px -40% 0px' }, (entry) => {
      if (entry.isIntersecting) {
        if (peeked || openRef.current) return
        peeked = true
        remember()
        setArrived(true)
        setPeek(true)
      } else if (entry.boundingClientRect.top < 0) setPeek(false)
    })
    return () => observers.forEach((observer) => observer.disconnect())
  }, [])

  // Whatever asks (a click here, the Contact entry, any script's event), only what the page
  // knows gets through: a chip it does not have, a mode or an entry it does not know, is dropped.
  const begin = useCallback(
    (detail) => {
      const chip = text.chips.some((known) => known.id === detail?.chip) ? detail.chip : null
      const mode = MODES.includes(detail?.mode) ? detail.mode : chip ? 'text' : null
      const entry = ENTRIES.includes(detail?.entry) ? detail.entry : chip ? 'chip' : 'launcher'
      setPeek(false)
      setArrived(true)
      if (!openRef.current) backRef.current = document.activeElement
      warm()
      setRequest((now) => ({ n: (now?.n ?? 0) + 1, chip, mode, entry }))
    },
    [text.chips],
  )

  const close = useCallback(() => setRequest(null), [])
  const fail = useCallback(() => {
    Panel = lazyPanel()
    const email = document.getElementById('contact-email')
    email?.scrollIntoView({ block: 'center' })
    if (email) backRef.current = email
    setRequest(null)
  }, [])

  // The page's own entry points (the Contact entry, or anything else) open it by event.
  useEffect(() => {
    const onOpen = (event) => begin(event.detail)
    window.addEventListener(OPEN_EVENT, onOpen)
    window.addEventListener(WARM_EVENT, warm)
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen)
      window.removeEventListener(WARM_EVENT, warm)
    }
  }, [begin])

  // Escape closes the panel when focus is in the concierge (it would end a call, so not from
  // anywhere on the page), or puts the quick questions away when they are what is open.
  useEffect(() => {
    if (!open && !peek) return
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.isComposing || event.defaultPrevented) return
      if (open) {
        if (rootRef.current?.contains(document.activeElement)) close()
        return
      }
      const inside = peekRef.current?.contains(document.activeElement)
      setPeek(false)
      if (inside) launchRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, peek, close])

  // Closed: focus goes back where it came from, else to the launcher or the Contact entry.
  useEffect(() => {
    if (open || !backRef.current) return
    const back = backRef.current
    backRef.current = null
    const target = [back, launchRef.current, document.querySelector('.cg-entry .cg-chip'), document.getElementById('main')].find(usable)
    target?.focus({ preventScroll: true })
  }, [open])

  if (!hydrated) return null

  const hidePeek = () => {
    setPeek(false)
    launchRef.current?.focus({ preventScroll: true })
  }
  const state = [arrived && 'cg-on', folded && 'cg-fold', atContact && 'cg-hide', open && 'cg-open'].filter(Boolean)

  return (
    <div ref={rootRef} className={['cg', ...state].join(' ')} data-concierge="">
      <div ref={peekRef} className={peek ? 'cg-peek cg-in' : 'cg-peek'} id="cg-peek" role="group" aria-labelledby="cg-peek-h" hidden={!peek}>
        <div className="cg-peekhead">
          <p className="cg-eyebrow" id="cg-peek-h">
            {text.peek.label}
          </p>
          <button type="button" className="cg-x" id="cg-peek-x" aria-label={text.peek.hide} onClick={hidePeek}>
            {X}
          </button>
        </div>
        {text.chips.map((chip) => (
          <button key={chip.id} type="button" className="cg-chip" data-chip={chip.id} onClick={() => begin({ chip: chip.id, mode: 'text', entry: 'chip' })}>
            {chip.label}
          </button>
        ))}
      </div>
      {/* The label is drawn from data-t: the button's name is its aria-label, which says more. */}
      <button
        ref={launchRef}
        type="button"
        className="cg-launch"
        id="cg-launch"
        aria-expanded={open}
        aria-controls="cg-panel"
        aria-label={text.launcher.label}
        onClick={() => begin({ entry: 'launcher' })}
        onPointerEnter={warm}
        onFocus={warm}
        onTouchStart={warm}
      >
        <span className="cg-disc" aria-hidden="true">
          <span className="cg-bars">
            <i />
            <i />
            <i />
            <i />
          </span>
        </span>
        <span className="cg-ltext" aria-hidden="true">
          <span className="cg-lname" data-t={text.launcher.name} />
          <span className="cg-ltag" data-t={text.launcher.tag} />
        </span>
      </button>
      {open && (
        <Guard onError={fail}>
          <Suspense fallback={null}>
            <Panel request={request} onClose={close} onFail={fail} />
          </Suspense>
        </Guard>
      )}
    </div>
  )
}
