#!/usr/bin/env node
// Checks the concierge's two routes against a running server (npm run build && npm start).
//
//   node scripts/qa/concierge-routes.mjs [baseUrl]          default http://127.0.0.1:3000
//
// Signs test webhooks with ELEVENLABS_WEBHOOK_SECRET and ELEVENLABS_AGENT_ID, read the way
// next start reads them: the environment first, then .env.local. Each run is a fresh visitor (an
// X-Forwarded-For address from a documentation range), which only a server without a proxy in
// front honours; behind Vercel the platform sets that header, so the rate check there needs a
// minute between runs. With the server's ElevenLabs key set, a run mints about six short-lived
// session credentials; with CONCIERGE_RESEND_KEY set, it sends one test email to CONCIERGE_TO.
// Never prints a token, a signed URL or a secret: statuses, error codes and field names only.
// Prints one PASS / FAIL / WARN / SKIP line per check and exits 1 when anything FAILs.
import { createHmac, randomBytes, randomInt } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// The libraries are ESM inside a typeless package; Node reparses them and warns. Keep output clean.
const emitWarning = process.emitWarning
process.emitWarning = (w, ...rest) => {
  const code = (rest[0] && rest[0].code) || rest[1] || (w && w.code)
  if (code === 'MODULE_TYPELESS_PACKAGE_JSON' || /Reparsing as ES module/.test(String(w))) return
  return emitWarning.call(process, w, ...rest)
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const argv = process.argv.slice(2)
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node scripts/qa/concierge-routes.mjs [baseUrl]')
  process.exit(0)
}
let BASE
try {
  BASE = new URL(argv.find((a) => !a.startsWith('--')) || 'http://127.0.0.1:3000').origin
} catch {
  console.error('concierge-routes: the argument must be an absolute base URL')
  process.exit(2)
}

// ---------------------------------------------------------------- environment

function readEnvFile(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    let value = m[2].trim()
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, '')
    out[m[1]] = value
  }
  return out
}
const envFile = readEnvFile(path.join(REPO_ROOT, '.env.local'))
const env = (name) => process.env[name] ?? envFile[name] ?? ''
const SECRET = env('ELEVENLABS_WEBHOOK_SECRET')
const AGENT_ID = env('ELEVENLABS_AGENT_ID')
const RESEND_SET = env('CONCIERGE_RESEND_KEY') !== ''

// ---------------------------------------------------------------- reporting

const counts = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 }
function report(status, id, detail = '') {
  counts[status]++
  console.log(`${status.padEnd(4)}  ${id.padEnd(26)} ${String(detail).replace(/\s+/g, ' ').trim()}`)
}
const pass = (id, d) => report('PASS', id, d)
const fail = (id, d) => report('FAIL', id, d)
const warn = (id, d) => report('WARN', id, d)
const skip = (id, d) => report('SKIP', id, d)
const check = (problems, id, okDetail) => (problems.length ? fail(id, problems.join('; ')) : pass(id, okDetail))

console.log(`concierge-routes  base=${BASE}  secret=${SECRET ? 'set' : 'missing'}  agent=${AGENT_ID ? 'set' : 'missing'}  resend=${RESEND_SET ? 'set' : 'empty'}`)

// ---------------------------------------------------------------- the libraries, without a server

// What the routes cannot show from outside: every payload value is escaped in the HTML email, the
// subject is one line, and only a conversation worth reading qualifies.
const { leadEmail } = await import(pathToFileURL(path.join(REPO_ROOT, 'src', 'lib', 'concierge-server-email.js')).href)
const { signedByElevenLabs, visitorKey } = await import(pathToFileURL(path.join(REPO_ROOT, 'src', 'lib', 'concierge-server.js')).href)

const HOSTILE = '<script>alert(1)</script> "quoted" & \'single\' <img src=x onerror=alert(1)>'
const collected = (values) =>
  Object.fromEntries(
    Object.entries(values).map(([id, value]) => [
      id,
      { data_collection_id: id, value, json_schema: { type: typeof value === 'boolean' ? 'boolean' : 'string', description: id }, rationale: 'From the conversation.' },
    ]),
  )
