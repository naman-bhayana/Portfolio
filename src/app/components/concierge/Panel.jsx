import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AVATAR, CONCIERGE as C, CONTACT, PERSON } from '@/content/site'
import { optimised } from '@/lib/images'
import Icon from './icons'
import { drawOrb, drawStill, orbTarget } from './orb'
import { warmClient } from './session'
import { LIMITS, store } from './store'

// The concierge's panel, loaded on intent (Concierge.jsx). It renders the store's snapshots;
// every change happens in store.js. A dialog: non-modal beside the page on a desktop, a modal
// sheet on a phone (Tab stays inside it). Focus moves in on open and Escape closes it
// (Concierge.jsx), handing focus back.

const PORTRAIT = optimised(AVATAR.src, 256)
const PHONE = '(max-width: 600px)'
const FOCUSABLE = 'button:not([disabled]), textarea, input, [href], [tabindex]:not([tabindex="-1"])'
const NEAR_END = 48 // px: a conversation read this close to its end keeps following new lines

// Where focus goes when the store asks for it.
function target(panel, to) {
  if (!panel) return null
  const last = (selector) => [...panel.querySelectorAll(selector)].at(-1) ?? null
  if (to === 'chip') return panel.querySelector('.cg-start .cg-chip')
  if (to === 'input') return panel.querySelector('#cg-input')
  if (to === 'mute') return panel.querySelector('#cg-mute')
  if (to === 'card') return last('.cg-card')?.querySelector('button') ?? null
  if (to === 'again') return last('.cg-again button')
  if (to === 'sent') return last('.cg-sent')
  if (to.startsWith('field:')) return panel.querySelector(`#cg-b-${to.slice(6)}`)
  return null
}

// The newest line in view; an unsent brief stays in view from its top, below the voice view
// that stays pinned above the conversation.
function follow(body) {
  let top = body.scrollHeight
  const brief = body.querySelector('.cg-briefwrap:not(.cg-done)')
  if (brief) {
    const pinned = body.querySelector('.cg-voice')?.offsetHeight ?? 0
    top = Math.min(top, brief.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - pinned - 12)
  }
  body.scrollTop = Math.max(0, top)
}

// The orb's frame loop: only while a voice session is connected and motion runs. Reduced
// motion or the pause switch stop it and draw the orb at rest; releasing the switch starts it.
// The voice view is pinned at the top of the panel, so the orb is on screen while it runs.
function runOrb(canvas, connected) {
  const ctx = canvas?.getContext('2d')
  if (!ctx) return undefined
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const pause = document.getElementById('pause-motion')
  const still = () => reduced.matches || !!pause?.checked
  let raf = 0
  let last = 0
  let level = 0.18
  const rest = () => {
    cancelAnimationFrame(raf)
    raf = 0
    last = 0
    drawStill(ctx, canvas.width)
    if (still()) store.lightAll()
  }
  const frame = (now) => {
    raf = 0
    const conversation = store.conversation()
    if (!conversation || still()) {
      rest()
      return
    }
    const time = now / 1000
    const output = conversation.getOutputVolume?.() ?? 0
    const input = store.get().muted ? 0 : (conversation.getInputVolume?.() ?? 0)
    const talking = store.speaking() || output > 0.02
    const mode = talking ? 'speaking' : input > 0.04 ? 'hearing' : 'idle'
    level += (orbTarget(mode, output, input, time) - level) * 0.18
    drawOrb(ctx, canvas.width, time, level, mode)
    store.tick(last ? Math.min(100, now - last) : 0, talking)
    last = now
    raf = requestAnimationFrame(frame)
  }
  const kick = () => {
    if (!connected || still()) rest()
    else if (!raf) raf = requestAnimationFrame(frame)
  }
  kick()
  pause?.addEventListener('change', kick)
  reduced.addEventListener('change', kick)
  return () => {
    cancelAnimationFrame(raf)
    pause?.removeEventListener('change', kick)
    reduced.removeEventListener('change', kick)
  }
}

// A mouse over, or keyboard focus on, the way into a conversation warms the client. Not a
// touch: see warmClient (session.js).
const warmOnMouse = (event) => {
  if (event.pointerType === 'mouse') warmClient()
}
const warmOnKeys = (event) => {
  if (event.target.matches?.(':focus-visible')) warmClient()
}

