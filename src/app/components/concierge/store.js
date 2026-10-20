// The concierge's state, kept outside React: Panel.jsx renders snapshots of it
// (useSyncExternalStore) and every change happens here, from a click or from the conversation's
// callbacks. One panel, one store, one conversation at a time.
import { CONCIERGE as C, MAILTO, PERSON } from '@/content/site'
import { briefMessage, connect, micPermission, rememberBrief, requestMic } from './session'
import { clearRings, inView, named, pageArea, pageContext, showSection, still } from './tools'

const PHONE = '(max-width: 600px)'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const WORD_MS = 330 // while the agent speaks, the caption lights a word this often
const CONTEXT_CHARS = 1500 // the most of a typed conversation passed on to a voice one
// The brief card's fields and the most each may hold.
export const LIMITS = { name: 120, email: 200, company: 120, building: 400, stuck: 400, timeline: 120 }

const blank = () => ({
  view: 'start', // 'start' | 'live'
  mode: null, // the footer: 'text' (composer) | 'voice' (controls) | null
  entry: 'launcher', // where the visitor opened it: 'launcher' | 'chip' | 'contact'
  phone: false, // opened on a phone: a modal sheet
  call: false, // the conversation is a voice call
  connected: false,
  status: 'ready', // a key of CONCIERGE.status
  tone: 'ready', // the status dot: ready | listening | speaking | thinking
  log: [], // the conversation, cards and the brief
  waiting: false, // the agent has been asked and has not started its reply
  streaming: false,
  muted: false,
  compact: false,
  voicebar: false,
  caption: [], // the words of the agent's latest reply, in voice
  lit: 0, // how many of them it has said
  heard: '', // the visitor's latest words, in voice
  focus: null, // { to, n }: where Panel.jsx moves focus next
})

let state = blank()
const listeners = new Set()
function set(patch) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

let seq = 0 // ids for log entries and focus requests
let attempt = 0 // bumped by every start, stop and failure: callbacks of an older conversation are dropped
let conversation = null
let pending = null // a start under way: { controller, stream }, so leaving can cancel it
let deferred = 0
let stream = null // the reply being streamed: { id, done }
let streamed = new Set() // event and response ids shown from streamed parts
let lastStreamed = ''
let echoes = [] // what the visitor typed (and the notes sent for them), to drop the echo
let queued = [] // typed before the session was up
let speakMs = 0
let speaking = false
let flow = {} // what a card's buttons carry on with: { chip, context }
let shownKey = null // the part of the page the conversation last brought up

const next = () => ++seq
const focus = (to) => ({ to, n: next() })
const status = (key, tone = 'ready') => ({ status: key, tone })
const append = (log, entry) => [...log, { id: next(), ...entry }]
const squash = (text) => String(text ?? '').replace(/\s+/g, '').toLowerCase()
const words = (text) => String(text ?? '').split(/\s+/).filter(Boolean)
const chipLabel = (id) => C.chips.find((chip) => chip.id === id)?.label ?? null
const withoutCards = () => state.log.filter((entry) => entry.k !== 'card')
const openBrief = () => state.log.some((entry) => entry.k === 'brief' && !entry.sent)
const patchEntry = (id, patch) => state.log.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
const stopTracks = (media) => media?.getTracks?.().forEach((track) => track.stop())
// In voice, the orb shrinks once the conversation has some length to it.
const compactWith = (log) => state.compact || (state.call && state.mode === 'voice' && log.length > 3)

function dataCall(on) {
  if (on) document.documentElement.dataset.call = 'on'
  else delete document.documentElement.dataset.call
}

// Ends the conversation, if there is one, without a word in the panel: a start still under way
// is cancelled (the route request, the session, the microphone the visitor allowed).
function drop() {
  attempt += 1
  clearTimeout(deferred)
  if (pending) {
    pending.controller.abort()
    stopTracks(pending.stream)
    pending = null
  }
  const old = conversation
  conversation = null
  if (old) {
    try {
      old.endSession().catch(() => {})
    } catch {}
  }
  dataCall(false)
  stream = null
  streamed = new Set()
  lastStreamed = ''
  echoes = []
  queued = []
  speakMs = 0
  speaking = false
  shownKey = null
  return attempt
}

const reset = (patch) => ({
  ...status('ready'),
  call: false,
  connected: false,
  waiting: false,
  streaming: false,
  muted: false,
  compact: false,
  voicebar: false,
  caption: [],
  lit: 0,
  heard: '',
  ...patch,
})

