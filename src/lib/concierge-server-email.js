// The email the post-call webhook sends after a conversation worth reading, built from an
// ElevenLabs post_call_transcription payload (src/app/api/concierge/post-call/route.js). Pure: no
// network and no environment. Every value in the payload is visitor or model text, so it is
// escaped in the HTML part, flattened into one line in the subject and cut to a sane length.

const HISTORY_URL = 'https://elevenlabs.io/app/agents/history/'
// Everything below comes from a visitor and the AI, so the email says so before anything else.
const UNVERIFIED = 'Written by a visitor and the AI concierge; contact details are unverified.'
const TURNS_SHOWN = 30
const FIELD_MAX = 2000
const PROSE_MAX = 4000

// data_collection_results ids, in the order the email lists them. Unanswered questions get a
// section of their own.
const FIELDS = [
  ['visitor_name', 'Name'],
  ['visitor_email', 'Email'],
  ['company', 'Company'],
  ['role', 'Role'],
  ['building', 'Building'],
  ['problem_summary', 'Stuck on'],
  ['practice_match', 'Practice'],
  ['timeline', 'Timeline'],
  ['found_via', 'Found via'],
  ['visitor_type', 'Visitor type'],
  ['fit', 'Fit'],
  ['brief_sent', 'Brief sent'],
]

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ENTITIES[c])

// Tab and newline stay; every other control character (C0, DEL, C1) goes.
function printable(char) {
  const code = char.codePointAt(0)
  return code === 9 || code === 10 || (code >= 32 && code !== 127 && (code < 128 || code > 159))
}

// Invisible and direction-changing characters, which could disguise a name or a link.
const HIDDEN = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g

function prose(value, max) {
  if (typeof value === 'number' || typeof value === 'boolean') value = String(value)
  if (typeof value !== 'string') return ''
  const clean = value.slice(0, max * 4).toWellFormed().replace(HIDDEN, '').replace(/\r\n?/g, '\n')
  const chars = Array.from(clean).filter(printable)
  const text = chars.join('').trim()
  const kept = Array.from(text)
  return kept.length > max ? `${kept.slice(0, max - 1).join('')}…` : text
}

// A field the analysis could not fill comes back null, or now and then as a word that says so.
const UNFILLED = /^(?:none|null|nil|n\/?a|unknown|undefined|not (?:provided|given|mentioned|specified|stated|applicable)|-+)$/i
const field = (value, max = FIELD_MAX) => {
  const text = prose(value, max)
  return UNFILLED.test(text) ? '' : text
}

const yes = (value) => value === true || (typeof value === 'string' && /^(?:true|yes)$/i.test(value.trim()))
const no = (value) => value === false || (typeof value === 'string' && /^(?:false|no)$/i.test(value.trim()))

// Strict on purpose: a reply_to that Resend refuses would fail the whole send, so an unusual
// address stays in the body and out of the header.
const EMAIL = /^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/
const replyAddress = (email) => (email.length <= 254 && email.indexOf('@') <= 64 && EMAIL.test(email) ? email : undefined)

function turnsOf(transcript) {
  if (!Array.isArray(transcript)) return []
  const turns = []
  for (const turn of transcript) {
    const who = turn?.role === 'user' ? 'Visitor' : turn?.role === 'agent' ? 'Concierge' : null
    const message = who ? prose(turn.message, PROSE_MAX) : ''
    if (message) turns.push({ who, message })
  }
  return turns
}

const oneLine = (text, max) => prose(text.replace(/\s+/g, ' '), max)

// The line the panel writes into the conversation when the visitor presses Send on the brief
// card: "[Brief sent] Name: …; Email: …; Company: …; …". It is the only proof a brief was sent
// (the analysis can guess wrong), and its email is the one the visitor typed and checked.
function briefFrom(transcript) {
  if (!Array.isArray(transcript)) return null
  for (let i = transcript.length - 1; i >= 0; i--) {
    const turn = transcript[i]
    const message = turn?.role === 'user' && typeof turn.message === 'string' ? turn.message.trim() : ''
    if (!message.startsWith('[Brief sent]')) continue
    const parts = {}
    for (const part of message.slice('[Brief sent]'.length).split(';')) {
      const colon = part.indexOf(':')
      if (colon > 0) parts[part.slice(0, colon).trim().toLowerCase()] = part.slice(colon + 1).trim()
    }
    return { name: prose(parts.name ?? '', 80), email: replyAddress(prose(parts.email ?? '', 254)) }
  }
  return null
}