function Start() {
  return (
    <div className="cg-start" id="cg-start" onPointerEnter={warmOnMouse} onFocus={warmOnKeys}>
      <p className="cg-hello">
        {C.hello.lead} <em>{C.hello.em}</em>
      </p>
      <div className="cg-chips">
        {C.chips.map((chip) => (
          <button key={chip.id} type="button" className="cg-chip" data-chip={chip.id} onClick={() => store.chip(chip.id)}>
            {chip.label}
          </button>
        ))}
      </div>
      <div className="cg-actions">
        <button type="button" className="cg-talk" id="cg-talk" onClick={store.talk}>
          <Icon name="mic" />
          {C.talk}
        </button>
        <button type="button" className="cg-type" id="cg-type" onClick={store.type}>
          <Icon name="keys" />
          {C.type}
        </button>
      </div>
      <p className="cg-consent">{C.consent}</p>
    </div>
  )
}

function CardShell({ warn = false, title, text, extra = null, note = null, actions }) {
  return (
    <li className={warn ? 'cg-card cg-warn' : 'cg-card'}>
      <h3>{title}</h3>
      <p>{text}</p>
      {extra}
      <div className="cg-cardacts">
        {actions.map((action) => (
          <button key={action.label} type="button" className={action.primary ? 'cg-btn cg-primary' : 'cg-btn'} onClick={action.act}>
            {action.label}
          </button>
        ))}
      </div>
      {note && <p className="cg-consent">{note}</p>}
    </li>
  )
}

// The notice cards: the microphone explainer (with the consent line, as no conversation has
// shown it yet on this path), a blocked, busy or missing microphone, and resting (the route
// said no or the session could not start), which falls back to email.
function Card({ entry }) {
  if (entry.kind === 'mic') {
    return (
      <CardShell
        title={C.mic.title}
        text={C.mic.text}
        note={C.consent}
        actions={[
          { label: C.mic.allow, primary: true, act: store.allowMic },
          { label: C.typeInstead, act: store.typeInstead },
        ]}
      />
    )
  }
  if (entry.kind === 'blocked' || entry.kind === 'busy' || entry.kind === 'nomic') {
    return (
      <CardShell
        warn
        title={C[entry.kind].title}
        text={C[entry.kind].text}
        actions={[
          { label: C.typeInstead, primary: true, act: store.typeInstead },
          { label: C.retry, act: store.retry },
        ]}
      />
    )
  }
  const label = entry.copied === 'done' ? C.resting.copied : entry.copied === 'fallback' ? CONTACT.copy.fallback : C.resting.copy
  return (
    <CardShell
      title={C.resting.title}
      text={C.resting.text}
      extra={
        <p className="cg-mail" id={`cg-mail-${entry.id}`}>
          {PERSON.email}
        </p>
      }
      actions={[{ label, primary: true, act: () => store.copyMail(entry.id) }]}
    />
  )
}

// Typing on the card tells the agent the visitor is still there, as typing in the composer does:
// in a call, the card is where the email goes, and it must not read as silence.
function Field({ name, data, error, area = false, type = 'text', autoComplete, required = false }) {
  const id = `cg-b-${name}`
  const shared = { id, name, defaultValue: data[name], maxLength: LIMITS[name], 'aria-invalid': error?.field === name ? 'true' : undefined, onInput: store.activity }
  return (
    <div className="cg-field">
      <label htmlFor={id}>{C.brief[name]}</label>
      {area ? (
        <textarea rows={2} {...shared} />
      ) : (
        <input type={type} autoComplete={autoComplete} required={required} aria-describedby={name === 'email' ? 'cg-b-err' : undefined} {...shared} />
      )}
    </div>
  )
}