// The typed conversation so far, for a voice one that takes over from it.
function transcript() {
  const lines = state.log
    .filter((entry) => entry.k === 'user' || entry.k === 'agent')
    .map((entry) => `${entry.k === 'user' ? C.visitor : C.agent}: ${entry.text}`)
  if (!lines.length) return ''
  return `${C.switched}\n${lines.join('\n').slice(-CONTEXT_CHARS)}`
}

// ---------------------------------------------------------------- starting

// A chip's question shows as the visitor's own words; `auto` marks it as not typed by them, so
// the consent line stays until they write or say something themselves.
function startText({ chip = null, context = '' } = {}, later = false) {
  const a = drop()
  const label = chipLabel(chip)
  let log = context ? withoutCards() : []
  if (label) log = append(log, { k: 'user', text: label, auto: true })
  if (label) echoes.push(squash(label))
  set(reset({ view: 'live', mode: 'text', log, waiting: true, ...status('connecting', 'thinking'), focus: focus('input') }))
  const go = () => a === attempt && begin(a, { mode: 'text', chip: label ? chip : null, context })
  if (later) deferred = setTimeout(go, 0)
  else go()
}

// Talk: straight in when the microphone is already allowed, else the explainer first (or the
// blocked card), so the browser's prompt only ever follows the visitor's own click.
function talk({ chip = null, context = '' } = {}, later = false) {
  const a = drop()
  set(reset({ view: 'live', mode: null, log: context ? withoutCards() : [] }))
  const go = async () => {
    const permission = await micPermission()
    if (a !== attempt) return
    if (permission === 'granted') startVoice({ chip, context }, requestMic())
    else showCard(permission === 'denied' ? 'blocked' : 'mic', { chip, context })
  }
  if (later) deferred = setTimeout(go, 0)
  else go()
}

function startVoice({ chip = null, context = '' } = {}, mic) {
  const a = drop()
  // A chip that has no spoken greeting of its own is asked aloud for the visitor, as in text.
  const asked = chip && !C.greetings[chip] ? chipLabel(chip) : null
  let log = withoutCards()
  if (asked) log = append(log, { k: 'user', text: asked, auto: true })
  if (asked) echoes.push(squash(asked))
  set(reset({ view: 'live', mode: 'voice', call: true, log, compact: log.length > 3, voicebar: state.phone, ...status('connecting', 'thinking'), focus: focus('mute') }))
  begin(a, { mode: 'voice', chip: chipLabel(chip) ? chip : null, context, mic })
}

async function begin(a, { mode, chip, context, mic }) {
  const silent = !!chip && (mode === 'text' || !C.greetings[chip])
  const greeting = context ? C.greetings.resume : (mode === 'voice' && C.greetings[chip]) || C.greetings.launcher
  const carry = { chip, context }
  const mine = { controller: new AbortController(), stream: null }
  pending = mine
  try {
    if (mic) {
      let media = null
      try {
        media = await mic
      } catch (error) {
        if (a === attempt) micFailed(error, carry)
        return
      }
      // Left while the browser asked: the microphone closes at once.
      if (pending !== mine) {
        stopTracks(media)
        return
      }
      // The visitor's own stream only opened the door to the microphone; the client opens its
      // own, so this one closes once the session is up (or has failed).
      mine.stream = media
    }
    const started = await connect({
      mode,
      greeting,
      silent,
      entry: state.entry,
      area: pageArea(),
      callbacks: callbacks(a),
      clientTools: tools(a),
      signal: mine.controller.signal,
    })
    if (a !== attempt) {
      started.endSession().catch(() => {})
      return
    }
    if (started.isOpen && !started.isOpen()) {
      failed(new Error('The session closed as it started'), carry)
      return
    }
    conversation = started
    connected(mode, { chip, silent, context })
  } catch (error) {
    if (a === attempt) failed(error, carry)
  } finally {
    stopTracks(mine.stream)
    mine.stream = null
    if (pending === mine) pending = null
  }
}

// Up. Whatever the visitor chose while it connected (mute, typing instead) now reaches the call.
function connected(mode, { chip, silent, context }) {
  if (mode === 'voice') {
    dataCall(true)
    const typing = state.mode === 'text'
    if (state.muted || typing) conversation.setMicMuted(true)
    if (typing) conversation.setVolume?.({ volume: 0 })
    const now = typing ? (state.waiting ? status('typing', 'thinking') : status('text')) : speaking ? status('speaking', 'speaking') : status(state.muted ? 'muted' : 'listening', 'listening')
    set({ connected: true, ...now })
  } else {
    set({ connected: true, ...(state.waiting ? status('typing', 'thinking') : status('text')) })
  }
  if (context) conversation.sendContextualUpdate?.(context)
  const label = chipLabel(chip)
  if (silent && label) conversation.sendUserMessage(label)
  for (const text of queued) conversation.sendUserMessage(text)
  queued = []
}

