import { CONCIERGE_ON, json, looksSigned, off, readBody, refuse, signedByElevenLabs } from '@/lib/concierge-server'
import { leadEmail } from '@/lib/concierge-server-email'

// ElevenLabs' post-call webhook. After each conversation with the concierge it posts the
// transcript and the analysis; a conversation worth reading becomes one email to Naman through
// Resend. Only a failure worth retrying (Resend busy or down, or the network) answers 502, and
// the idempotency key makes sure a retry never sends the same email twice. Anything a retry
// cannot fix answers 200, so ElevenLabs does not count it against the webhook and switch it off.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 1024 * 1024
const RESEND_URL = 'https://api.resend.com/emails'
const RESEND_TIMEOUT_MS = 10000

export async function POST(request) {
  if (!CONCIERGE_ON) return off()
  try {
    const secret = process.env.ELEVENLABS_WEBHOOK_SECRET
    const agentId = process.env.ELEVENLABS_AGENT_ID
    if (!secret || !agentId) return json(503, { error: 'unconfigured' })
    // The header's shape and timestamp first, so an unsigned request costs nothing; then the
    // signature over the raw bytes, before anything is parsed.
    if (!looksSigned(request.headers.get('elevenlabs-signature'))) return json(401, { error: 'signature' })
    const raw = await readBody(request, MAX_BODY_BYTES)
    if (!raw) return json(413, { error: 'size' })
    if (!signedByElevenLabs(request.headers.get('elevenlabs-signature'), raw, secret)) return json(401, { error: 'signature' })
    let event
    try {
      event = JSON.parse(raw.toString('utf8'))
    } catch {
      return json(400, { error: 'payload' })
    }
    const data = event?.data
    if (event?.type !== 'post_call_transcription' || data?.agent_id !== agentId) return json(200, { ignored: true })
    const lead = leadEmail(data)
    if (!lead) return json(400, { error: 'payload' })
    if (!lead.qualifies) return json(200, { sent: false })
    return await send(lead)
  } catch {
    return json(500, { error: 'server' })
  }
}

async function send(lead) {
  const key = process.env.CONCIERGE_RESEND_KEY
  const from = process.env.CONCIERGE_FROM
  const to = (process.env.CONCIERGE_TO ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean)
  // Not set up yet: the conversation stays in ElevenLabs, and the webhook stays healthy.
  if (!key || !from || !to.length) return json(200, { sent: false, error: 'unconfigured' })
  // Naman's copy first, then the visitor's confirmation when they pressed Send on a brief. Each
  // has its own idempotency key, so a retry never sends either one twice.
  const owner = await mail(key, `concierge-${lead.id}`, {
    from,
    to,
    subject: lead.subject,
    text: lead.text,
    html: lead.html,
    ...(lead.replyTo ? { reply_to: lead.replyTo } : {}),
  })
  if (owner !== 'sent') return answer(owner, 'lead')
  if (!lead.ack) return json(200, { sent: true })
  const visitor = await mail(key, `concierge-ack-${lead.id}`, { from, to: [lead.ack.to], reply_to: to[0], subject: lead.ack.subject, text: lead.ack.text, html: lead.ack.html })
  return visitor === 'sent' ? json(200, { sent: true, confirmed: true }) : answer(visitor, 'confirmation')
}

// 'sent', 'retry' (Resend busy or down, or the network) or the HTTP status of a refusal a retry
// cannot fix (a bad key, an unverified domain, an invalid address). Resend's answer is never read
// or passed on; a 409 is the same email already accepted under this idempotency key.
async function mail(key, idempotencyKey, body) {
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    })
    res.body?.cancel().catch(() => {})
    if (res.ok || res.status === 409) return 'sent'
    return res.status === 429 || res.status >= 500 ? 'retry' : res.status
  } catch {
    return 'retry'
  }
}

function answer(outcome, which) {
  if (outcome === 'retry') return json(502, { error: 'upstream' })
  // The status shows in ElevenLabs' delivery log, and this line is its only record on the server.
  // eslint-disable-next-line no-console -- the one server log line: an email Resend refused
  console.error(`concierge: Resend refused the ${which} email (HTTP ${outcome})`)
  return json(200, { sent: which !== 'lead', error: 'resend', status: outcome })
}

const refused = refuse('POST')
export const GET = refused
export const HEAD = refused
export const OPTIONS = refused
export const PUT = refused
export const PATCH = refused
export const DELETE = refused