const turns = (n, extra = []) => [
  ['agent', 'Hello. I can walk you through the work, or take a brief for Naman.'],
  ...Array.from({ length: n }, (_, i) => [
    ['user', i === 0 ? 'We are building a support agent and need evals before launch.' : `Follow-up question ${i}.`],
    ['agent', `Answer ${i}.`],
  ]).flat(),
  ...extra,
]
const transcript = (pairs) =>
  pairs.map(([role, message], i) => ({
    role,
    message,
    time_in_call_secs: i * 6,
    tool_calls: [],
    tool_results: [],
    feedback: null,
    interrupted: false,
    source_medium: role === 'user' ? 'text' : null,
  }))
{
  const hostileValues = Object.fromEntries(
    ['visitor_name', 'company', 'role', 'building', 'problem_summary', 'practice_match', 'timeline', 'found_via', 'visitor_type', 'fit', 'unanswered_questions'].map((k) => [k, `${k} ${HOSTILE}\r\nline two`]),
  )
  const lead = leadEmail({
    conversation_id: 'conv_qa_unit',
    transcript: transcript(turns(1, [['user', HOSTILE]])),
    analysis: { transcript_summary: HOSTILE, data_collection_results: collected({ ...hostileValues, visitor_email: 'qa@example.com', brief_sent: true }) },
  })
  const problems = []
  if (!lead?.qualifies) problems.push('a lead with an email and a brief does not qualify')
  else {
    for (const raw of ['<script', '<img', '"quoted"', "'single'", ' & ']) if (lead.html.includes(raw)) problems.push(`HTML carries ${JSON.stringify(raw)} unescaped`)
    if (!lead.html.includes('&lt;script&gt;')) problems.push('HTML lost the escaped value')
    if (/[\r\n]/.test(lead.subject)) problems.push('subject spans lines')
    if (!lead.subject.startsWith('Brief: company ')) problems.push(`subject ${JSON.stringify(lead.subject.slice(0, 40))}`)
    if (lead.replyTo !== 'qa@example.com') problems.push('reply_to is not the visitor address')
    if (!lead.text.includes('https://elevenlabs.io/app/agents/history/conv_qa_unit')) problems.push('no history link in the text part')
  }
  check(problems, 'unit.email-escaping', 'every payload value escaped in the HTML, subject on one line, reply_to set')

  const q = (data) => leadEmail({ conversation_id: 'conv_qa_unit', ...data })?.qualifies
  const cases = [
    ['one visitor turn, nothing left', q({ transcript: transcript(turns(1)) }), false],
    ['three visitor turns', q({ transcript: transcript(turns(3)) }), true],
    ['an email only', q({ analysis: { data_collection_results: collected({ visitor_email: 'qa@example.com' }) } }), true],
    ['brief_sent as the string "true"', q({ analysis: { data_collection_results: collected({ brief_sent: 'true' }) } }), true],
    ['an unfilled email ("none")', q({ analysis: { data_collection_results: collected({ visitor_email: 'none' }) } }), false],
  ]
  const wrong = cases.filter(([, got, want]) => got !== want).map(([name, got]) => `${name}: qualifies=${got}`)
  if (leadEmail({ conversation_id: '../x' }) !== null) wrong.push('a conversation id outside [A-Za-z0-9_-] is accepted')
  const plain = leadEmail({ conversation_id: 'conv_qa_unit', transcript: transcript(turns(3)), analysis: { data_collection_results: collected({ visitor_type: 'founder' }) } })
  if (plain?.subject !== 'Concierge conversation · founder') wrong.push(`subject without contact is ${JSON.stringify(plain?.subject)}`)
  check(wrong, 'unit.email-rules', `${cases.length} qualify cases, subject without contact, conversation id checked`)

  const body = Buffer.from('{"type":"post_call_transcription"}')
  const now = Date.now()
  const at = (t, secret = 'unit-secret', signed = body) => `t=${t},v0=${createHmac('sha256', secret).update(`${t}.`).update(signed).digest('hex')}`
  const t = Math.floor(now / 1000)
  const sig = [
    ['valid', signedByElevenLabs(at(t), body, 'unit-secret', now), true],
    ['31 minutes old', signedByElevenLabs(at(t - 31 * 60), body, 'unit-secret', now), false],
    ['29 minutes old', signedByElevenLabs(at(t - 29 * 60), body, 'unit-secret', now), true],
    ['another secret', signedByElevenLabs(at(t, 'other'), body, 'unit-secret', now), false],
    ['another body', signedByElevenLabs(at(t, 'unit-secret', Buffer.from('{}')), body, 'unit-secret', now), false],
    ['short digest', signedByElevenLabs(`t=${t},v0=abcd`, body, 'unit-secret', now), false],
    ['no timestamp', signedByElevenLabs(at(t).replace(/^t=\d+,/, ''), body, 'unit-secret', now), false],
    ['two timestamps', signedByElevenLabs(`t=${t},${at(t)}`, body, 'unit-secret', now), false],
  ]
  check(sig.filter(([, got, want]) => got !== want).map(([name, got]) => `${name}: ${got}`), 'unit.signature', `${sig.length} signature cases`)

  const key = (xff) => visitorKey(new Headers(xff ? { 'x-forwarded-for': xff } : {}))
  const keys = [
    ['first X-Forwarded-For entry', key('203.0.113.7, 10.0.0.1'), '203.0.113.7'],
    ['IPv4 with a port', key('203.0.113.7:5000'), '203.0.113.7'],
    ['IPv4-mapped IPv6', key('::ffff:203.0.113.7'), '203.0.113.7'],
    ['IPv6 by /64', key('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64'],
    ['same /64, other address', key('[2001:db8:1:2:bbbb:cccc:dddd:eeee]:443'), '2001:db8:1:2::/64'],
    ['not an address', key('garbage'), 'unknown'],
  ]
  check(keys.filter(([, got, want]) => got !== want).map(([name, got]) => `${name}: ${got}`), 'unit.visitor-key', `${keys.length} visitor key cases`)
}

// ---------------------------------------------------------------- HTTP

const VISITOR = `${['192.0.2', '198.51.100', '203.0.113'][randomInt(3)]}.${randomInt(1, 255)}`
async function call(p, { method = 'GET', headers = {}, body } = {}) {
  try {
    const r = await fetch(BASE + p, {
      method,
      headers: { 'x-forwarded-for': VISITOR, accept: 'application/json', ...headers },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    })
    const text = await r.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {}
    return { ok: true, status: r.status, headers: r.headers, json }
  } catch (e) {
    return { ok: false, status: 0, error: (e.cause && (e.cause.code || e.cause.message)) || e.message }
  }
}

// Status, error code and no-store; the body's other values are never printed.
function expect(r, status, { error, allow } = {}) {
  if (!r.ok) return [`request failed: ${r.error}`]
  const problems = []
  if (r.status !== status) problems.push(`HTTP ${r.status}${r.json?.error ? ` ${r.json.error}` : ''}, expected ${status}`)
  if (!/\bno-store\b/i.test(r.headers.get('cache-control') || '')) problems.push('no Cache-Control: no-store')
  if (error && r.status === status && r.json?.error !== error) problems.push(`error ${JSON.stringify(r.json?.error)}, expected ${JSON.stringify(error)}`)
  if (allow && r.headers.get('allow') !== allow) problems.push(`Allow ${JSON.stringify(r.headers.get('allow'))}, expected ${JSON.stringify(allow)}`)
  return problems
}
const fields = (r) => (r.json && typeof r.json === 'object' ? Object.keys(r.json).join(', ') : 'no JSON')

const probe = await call('/robots.txt')
if (!probe.ok) {
  fail('server', `${BASE} does not answer (${probe.error}); start it with npm run build && npm start`)
  console.log(`\n${counts.PASS} passed, ${counts.FAIL} failed, ${counts.WARN} warnings, ${counts.SKIP} skipped`)
  process.exit(1)
}

// ---------------------------------------------------------------- session route

const SESSION = '/api/concierge/session'
const SAME_ORIGIN = { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', referer: `${BASE}/` }
const CROSS_SITE = { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'cors', origin: 'https://cross-site.example' }
// Requests that reach the rate limit: past the origin and mode checks.
let counted = 0
const countedCall = async (p, init) => {
  const r = await call(p, init)
  if (r.ok && ![400, 403, 404, 405].includes(r.status)) counted++
  return r
}

const notThere = await call(`${SESSION}?mode=voice`, { headers: CROSS_SITE })
if (notThere.ok && notThere.status === 404) {
  fail('session.route', `${SESSION} answers 404: this build has no concierge routes`)
} else {
  check(expect(notThere, 403, { error: 'origin' }), 'session.cross-site', 'Origin of another site and Sec-Fetch-Site cross-site -> 403 origin')
  check(expect(await call(`${SESSION}?mode=voice`), 403, { error: 'origin' }), 'session.no-origin', 'no Origin, Referer or Sec-Fetch-Site -> 403 origin')
  check(
    expect(await call(`${SESSION}?mode=voice`, { headers: { referer: 'https://cross-site.example/page' } }), 403, { error: 'origin' }),
    'session.foreign-referer',
    'Referer of another site -> 403 origin',
  )
  check(expect(await call(`${SESSION}?mode=voice`, { headers: { origin: 'null' } }), 403, { error: 'origin' }), 'session.null-origin', 'Origin: null -> 403 origin')
  check(expect(await call(`${SESSION}?mode=voice`, { method: 'POST', headers: SAME_ORIGIN }), 405, { error: 'method', allow: 'GET' }), 'session.post', 'POST -> 405, Allow: GET')
  check(expect(await call(`${SESSION}?mode=voice`, { method: 'HEAD', headers: SAME_ORIGIN }), 405, { allow: 'GET' }), 'session.head', 'HEAD -> 405 (never runs GET)')
  const modes = [`${SESSION}?mode=video`, SESSION, `${SESSION}?mode=voice&mode=text`, `${SESSION}?mode=VOICE`]
  const modeProblems = []
  for (const p of modes) for (const problem of expect(await countedCall(p, { headers: SAME_ORIGIN }), 400, { error: 'mode' })) modeProblems.push(`${p}: ${problem}`)
  check(modeProblems, 'session.mode', `${modes.length} bad modes (unknown, missing, twice, wrong case) -> 400 mode`)

  // The Referer and Origin fallbacks, proved by a 400 on a bad mode: past the origin check, and
  // no call to ElevenLabs.
  const viaOrigin = await countedCall(`${SESSION}?mode=bogus`, { headers: { origin: 'http://localhost:3000' } })
  check(expect(viaOrigin, 400, { error: 'mode' }), 'session.listed-origin', 'Origin http://localhost:3000 without Sec-Fetch-Site passes the origin check')
  if (['http://127.0.0.1:3000', 'http://localhost:3000'].includes(BASE)) {
    const viaReferer = await countedCall(`${SESSION}?mode=bogus`, { headers: { referer: `${BASE}/#contact` } })
    check(expect(viaReferer, 400, { error: 'mode' }), 'session.listed-referer', 'Referer of the site without Origin or Sec-Fetch-Site passes the origin check')
  } else skip('session.listed-referer', `${BASE} is not one of the origins the route lists`)

  // A credential per mode, when the server has the key. Only field names are printed.
  for (const [mode, out, shape] of [
    ['voice', 'conversationToken', (v) => typeof v === 'string' && v.length > 0 && !/\s/.test(v)],
    ['text', 'signedUrl', (v) => typeof v === 'string' && v.startsWith('wss://')],
  ]) {
    const r = await countedCall(`${SESSION}?mode=${mode}`, { headers: SAME_ORIGIN })
    const id = `session.${mode}`
    if (r.ok && r.status === 503 && r.json?.error === 'unconfigured') warn(id, '503 unconfigured: the server has no ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID')
    else if (r.ok && r.status === 503 && r.json?.error === 'paused') warn(id, '503 paused: CONCIERGE_PAUSED=1 on the server')
    else if (r.ok && r.status === 502)
      fail(id, '502 upstream: ElevenLabs refused or failed; the key needs Agents write access (convai_write: a read-only key is refused) and the agent id must exist')
    else {
      const problems = expect(r, 200)
      const keys = r.json && typeof r.json === 'object' ? Object.keys(r.json).sort() : []
      if (!problems.length) {
        if (JSON.stringify(keys) !== JSON.stringify([out, 'mode'].sort())) problems.push(`fields ${keys.join(', ')}, expected mode, ${out}`)
        if (r.json.mode !== mode) problems.push(`mode is not ${mode}`)
        if (!shape(r.json[out])) problems.push(`${out} is not the expected shape`)
      }
      check(problems, id, `200, fields: ${fields(r)}`)
    }
  }

  // The burst limit: the fifth counted request inside ten minutes is refused.
  let limited = null
  for (let i = 0; i < 8 && !limited; i++) {
    const r = await call(`${SESSION}?mode=text`, { headers: SAME_ORIGIN })
    if (r.ok && r.status === 429) limited = r
    else if (r.ok && ![400, 403, 404, 405].includes(r.status)) counted++
    else if (!r.ok) break
  }
  if (!limited) fail('session.rate', `no 429 after ${counted} counted requests`)
  else {
    const problems = expect(limited, 429, { error: 'rate' })
    const retry = Number(limited.headers.get('retry-after'))
    if (!(retry >= 1 && retry <= 600)) problems.push(`Retry-After ${JSON.stringify(limited.headers.get('retry-after'))}`)
    if (counted !== 4) problems.push(`429 after ${counted} counted requests, expected 4`)
    check(problems, 'session.rate', `429 rate after 4 requests in ten minutes, Retry-After ${limited.headers.get('retry-after')} s`)
  }
}

// ---------------------------------------------------------------- webhook route

const WEBHOOK = '/api/concierge/post-call'
const sign = (body, { secret = SECRET, t = Math.floor(Date.now() / 1000) } = {}) =>
  `t=${t},v0=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`
const post = (body, signature) =>
  call(WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json', ...(signature ? { 'elevenlabs-signature': signature } : {}) }, body })

// A post_call_transcription as ElevenLabs sends it, trimmed to the fields that matter here.
function transcription({ agentId = AGENT_ID, type = 'post_call_transcription', pairs, values, summary } = {}) {
  const now = Math.floor(Date.now() / 1000)
  return JSON.stringify({
    type,
    event_timestamp: now,
    data: {
      agent_id: agentId,
      agent_name: 'Concierge',
      conversation_id: `conv_qa${randomBytes(10).toString('hex')}`,
      status: 'done',
      user_id: 'qa-visitor',
      transcript: [
        ...transcript(pairs).slice(0, 2),
        {
          role: 'agent',
          message: null,
          time_in_call_secs: 9,
          tool_calls: [{ request_id: 'qa1', tool_name: 'get_page_context', params_as_json: '{}', tool_has_been_called: true }],
          tool_results: [{ request_id: 'qa1', tool_name: 'get_page_context', result_value: 'On screen: the work.', is_error: false, tool_has_been_called: true }],
        },
        ...transcript(pairs).slice(2),
      ],
      metadata: { start_time_unix_secs: now - 180, call_duration_secs: 170, cost: 0, termination_reason: 'Client disconnected' },
      analysis: {
        call_successful: 'success',
        transcript_summary: summary,
        evaluation_criteria_results: {},
        data_collection_results: collected(values),
      },
      conversation_initiation_client_data: { dynamic_variables: { entry_point: 'launcher', entry_section: 'contact', brief_already_sent: 'false' } },
      has_audio: false,
      has_user_audio: false,
      has_response_audio: false,
    },
  })
}
const LEAD_VALUES = {
  visitor_name: 'QA check (concierge-routes.mjs)',
  visitor_email: 'qa@example.com',
  company: 'Route check <b>&</b> "Co"',
  role: 'Founder',
  building: 'A support agent',
  problem_summary: 'Evals before launch',
  practice_match: 'AI products',
  timeline: 'This quarter',
  found_via: 'LinkedIn',
  visitor_type: 'founder',
  fit: 'strong',
  brief_sent: true,
  unanswered_questions: null,
}
const leadBody = transcription({ pairs: turns(4), values: LEAD_VALUES, summary: 'An automated check of the post-call route, not a real visitor.' })

const unsigned = await post(leadBody)
if (unsigned.ok && unsigned.status === 404) fail('webhook.route', `${WEBHOOK} answers 404: this build has no concierge routes`)
else if (unsigned.ok && unsigned.status === 503) {
  fail('webhook.unsigned', '503 unconfigured: the server has no ELEVENLABS_WEBHOOK_SECRET or ELEVENLABS_AGENT_ID')
} else {
  check(expect(await call(WEBHOOK), 405, { error: 'method', allow: 'POST' }), 'webhook.get', 'GET -> 405, Allow: POST')
  check(expect(unsigned, 401, { error: 'signature' }), 'webhook.unsigned', 'no ElevenLabs-Signature -> 401')
  const t = Math.floor(Date.now() / 1000)
  const bad = [
    ['random digest', `t=${t},v0=${randomBytes(32).toString('hex')}`],
    ['digest too short', `t=${t},v0=${randomBytes(16).toString('hex')}`],
    ['no timestamp', `v0=${randomBytes(32).toString('hex')}`],
    ['garbage', 'not a signature'],
  ]
  const badProblems = []
  for (const [name, header] of bad) for (const problem of expect(await post(leadBody, header), 401, { error: 'signature' })) badProblems.push(`${name}: ${problem}`)
  if (!SECRET) {
    check(badProblems, 'webhook.bad-signature', `${bad.length} forged headers -> 401`)
    skip('webhook.signed', 'no ELEVENLABS_WEBHOOK_SECRET in the environment or .env.local: the signed checks need it')
  } else {
    // Signed, but with another secret, or over another body.
    for (const problem of expect(await post(leadBody, sign(leadBody, { secret: `${SECRET}x` })), 401, { error: 'signature' })) badProblems.push(`other secret: ${problem}`)
    for (const problem of expect(await post(leadBody, sign(leadBody.replace('Evals', 'Evalz'))), 401, { error: 'signature' })) badProblems.push(`other body: ${problem}`)
    check(badProblems, 'webhook.bad-signature', `${bad.length + 2} forged or mismatched signatures -> 401`)

    check(expect(await post(leadBody, sign(leadBody, { t: t - 31 * 60 })), 401, { error: 'signature' }), 'webhook.stale', 'signed 31 minutes ago -> 401')
    check(expect(await post(leadBody, sign(leadBody, { t: t + 31 * 60 })), 401, { error: 'signature' }), 'webhook.future', 'signed 31 minutes ahead -> 401')

    const otherAgent = transcription({ agentId: 'agent_0000qa0000check', pairs: turns(4), values: LEAD_VALUES, summary: 'Another agent.' })
    const r1 = await post(otherAgent, sign(otherAgent))
    check([...expect(r1, 200), ...(r1.json?.ignored === true ? [] : [`fields ${fields(r1)}, expected ignored`])], 'webhook.other-agent', '200 ignored for another agent id')

    const ignoredTypes = []
    for (const type of ['post_call_audio', 'call_initiation_failure']) {
      const other = JSON.stringify({
        type,
        event_timestamp: t,
        data: { agent_id: AGENT_ID, conversation_id: `conv_qa${randomBytes(6).toString('hex')}`, ...(type === 'post_call_audio' ? { full_audio: Buffer.from('qa').toString('base64') } : { failure_reason: 'busy' }) },
      })
      const r = await post(other, sign(other))
      for (const problem of [...expect(r, 200), ...(r.json?.ignored === true ? [] : [`fields ${fields(r)}, expected ignored`])]) ignoredTypes.push(`${type}: ${problem}`)
    }
    check(ignoredTypes, 'webhook.other-type', '200 ignored for post_call_audio and call_initiation_failure')

    const notJson = 'not json'
    check(expect(await post(notJson, sign(notJson)), 400, { error: 'payload' }), 'webhook.not-json', 'signed body that is not JSON -> 400 payload')

    const quiet = transcription({ pairs: turns(1), values: { visitor_email: null, brief_sent: false, visitor_type: 'browser' }, summary: 'A short look around.' })
    const r2 = await post(quiet, sign(quiet))
    check([...expect(r2, 200), ...(r2.json?.sent === false ? [] : [`fields ${fields(r2)}, expected sent: false`])], 'webhook.no-lead', 'one visitor turn, no email, no brief -> 200 sent: false')

    const r3 = await post(leadBody, sign(leadBody))
    if (r3.ok && r3.status === 200 && r3.json?.sent === false && r3.json?.error === 'unconfigured' && !RESEND_SET) {
      pass('webhook.lead', '200 sent: false, unconfigured: CONCIERGE_RESEND_KEY is empty, as expected locally (the webhook stays healthy)')
    } else if (r3.ok && r3.status === 200 && r3.json?.sent === true) {
      if (RESEND_SET) pass('webhook.lead', '200 sent: one test email went to CONCIERGE_TO')
      else warn('webhook.lead', '200 sent, although .env.local has no CONCIERGE_RESEND_KEY: the server has one from its environment')
    } else if (r3.ok && r3.status === 502 && RESEND_SET) {
      fail('webhook.lead', `502 ${r3.json?.error ?? ''}: Resend refused the send; check CONCIERGE_RESEND_KEY, the CONCIERGE_FROM domain and CONCIERGE_TO`)
    } else check([...expect(r3, 200), `fields ${fields(r3)}`], 'webhook.lead', '')
  }
}

console.log(`\n${counts.PASS} passed, ${counts.FAIL} failed, ${counts.WARN} warnings, ${counts.SKIP} skipped`)
process.exitCode = counts.FAIL ? 1 : 0