// The visitor's confirmation. Fixed words: the only thing taken from the visitor is a first name
// made of letters, so the email cannot carry anyone else's message to the address they typed.
const ACK_SUBJECT = 'Your brief reached Naman'
function ackEmail(brief) {
  const first = (brief.name.split(/\s+/)[0] ?? '').replace(/[^\p{L}'’-]/gu, '').slice(0, 30)
  const lines = [
    first ? `Hi ${first},` : 'Hi,',
    '',
    'Thanks for your brief. I read every one myself and reply within one business day, with questions or a time to talk.',
    '',
    'Naman Bhayana',
    'namanbhayana.com',
    '',
    'You are getting this because a brief was sent from namanbhayana.com with this address. If that was not you, you can ignore this email.',
  ]
  const html = `<!doctype html><html><body style="margin:0;padding:24px;font:15px/1.6 Arial,Helvetica,sans-serif;color:#111;background:#fff">${lines
    .map((line) => (line ? `<p style="margin:0 0 4px">${escapeHtml(line)}</p>` : '<p style="margin:0 0 12px"></p>'))
    .join('')}</body></html>`
  return { to: brief.email, subject: ACK_SUBJECT, text: lines.join('\n'), html }
}

// null when the payload has no usable conversation id (it names the email's idempotency key and
// the link). Otherwise { id, qualifies } and, when it qualifies, the email itself.
export function leadEmail(data) {
  const id = data?.conversation_id
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null
  const results = data.analysis?.data_collection_results
  const raw = (key) => (results && typeof results === 'object' ? results[key]?.value : undefined)
  const values = Object.fromEntries(
    FIELDS.map(([key]) => [key, key === 'brief_sent' ? (yes(raw(key)) ? 'Yes' : no(raw(key)) ? 'No' : '') : field(raw(key))]),
  )
  const brief = briefFrom(data.transcript)
  const email = brief?.email || values.visitor_email
  const briefSent = Boolean(brief) || values.brief_sent === 'Yes'
  if (brief) values.brief_sent = 'Yes'
  const turns = turnsOf(data.transcript)
  const visitorTurns = turns.filter((t) => t.who === 'Visitor').length
  // Worth an email: the visitor left an address, sent a brief or stayed for three turns.
  const qualifies = Boolean(email) || briefSent || visitorTurns >= 3
  if (!qualifies) return { id, qualifies }

  const subject = (
    email || briefSent
      ? [`Brief: ${oneLine(values.company || values.visitor_name || email || 'a visitor', 80)}`, oneLine(values.practice_match, 60)]
      : ['Concierge conversation', oneLine(values.visitor_type, 60)]
  )
    .filter(Boolean)
    .join(' · ')
  const rows = FIELDS.map(([key, label]) => [label, values[key]]).filter(([, value]) => value)
  const summary = field(data.analysis?.transcript_summary, PROSE_MAX)
  const unanswered = field(raw('unanswered_questions'))
  const shown = turns.slice(-TURNS_SHOWN)
  const heading = turns.length > shown.length ? `Transcript, last ${shown.length} of ${turns.length} turns` : 'Transcript'
  const link = HISTORY_URL + id

  const text = [
    subject,
    UNVERIFIED,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(summary ? ['', 'Summary', summary] : []),
    ...(unanswered ? ['', 'Unanswered questions', unanswered] : []),
    ...(shown.length ? ['', heading, ...shown.map((t) => `${t.who}: ${t.message}`)] : []),
    '',
    `Conversation ${id}`,
    link,
  ].join('\n')

  const esc = (value) => escapeHtml(value).replace(/\n/g, '<br>')
  const h2 = (title) => `<h2 style="font-size:15px;margin:24px 0 8px">${esc(title)}</h2>`
  const cell = 'padding:2px 16px 2px 0;color:#555;vertical-align:top;white-space:nowrap'
  const html = [
    '<!doctype html><html><body style="margin:0;padding:24px;font:15px/1.5 Arial,Helvetica,sans-serif;color:#111;background:#fff">',
    `<h1 style="font-size:18px;margin:0 0 4px">${esc(subject)}</h1>`,
    `<p style="margin:0 0 16px;color:#555;font-size:13px">${esc(UNVERIFIED)}</p>`,
    rows.length
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows
          .map(([label, value]) => `<tr><td style="${cell}">${esc(label)}</td><td style="padding:2px 0">${esc(value)}</td></tr>`)
          .join('')}</table>`
      : '',
    summary ? `${h2('Summary')}<p style="margin:0">${esc(summary)}</p>` : '',
    unanswered ? `${h2('Unanswered questions')}<p style="margin:0">${esc(unanswered)}</p>` : '',
    shown.length ? `${h2(heading)}${shown.map((t) => `<p style="margin:0 0 8px"><strong>${esc(t.who)}</strong>: ${esc(t.message)}</p>`).join('')}` : '',
    `<p style="margin:24px 0 0"><a href="${escapeHtml(link)}">Open the conversation in ElevenLabs</a><br><span style="color:#555">${esc(id)}</span></p>`,
    '</body></html>',
  ].join('')

  return { id, qualifies, subject, text, html, replyTo: replyAddress(email), ack: brief?.email ? ackEmail(brief) : null }
}