// The brief card: filled in by the agent (fill_brief), checked and sent by the visitor, so the
// email is typed, never misheard. It is not read out as it appears (aria-live off): the agent
// says it is there, and the card waits to be tabbed to. Once sent, the confirmation is read
// once: by the conversation's live region in text, or by focus moving to it in voice.
function Brief({ entry }) {
  if (entry.sent) {
    return (
      <li className="cg-briefwrap cg-done">
        <div className="cg-sent" tabIndex={-1}>
          <span className="cg-check" aria-hidden="true">
            <Icon name="check" />
          </span>
          <div>
            <strong>{C.brief.sent}</strong> <span>{C.brief.sentLine}</span>
          </div>
        </div>
      </li>
    )
  }
  const { data, error } = entry
  const submit = (event) => {
    event.preventDefault()
    store.submitBrief(entry.id, Object.fromEntries(new FormData(event.currentTarget)))
  }
  return (
    <li className="cg-briefwrap" aria-live="off">
      <form key={entry.rev} className="cg-brief" id="cg-brief" noValidate aria-labelledby="cg-brief-h" onSubmit={submit}>
        <div className="cg-briefhead">
          <p className="cg-eyebrow" id="cg-brief-h">
            {C.brief.heading}
          </p>
        </div>
        <div className="cg-pair">
          <Field name="name" data={data} error={error} autoComplete="name" required />
          <Field name="company" data={data} error={error} autoComplete="organization" />
        </div>
        <Field name="email" type="email" data={data} error={error} autoComplete="email" required />
        <Field name="building" area data={data} error={error} />
        <Field name="stuck" area data={data} error={error} />
        <Field name="timeline" data={data} error={error} />
        <p className="cg-err" id="cg-b-err" role="alert">
          {error ? error.text : null}
        </p>
        <div className="cg-briefacts">
          <button type="submit" className="cg-send">
            {C.brief.send} <Icon name="arrow" />
          </button>
          <button type="button" className="cg-later" onClick={() => store.laterBrief(entry.id)}>
            {C.brief.later}
          </button>
        </div>
        <p className="cg-note">{C.brief.note}</p>
      </form>
    </li>
  )
}

function Entry({ entry }) {
  switch (entry.k) {
    case 'user':
      return <li className="cg-msg cg-user">{entry.text}</li>
    case 'agent':
      // Held back while it only repeats the reply before it (store.js).
      if (entry.hidden) return null
      // Screen readers get the reply once, complete; the streamed text is drawn beside it.
      return (
        <li className="cg-msg cg-agent">
          <span className="sr">{entry.done ? entry.text : null}</span>
          <span aria-hidden="true">{entry.text}</span>
        </li>
      )
    case 'act':
      return <li className="cg-act">{`${C.shown} · ${entry.text}`}</li>
    case 'card':
      return <Card entry={entry} />
    case 'brief':
      return <Brief entry={entry} />
    case 'end':
      return (
        <>
          <li className="cg-end-line">{C[entry.note]}</li>
          <li className="cg-again">
            <button type="button" className="cg-btn" onClick={store.again}>
              {C.again}
            </button>
          </li>
        </>
      )
    default:
      return null
  }
}