// The microphone said no: refused (blocked), held by another app (busy), or not there (nomic).
function micFailed(error, carry) {
  drop()
  const name = error?.name
  if (name === 'NotReadableError' || name === 'AbortError') showCard('busy', carry)
  else if (name === 'NotFoundError' || name === 'OverconstrainedError') showCard('nomic', carry)
  else showCard('blocked', carry)
}

// The route or the session failed. The attempt is closed, so a session that starts after all is
// ended (session.js) and its callbacks are dropped.
function failed(error, carry) {
  drop()
  showCard('resting', carry)
}

function showCard(kind, carry = {}) {
  flow = carry
  set(
    reset({
      view: 'live',
      mode: null,
      ...status(kind === 'blocked' ? 'blocked' : kind === 'resting' ? 'resting' : 'ready'),
      log: append(withoutCards(), { k: 'card', kind }),
      focus: focus('card'),
    }),
  )
}

// ---------------------------------------------------------------- the conversation

function callbacks(a) {
  const live =
    (handle) =>
    (...args) => {
      if (a === attempt) handle(...args)
    }
  return {
    onModeChange: live(modeChange),
    onMessage: live(message),
    onAgentChatResponsePart: live(part),
    onAgentResponseCorrection: live(correction),
    onInterruption: live(interrupted),
    onDisconnect: live(disconnected),
    // The client reports errors in the console itself; one that ends the session ends up in
    // onDisconnect, and a session that never starts rejects in begin().
    onError: () => {},
  }
}

// The client tools, by the names the agent knows them by.
function tools(a) {
  return {
    fill_brief: (params) => {
      if (a === attempt) showBrief(params)
      return 'The brief card is on screen. Ask the visitor to check it and press Send.'
    },
    get_page_context: () => pageContext(),
  }
}

function modeChange({ mode }) {
  if (!state.call) return
  speaking = mode === 'speaking'
  if (state.mode !== 'voice') return
  if (speaking) set({ ...status('speaking', 'speaking'), heard: '' })
  else set({ ...status(state.muted ? 'muted' : 'listening', 'listening'), lit: state.caption.length })
}

const caption = (text, fresh) => {
  if (!state.call) return {}
  const list = words(text)
  return { caption: list, lit: still() ? list.length : fresh ? 0 : Math.min(state.lit, list.length) }
}

const settled = () => (state.mode === 'text' ? status('text') : {})

// The page follows the reply (tools.js): the part it names comes up and the conversation notes
// it, unless that part was the last shown and is still in view.
function follow(text) {
  const key = named(text)
  if (!key || (key === shownKey && inView(key))) return
  if (!showSection(key)) return
  shownKey = key
  set({ log: append(state.log, { k: 'act', text: C.places[key] }) })
}

// What the agent said last in this turn (only notes of the page in between), squashed. A reply
// that only says it again is held back: a safety net, should the platform ever answer twice.
function lastReply() {
  for (let i = state.log.length - 1; i >= 0; i -= 1) {
    const entry = state.log[i]
    if (entry.k !== 'act') return entry.k === 'agent' ? squash(entry.text) : ''
  }
  return ''
}
const echoing = (text) => !!stream?.echo && stream.echo.startsWith(squash(text))

function message({ role, message: text, event_id: eventId, response_id: responseId }) {
  if (!text) return
  if (role === 'user') {
    const echo = echoes.indexOf(squash(text))
    if (echo >= 0) {
      echoes.splice(echo, 1)
      return
    }
    if (text.startsWith('[Brief')) return
    const log = append(state.log, { k: 'user', text })
    const voice = state.call && state.mode === 'voice'
    set({ log, compact: compactWith(log), ...(voice ? { heard: text, ...status('thinking', 'thinking') } : {}) })
    return
  }
  // An agent reply is shown from its streamed parts; this is the fallback for one that had none.
  if ((stream && !stream.done) || streamed.has(`e${eventId}`) || (responseId && streamed.has(`r${responseId}`)) || squash(text) === lastStreamed || squash(text) === lastReply()) return
  speakMs = 0
  const log = append(state.log, { k: 'agent', text, done: true })
  set({ log, waiting: false, compact: compactWith(log), ...caption(text, true), ...settled() })
  follow(text)
}

