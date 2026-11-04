// Server-only helpers for the concierge's routes (src/app/api/concierge/*). Nothing here logs,
// and no response carries a secret or an upstream body: every answer is a short JSON code.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'

// Every answer is JSON that no browser or CDN may keep.
export function json(status, body, headers) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

// Set at build time, like the headers in next.config.js. Without the concierge the routes
// answer as if they did not exist, so the site behaves exactly as it did before them.
export const CONCIERGE_ON = process.env.NEXT_PUBLIC_CONCIERGE === 'on'

export function off() {
  return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

// The handler for each method a route does not take. Left to Next, HEAD would run GET (for the
// session route, a call to ElevenLabs) and OPTIONS would answer 204.
export function refuse(allow) {
  return () => (CONCIERGE_ON ? json(405, { error: 'method' }, { Allow: allow }) : off())
}

// ---------------------------------------------------------------- origin

const SITE_ORIGINS = ['https://namanbhayana.com', 'https://www.namanbhayana.com', 'http://127.0.0.1:3000', 'http://localhost:3000']

function originOf(value) {
  try {
    const { origin } = new URL(value)
    return origin === 'null' ? null : origin
  } catch {
    return null
  }
}

let origins = null
function allowedOrigins() {
  if (!origins) {
    const { VERCEL_URL, VERCEL_BRANCH_URL, CONCIERGE_ORIGINS = '' } = process.env
    const deployments = [VERCEL_URL, VERCEL_BRANCH_URL].filter(Boolean).map((host) => `https://${host}`)
    origins = new Set([...SITE_ORIGINS, ...deployments, ...CONCIERGE_ORIGINS.split(',')].map((o) => originOf(o.trim())).filter(Boolean))
  }
  return origins
}

// A session goes only to this site's own pages: the browser says the request is same-origin, or
// its Origin (else its Referer) is one of the site's addresses. Any client can send these headers,
// so this is no lock; it keeps other sites from spending the agent from their pages.
export function fromOwnSite(headers) {
  if (headers.get('sec-fetch-site') === 'same-origin') return true
  const origin = originOf(headers.get('origin') || headers.get('referer') || '')
  return origin !== null && allowedOrigins().has(origin)
}

// ---------------------------------------------------------------- rate limit

// Four sessions in ten minutes and eight a day per visitor, counted in this instance's memory:
// room for a few switches between voice and text, and well under the agent's daily cap in
// ElevenLabs (30), which is the real ceiling. Each serverless instance keeps its own count, so
// this brakes one visitor; it is not a global cap.
const LIMITS = [
  { windowMs: 600_000, max: 4 },
  { windowMs: 86_400_000, max: 8 },
]
const KEEP_MS = 86_400_000
const MAX_VISITORS = 10_000
const seen = new Map() // visitor -> times of the requests let through in the last hour, oldest first

export function rateLimit(visitor, now = Date.now()) {
  const times = (seen.get(visitor) ?? []).filter((t) => t > now - KEEP_MS)
  let waitMs = 0
  for (const { windowMs, max } of LIMITS) {
    const recent = times.filter((t) => t > now - windowMs)
    // Full: a place frees when the oldest of the last `max` requests leaves the window.
    if (recent.length >= max) waitMs = Math.max(waitMs, recent[recent.length - max] + windowMs - now)
  }
  // Re-inserted on every visit, so the Map runs from the visitor seen longest ago to the latest.
  seen.delete(visitor)
  if (waitMs > 0) {
    if (times.length) seen.set(visitor, times)
    return { ok: false, retryAfter: Math.ceil(waitMs / 1000) }
  }
  times.push(now)
  seen.set(visitor, times)
  if (seen.size > MAX_VISITORS) forget(now)
  return { ok: true }
}

function forget(now) {
  for (const [visitor, times] of seen) if (times[times.length - 1] <= now - KEEP_MS) seen.delete(visitor)
  for (const visitor of seen.keys()) {
    if (seen.size <= MAX_VISITORS) break
    seen.delete(visitor)
  }
}

// The visitor is the first X-Forwarded-For address (on Vercel the platform sets it and drops
// whatever the client sent), else X-Real-IP. IPv6 counts by /64, the block one subscriber gets,
// so moving to another address inside it does not start a new count.
export function visitorKey(headers) {
  const forwarded = headers.get('x-forwarded-for')
  const first = (forwarded ? forwarded.split(',')[0] : (headers.get('x-real-ip') ?? '')).trim()
  let ip = first.startsWith('[') ? first.slice(1, first.indexOf(']')) : first
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'))
  ip = ip.split('%')[0]
  const version = isIP(ip)
  if (version === 4) return ip
  if (version !== 6) return 'unknown'
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)
  return mapped ? mapped[1] : prefix64(ip)
}

function prefix64(ip) {
  // An embedded IPv4 tail fills the last two groups.
  const groups = (part) => (part ? part.split(':') : []).flatMap((g) => (g.includes('.') ? ['0', '0'] : [g]))
  const [head, tail] = ip.toLowerCase().split('::')
  const left = groups(head)
  const full = tail === undefined ? left : [...left, ...Array(8 - left.length - groups(tail).length).fill('0'), ...groups(tail)]
  return `${full
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(':')}::/64`
}

// ---------------------------------------------------------------- webhook

const SIGNATURE_TOLERANCE_S = 30 * 60

// ElevenLabs signs each webhook with `ElevenLabs-Signature: t=<unix seconds>,v0=<hex>`, the hex
// being HMAC-SHA256(secret, "<t>.<raw body>"). A timestamp more than 30 minutes away from now is
// refused (a replay, or a clock that cannot be trusted), and the digests are compared in constant
// time on buffers of equal length.
function parseSignature(header, nowMs) {
  if (typeof header !== 'string' || header.length > 1024) return null
  let t = null
  const digests = []
  for (const part of header.split(',')) {
    const eq = part.indexOf('=')
    if (eq < 1) return null
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key === 't') {
      if (t !== null) return null
      t = value
    } else if (key === 'v0' && /^[0-9a-f]{64}$/i.test(value)) digests.push(value)
  }
  if (t === null || !/^\d{1,12}$/.test(t) || !digests.length) return null
  if (Math.abs(nowMs / 1000 - Number(t)) > SIGNATURE_TOLERANCE_S) return null
  return { t, digests }
}

// The cheap half of the check, run before the body is read: a fresh timestamp and at least one
// well-formed digest. An unsigned request is refused without spending memory on its body.
export function looksSigned(header, nowMs = Date.now()) {
  return parseSignature(header, nowMs) !== null
}

export function signedByElevenLabs(header, rawBody, secret, nowMs = Date.now()) {
  const parsed = secret ? parseSignature(header, nowMs) : null
  if (!parsed) return false
  const expected = createHmac('sha256', secret).update(`${parsed.t}.`).update(rawBody).digest()
  let valid = false
  for (const hex of parsed.digests) {
    if (timingSafeEqual(Buffer.from(hex, 'hex'), expected)) valid = true
  }
  return valid
}

// The raw request body as bytes (what the signature covers), or null past maxBytes. Read as a
// stream so a body without a Content-Length cannot grow past the cap either.
export async function readBody(request, maxBytes) {
  if (Number(request.headers.get('content-length')) > maxBytes) return null
  if (!request.body) return Buffer.alloc(0)
  const reader = request.body.getReader()
  const chunks = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return Buffer.concat(chunks, size)
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
}