// The send button never disables itself under the visitor's focus: it says it is unavailable
// (aria-disabled) and does nothing until there is something to send. After a send, focus goes
// back to the box, ready for the next line.
function Composer({ streaming }) {
  const [draft, setDraft] = useState('')
  const box = useRef(null)
  const ready = !streaming && draft.trim() !== ''
  const fit = (el) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(132, el.scrollHeight)}px`
  }
  const submit = () => {
    if (!ready || !store.send(draft)) return
    setDraft('')
    if (box.current) {
      box.current.style.height = ''
      box.current.focus({ preventScroll: true })
    }
  }
  return (
    <div className="cg-compose" id="cg-compose">
      <button type="button" className="cg-icon" id="cg-tomic" aria-label={C.controls.toVoice} onClick={store.toVoice}>
        <Icon name="mic" />
      </button>
      <label className="sr" htmlFor="cg-input">
        {C.input.label}
      </label>
      <textarea
        ref={box}
        className="cg-input"
        id="cg-input"
        name="message"
        rows={1}
        maxLength={600}
        placeholder={C.input.placeholder}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          fit(event.target)
          store.activity()
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
          event.preventDefault()
          submit()
        }}
      />
      <button type="button" className="cg-sendbtn" id="cg-sendbtn" aria-label={C.input.send} aria-disabled={!ready} onClick={submit}>
        <Icon name="send" />
      </button>
    </div>
  )
}

function VoiceControls({ muted }) {
  return (
    <div className="cg-vctl" id="cg-vctl">
      <button type="button" className="cg-round" id="cg-mute" aria-pressed={muted} aria-label={C.controls.mute} onClick={store.toggleMute}>
        <Icon name="mic" />
      </button>
      <button type="button" className="cg-round" id="cg-totext" aria-label={C.controls.toText} onClick={store.toText}>
        <Icon name="keys" />
      </button>
      <button type="button" className="cg-round cg-end" id="cg-end" aria-label={C.controls.end} onClick={store.end}>
        <Icon name="end" />
      </button>
    </div>
  )
}

export default function Panel({ request, onClose }) {
  const s = useSyncExternalStore(store.subscribe, store.get, store.get)
  const panelRef = useRef(null)
  const bodyRef = useRef(null)
  const orbRef = useRef(null)
  // Whether the visitor was reading the newest lines (or has scrolled back to read older ones).
  const atEnd = useRef(true)
  const live = s.view === 'live'
  const voice = live && s.mode === 'voice'
  // The consent line opens every conversation, whatever led to it, until the visitor's own
  // first turn (a chip's question is not one).
  const consent = live && !!s.mode && !s.log.some((entry) => entry.k === 'user' && !entry.auto)

  // Before the first paint, so the panel opens on the right view.
  useLayoutEffect(() => {
    store.open(request)
  }, [request])
  useEffect(() => () => store.close(), [])

  useEffect(() => {
    if (s.focus) target(panelRef.current, s.focus.to)?.focus({ preventScroll: true })
  }, [s.focus])

  // New lines are followed while the visitor reads the end of the conversation, and always
  // after the visitor's own; reading back up, they are left where they are.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    if (atEnd.current || s.log.at(-1)?.k === 'user') follow(body)
  }, [s.log, s.waiting])

  useEffect(() => (voice ? runOrb(orbRef.current, s.connected) : undefined), [voice, s.connected])

  const trap = (event) => {
    if (event.key !== 'Tab' || !window.matchMedia(PHONE).matches) return
    const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
    if (!items.length) return
    const first = items[0]
    const last = items.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const onScroll = (event) => {
    const body = event.currentTarget
    atEnd.current = body.scrollHeight - body.scrollTop - body.clientHeight < NEAR_END
  }

  const classes = ['cg-panel', 'cg-opening', s.phone && 'cg-sheet', live && 'cg-live', s.voicebar && voice && 'cg-voicebar'].filter(Boolean)

  return (
    <section
      ref={panelRef}
      className={classes.join(' ')}
      id="cg-panel"
      role="dialog"
      aria-labelledby="cg-title"
      aria-modal={s.phone ? 'true' : 'false'}
      data-state={s.tone}
      // Focusable without a tab stop: a click on its text keeps focus in the concierge, where
      // Escape closes it (Concierge.jsx).
      tabIndex={-1}
      onKeyDown={trap}
    >
      <span className="cg-grab" aria-hidden="true" />
      {/* Plain boxes, not header and footer: inside the dialog those would read as the page's
          banner and contentinfo landmarks. */}
      <div className="cg-head">
        <span className="cg-av" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- optimised URL built in lib/images */}
          <img src={PORTRAIT} width={AVATAR.width} height={AVATAR.height} alt="" decoding="async" />
        </span>
        <div className="cg-htext">
          <h2 className="cg-title" id="cg-title">
            {C.title}
          </h2>
          <p className="cg-status">
            <i className="cg-dot" aria-hidden="true" />
            <span id="cg-statustext">{C.status[s.status]}</span>
          </p>
        </div>
        <button type="button" className="cg-icon" id="cg-close" aria-label={C.close} onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <div ref={bodyRef} className={s.compact ? 'cg-body cg-compact' : 'cg-body'} id="cg-body" onScroll={onScroll}>
        {s.view === 'start' && <Start />}
        {consent && <p className="cg-consent cg-consent-live">{C.consent}</p>}
        {voice && (
          <div className="cg-voice" id="cg-voice">
            <canvas ref={orbRef} className="cg-orb" id="cg-orb" width="352" height="352" aria-hidden="true" />
            <p className="cg-caption" id="cg-caption" aria-hidden="true">
              {s.caption.map((word, i) => (
                <span key={i} className={i < s.lit ? 'cg-w cg-said' : 'cg-w'}>
                  {i < s.caption.length - 1 ? `${word} ` : word}
                </span>
              ))}
            </p>
            <p className="cg-heard" id="cg-heard" aria-hidden="true">
              {s.heard}
            </p>
          </div>
        )}
        {/* The conversation is announced as it grows, except in a call, where it is heard. */}
        {live && (
          <div className="cg-logwrap" role="log" aria-live={voice ? 'off' : 'polite'} aria-label={C.log}>
            <ol className="cg-log" id="cg-log">
              {s.log.map((entry) => (
                <Entry key={entry.id} entry={entry} />
              ))}
              {s.waiting && (
                <li className="cg-typing" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </li>
              )}
            </ol>
          </div>
        )}
      </div>
      {live && s.mode && (
        <div className="cg-foot" id="cg-foot">
          {s.mode === 'text' ? <Composer streaming={s.streaming} /> : <VoiceControls muted={s.muted} />}
        </div>
      )}
    </section>
  )
}