function part({ type, text = '', event_id: eventId, response_id: responseId }) {
  if (eventId != null) streamed.add(`e${eventId}`)
  if (responseId) streamed.add(`r${responseId}`)
  const open = stream && !stream.done
  // A late part of an older reply (one the visitor talked over) is dropped; a part of a newer
  // reply whose start went missing opens it.
  const other = open && eventId != null && stream.eventId != null && eventId !== stream.eventId
  if (other && eventId < stream.eventId) return
  if (type === 'start' || !open || other) {
    if (open) finishReply()
    if (type === 'stop' && !text) return
    stream = { id: next(), done: false, eventId, echo: lastReply() }
    speakMs = 0
    const hidden = echoing(text)
    const log = [...state.log, { id: stream.id, k: 'agent', text, done: false, hidden }]
    set({ log, waiting: false, streaming: true, compact: compactWith(log), ...(hidden ? {} : caption(text, true)), ...(state.mode === 'text' ? status('typing', 'thinking') : {}) })
  } else if (text) {
    const reply = state.log.find((entry) => entry.id === stream.id)
    const joined = `${reply?.text ?? ''}${text}`
    const hidden = echoing(joined)
    set({ log: patchEntry(stream.id, { text: joined, hidden }), ...(hidden ? {} : caption(joined, !!reply?.hidden)) })
  }
  if (type === 'stop') finishReply()
}

// A reply with no words, or one that only said again what the agent had just said, goes; one
// that stays brings up the part of the page it names.
function finishReply() {
  const reply = state.log.find((entry) => entry.id === stream.id)
  const text = String(reply?.text ?? '').trim()
  const kept = !!text && !reply.hidden
  if (kept) lastStreamed = squash(text)
  set({ log: kept ? patchEntry(stream.id, { done: true }) : state.log.filter((entry) => entry.id !== stream.id), streaming: false, ...settled() })
  stream = { ...stream, done: true }
  if (kept) follow(text)
}

// The visitor talked over the agent: the reply being streamed stops there.
function interrupted() {
  if (stream && !stream.done) finishReply()
}

// The reply the agent was cut short in ends where the visitor came in.
function correction({ corrected_agent_response: text }) {
  if (stream && !stream.done) finishReply()
  if (!text) return
  const reply = [...state.log].reverse().find((entry) => entry.k === 'agent')
  if (!reply) return
  lastStreamed = squash(text)
  set({ log: patchEntry(reply.id, { text, done: true }), ...(state.call ? { caption: words(text), lit: words(text).length } : {}) })
}

function disconnected(details) {
  const call = state.call
  drop()
  ending(details?.reason === 'user' && call ? 'callEnded' : 'ended')
}

function ending(note) {
  set(reset({ mode: null, log: append(state.log, { k: 'end', note }), focus: focus('again') }))
}

// ---------------------------------------------------------------- the brief card

const clean = (values) => Object.fromEntries(Object.entries(LIMITS).map(([key, max]) => [key, String(values?.[key] ?? '').trim().slice(0, max)]))

function showBrief(params) {
  const data = clean(params)
  const current = state.log.find((entry) => entry.k === 'brief' && !entry.sent)
  const log = current ? patchEntry(current.id, { data, rev: next(), error: null }) : append(state.log, { k: 'brief', data, rev: next(), error: null, sent: false })
  // In voice there is nothing to type in but the card, so focus goes to what it still needs.
  const missing = !data.name ? 'name' : !EMAIL.test(data.email) ? 'email' : null
  set({ log, voicebar: false, compact: state.call || state.compact, ...(state.call && state.mode === 'voice' && missing ? { focus: focus(`field:${missing}`) } : {}) })
}

// With the conversation over, the brief can still go: as an email the visitor sends.
function mailBrief(data) {
  const lines = ['name', 'email', 'company', 'building', 'stuck', 'timeline'].map((key) => `${C.brief[key]}: ${data[key]}`)
  const subject = new URL(MAILTO).searchParams.get('subject') ?? ''
  window.location.href = `mailto:${PERSON.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`
}

// ---------------------------------------------------------------- what the panel calls

