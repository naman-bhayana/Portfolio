import { CONCIERGE_ON, fromOwnSite, json, off, rateLimit, refuse, visitorKey } from '@/lib/concierge-server'

// Hands the concierge a short-lived credential for one conversation with the agent, so the
// ElevenLabs key never leaves the server: a WebRTC conversation token for voice, a signed
// WebSocket URL for text. A request that passes every check makes exactly one upstream call.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const API = 'https://api.elevenlabs.io/v1/convai/conversation/'
const UPSTREAM_TIMEOUT_MS = 8000
const CREDENTIAL_MAX = 16384

// Per mode: what to ask ElevenLabs for, the field it answers with and the field the client reads.
const MODES = {
  voice: { path: 'token', field: 'token', out: 'conversationToken', valid: (v) => !/\s/.test(v) },
  text: { path: 'get-signed-url', field: 'signed_url', out: 'signedUrl', valid: (v) => /^wss:\/\/\S+$/.test(v) },
}

export async function GET(request) {
  if (!CONCIERGE_ON) return off()
  try {
    if (!fromOwnSite(request.headers)) return json(403, { error: 'origin' })
    const asked = request.nextUrl.searchParams.getAll('mode')
    const mode = asked.length === 1 && Object.hasOwn(MODES, asked[0]) ? asked[0] : null
    if (!mode) return json(400, { error: 'mode' })
    const limit = rateLimit(visitorKey(request.headers))
    if (!limit.ok) return json(429, { error: 'rate' }, { 'Retry-After': String(limit.retryAfter) })
    // The kill switch, then the configuration: neither reaches ElevenLabs.
    if (process.env.CONCIERGE_PAUSED?.trim() === '1') return json(503, { error: 'paused' })
    const key = process.env.ELEVENLABS_API_KEY
    const agentId = process.env.ELEVENLABS_AGENT_ID
    if (!key || !agentId) return json(503, { error: 'unconfigured' })
    const credential = await mint(MODES[mode], key, agentId)
    if (!credential) return json(502, { error: 'upstream' })
    return json(200, { mode, [MODES[mode].out]: credential })
  } catch {
    return json(500, { error: 'server' })
  }
}

// The one upstream call. What ElevenLabs answers stays here: the client gets the single field it
// needs, checked, or a bare 502.
async function mint({ path, field, valid }, key, agentId) {
  try {
    const res = await fetch(`${API}${path}?agent_id=${encodeURIComponent(agentId)}`, {
      headers: { 'xi-api-key': key, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    if (!res.ok) {
      res.body?.cancel().catch(() => {})
      return null
    }
    const value = (await res.json())?.[field]
    return typeof value === 'string' && value.length > 0 && value.length <= CREDENTIAL_MAX && valid(value) ? value : null
  } catch {
    return null
  }
}

const refused = refuse('GET')
export const HEAD = refused
export const OPTIONS = refused
export const POST = refused
export const PUT = refused
export const PATCH = refused
export const DELETE = refused
