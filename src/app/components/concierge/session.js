// Starting a conversation: the microphone (voice), a session from our route, then the ElevenLabs
// client, which is its own chunk and loads only here. Every step honours an abort signal, so a
// visitor who closes, ends or switches while it connects leaves nothing running behind them.
//
// For the browser checks, on 127.0.0.1 or localhost with localStorage['cg-mock'] = '1', a
// scripted conversation stands in (mock.js) and neither the route nor ElevenLabs is called. Two
// more keys steer the mock there: 'cg-mock-mic' = 'denied' | 'missing' | 'busy' fails the
// microphone, 'cg-mock-route' = '429' (any status) fails the route.

// Self-hosted copies of the client's audio worklets (scripts/assets/worklets.mjs), so the
// Content Security Policy needs no blob: in script-src.
const WORKLETS = {
  rawAudioProcessor: '/vendor/elevenlabs/rawAudioProcessor.js',
  audioConcatProcessor: '/vendor/elevenlabs/audioConcatProcessor.js',
}
const ROUTE_MS = 15000 // the route answers well within this
const START_MS = 20000 // and the session starts within this, or the concierge rests
// What may reach the agent's prompt from the address bar and the referrer: anything else is
// dropped, not cleaned.
const UTM_SOURCE = /^[A-Za-z0-9._-]{1,40}$/
const REFERRER_HOST = /^[a-z0-9.-]{1,100}(:\d{1,5})?$/i

const storage = (kind) => {
  try {
    return window[kind]
  } catch {
    return null
  }
}
const read = (key, kind = 'localStorage') => {
  try {
    return storage(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}
const write = (key, value, kind = 'localStorage') => {
  try {
    storage(kind)?.setItem(key, value)
  } catch {}
}

export const isMock = () => /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname) && read('cg-mock') === '1'

// The route said no (403 origin, 429 rate, 503 paused or unconfigured, 502 upstream), or could
// not be reached (status 0), or the session never started (504).
export class SessionError extends Error {
  constructor(status) {
    super(`The concierge could not start (${status})`)
    this.name = 'SessionError'
    this.status = status
  }
}

const aborted = () => new DOMException('The visitor left before the concierge started', 'AbortError')
const check = (signal) => {
  if (signal?.aborted) throw aborted()
}

// Called in the click, before anything is awaited, so the browser's prompt belongs to the
// visitor's gesture. The stream only opens the door: the client opens its own.
export function requestMic() {
  if (isMock()) {
    const fail = read('cg-mock-mic')
    const name = { missing: 'NotFoundError', busy: 'NotReadableError' }[fail] ?? 'NotAllowedError'
    return fail ? Promise.reject(new DOMException('Mock microphone', name)) : Promise.resolve(null)
  }
  if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(new DOMException('No microphone', 'NotFoundError'))
  return navigator.mediaDevices.getUserMedia({ audio: true })
}

// 'granted', 'denied' or 'prompt'. Where the browser can't say, the explainer shows.
export async function micPermission() {
  if (isMock()) return 'prompt'
  try {
    return (await navigator.permissions.query({ name: 'microphone' })).state
  } catch {
    return 'prompt'
  }
}

// A mouse over, or keyboard focus on, the panel's way into a conversation: fetch the client a
// moment early. Never on touch: on iOS the client installs an audio-unlock listener for the
// rest of the visit as soon as it loads, which only a conversation should cause.
let warmed = false
export function warmClient() {
  if (warmed || isMock()) return
  warmed = true
  import('@elevenlabs/client').catch(() => {
    warmed = false
  })
}

export const briefSent = () => read('cg-brief-sent') === '1'
export const rememberBrief = () => write('cg-brief-sent', '1')

// One id per visit, so the turns of a visit group in ElevenLabs' history; nothing outlives it.
function visitor() {
  let id = read('cg-visitor', 'sessionStorage')
  if (!id) {
    id = window.crypto?.randomUUID?.() ?? `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    write('cg-visitor', id, 'sessionStorage')
  }
  return id
}

function referrerHost() {
  try {
    const { host } = new URL(document.referrer)
    return host !== window.location.host && REFERRER_HOST.test(host) ? host : ''
  } catch {
    return ''
  }
}

function utmSource() {
  const value = new URLSearchParams(window.location.search).get('utm_source') ?? ''
  return UTM_SOURCE.test(value) ? value : ''
}

// What the agent hears once the visitor sends the brief card; its data collection reads it.
const field = (value) => String(value ?? '').replace(/[;\r\n]+/g, ',').trim()
export const briefMessage = (brief) =>
  `[Brief sent] Name: ${field(brief.name)}; Email: ${field(brief.email)}; Company: ${field(brief.company)}; Building: ${field(brief.building)}; Stuck: ${field(brief.stuck)}; Timeline: ${field(brief.timeline)}`

async function route(mode, signal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ROUTE_MS)
  const stop = () => controller.abort()
  signal?.addEventListener('abort', stop)
  try {
    const response = await fetch(`/api/concierge/session?mode=${mode}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new SessionError(response.status)
    const body = await response.json()
    if (mode === 'voice' ? !body.conversationToken : !body.signedUrl) throw new SessionError(502)
    return body
  } catch (error) {
    check(signal)
    throw error instanceof SessionError ? error : new SessionError(0)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', stop)
  }
}

// A session that has not started in time, or whose visitor has left, is given up; if it starts
// later all the same, it is ended at once.
function within(started, ms, signal) {
  let timer = 0
  let stop = null
  const late = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new SessionError(504)), ms)
    stop = () => reject(aborted())
    signal?.addEventListener('abort', stop)
  })
  const settle = () => {
    clearTimeout(timer)
    signal?.removeEventListener('abort', stop)
  }
  return Promise.race([started, late]).then(
    (conversation) => {
      settle()
      return conversation
    },
    (error) => {
      settle()
      started.then(
        (conversation) => conversation.endSession().catch(() => {}),
        () => {},
      )
      throw error
    },
  )
}

// mode: 'voice' (WebRTC, conversation token) or 'text' (WebSocket, signed URL).
// greeting: the agent's first line. silent: no first line, the visitor speaks first (a chip).
// entry, area: where the visitor came from and what was on screen, for the agent's context.
// signal: aborted when the visitor closes, ends or switches before the session is up.
export async function connect({ mode, greeting, silent, entry, area, callbacks, clientTools, signal }) {
  const options = {
    ...callbacks,
    clientTools,
    workletPaths: WORKLETS,
    userId: visitor(),
    dynamicVariables: {
      greeting,
      entry_point: entry,
      entry_section: area,
      referrer_host: referrerHost(),
      utm_source: utmSource(),
      brief_already_sent: briefSent() ? 'true' : 'false',
    },
    ...(silent ? { overrides: { agent: { firstMessage: '' } } } : {}),
  }
  check(signal)
  if (isMock()) {
    const failure = read('cg-mock-route')
    if (failure) throw new SessionError(Number(failure) || 503)
    const { startMock } = await import('./mock')
    check(signal)
    return within(startMock({ ...options, textOnly: mode === 'text' }), START_MS, signal)
  }
  const client = import('@elevenlabs/client')
  client.catch(() => {})
  const session = await route(mode, signal)
  check(signal)
  const { Conversation } = await client
  check(signal)
  const started =
    mode === 'voice'
      ? Conversation.startSession({ ...options, conversationToken: session.conversationToken, connectionType: 'webrtc' })
      : Conversation.startSession({ ...options, signedUrl: session.signedUrl, textOnly: true })
  return within(started, START_MS, signal)
}