export const store = {
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  get: () => state,
  conversation: () => conversation,
  speaking: () => speaking,

  // A new request from the launcher, a chip or the Contact entry. Starting a conversation waits
  // a tick, so a panel mounted twice in development starts one. A chip the page does not have
  // opens the start screen instead.
  open(request) {
    drop()
    clearRings()
    const chip = chipLabel(request?.chip) ? request.chip : null
    state = { ...blank(), phone: window.matchMedia(PHONE).matches, entry: request?.entry ?? 'launcher' }
    if (request?.mode === 'voice') talk({ chip }, true)
    else if (chip || request?.mode === 'text') startText({ chip }, true)
    else set({ focus: focus('chip') })
  },
  close() {
    drop()
    clearRings()
    state = blank()
  },

  chip(id) {
    set({ entry: 'chip' })
    startText({ chip: id })
  },
  type: () => startText(),
  talk: () => talk(),
  // In the visitor's click: the microphone is asked for before anything else happens.
  allowMic: () => startVoice(flow, requestMic()),
  typeInstead: () => startText(flow),
  retry: () => talk(flow),

  send(text) {
    const value = String(text ?? '').trim().slice(0, 600)
    if (!value || state.mode !== 'text') return false
    echoes.push(squash(value))
    set({ log: append(state.log, { k: 'user', text: value }), waiting: true, ...status('typing', 'thinking') })
    if (conversation) conversation.sendUserMessage(value)
    else queued.push(value)
    return true
  },
  // Typing in a call keeps the agent from taking the silence as the end of the conversation.
  activity: () => conversation?.sendUserActivity?.(),

  // Before the call is up these only change the panel; connected() applies them.
  toggleMute() {
    if (!state.call) return
    const muted = !state.muted
    conversation?.setMicMuted(muted)
    set({ muted, ...(state.mode === 'voice' && state.connected && !speaking ? status(muted ? 'muted' : 'listening', 'listening') : {}) })
  },
  // In a call, typing mutes the microphone and the agent's voice; the call goes on.
  toText() {
    if (!state.call) return
    conversation?.setMicMuted(true)
    conversation?.setVolume?.({ volume: 0 })
    set({ mode: 'text', voicebar: false, ...(state.connected ? status('text') : {}), focus: focus('input') })
  },
  toVoice() {
    if (!state.call) {
      talk({ context: transcript() })
      return
    }
    conversation?.setMicMuted(state.muted)
    conversation?.setVolume?.({ volume: 1 })
    const now = !state.connected ? status('connecting', 'thinking') : speaking ? status('speaking', 'speaking') : status(state.muted ? 'muted' : 'listening', 'listening')
    set({ mode: 'voice', voicebar: state.phone && !openBrief(), ...now, lit: still() ? state.caption.length : state.lit, focus: focus('mute') })
  },
  end() {
    const call = state.call
    drop()
    ending(call ? 'callEnded' : 'ended')
  },
  again() {
    drop()
    clearRings()
    set(reset({ view: 'start', mode: null, log: [], focus: focus('chip') }))
  },

  submitBrief(id, values) {
    const brief = state.log.find((entry) => entry.id === id)
    if (!brief || brief.sent) return
    const data = clean(values)
    const error = !data.name ? { field: 'name', text: C.brief.noName } : !EMAIL.test(data.email) ? { field: 'email', text: C.brief.noEmail } : null
    if (error) {
      set({ log: patchEntry(id, { data, error }), focus: focus(`field:${error.field}`) })
      return
    }
    if (!conversation || (conversation.isOpen && !conversation.isOpen())) {
      mailBrief(data)
      return
    }
    const note = briefMessage(data)
    echoes.push(squash(note))
    conversation.sendUserMessage(note)
    rememberBrief()
    const text = state.mode === 'text'
    set({ log: patchEntry(id, { data, error: null, sent: true }), ...(text ? { waiting: true, ...status('typing', 'thinking') } : {}), focus: focus(text ? 'input' : 'sent') })
  },
  laterBrief(id) {
    set({ log: state.log.filter((entry) => entry.id !== id), focus: focus(state.mode === 'text' ? 'input' : state.mode === 'voice' ? 'mute' : 'again') })
    if (!conversation) return
    echoes.push(squash(C.notSent))
    conversation.sendUserMessage(C.notSent)
    if (state.mode === 'text') set({ waiting: true, ...status('typing', 'thinking') })
  },
  async copyMail(id) {
    try {
      await navigator.clipboard.writeText(PERSON.email)
      set({ log: patchEntry(id, { copied: 'done' }) })
    } catch {
      // No clipboard: select the address so Ctrl+C works.
      const mail = document.getElementById(`cg-mail-${id}`)
      if (mail) {
        const range = document.createRange()
        range.selectNodeContents(mail)
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
      }
      set({ log: patchEntry(id, { copied: 'fallback' }) })
    }
  },

  // The caption follows the agent's voice: a word every WORD_MS while it speaks (from the orb's
  // frame loop), all of them once it stops, and all at once when motion is reduced or paused.
  tick(ms, talking) {
    if (!talking || state.lit >= state.caption.length) return
    speakMs += ms
    const lit = Math.min(state.caption.length, Math.floor(speakMs / WORD_MS) + 1)
    if (lit !== state.lit) set({ lit })
  },
  lightAll() {
    if (state.lit < state.caption.length) set({ lit: state.caption.length })
  },
}
