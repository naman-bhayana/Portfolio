// HTTP helpers for verify-site.mjs. Every call resolves (never rejects): network and
// parse failures come back as { ok: false, error } so one bad URL cannot crash a run.
import http from 'node:http'
import https from 'node:https'

export const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
export const HTML_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

const TIMEOUT_MS = 20000

export function describeError(e) {
  if (!e) return 'unknown error'
  const cause = e.cause && (e.cause.code || e.cause.message)
  if (e.name === 'TimeoutError' || e.name === 'AbortError') return `timeout after ${TIMEOUT_MS} ms`
  return cause ? `${e.message} (${cause})` : e.code || e.message || String(e)
}

export function requestHeaders(ua, accept) {
  const h = { 'user-agent': ua || CHROME_UA, accept: accept || '*/*' }
  if (process.env.VERCEL_BYPASS) {
    h['x-vercel-protection-bypass'] = process.env.VERCEL_BYPASS
    h['x-vercel-skip-toolbar'] = '1'
  }
  return h
}

const cache = new Map()

// GET with the built-in fetch. redirect: 'follow' | 'manual'.
export function get(url, { ua, redirect = 'follow', accept } = {}) {
  const key = [url, ua || '', redirect, accept || ''].join('|')
  if (!cache.has(key)) cache.set(key, doGet(url, ua, redirect, accept))
  return cache.get(key)
}

async function doGet(url, ua, redirect, accept) {
  const empty = { url, status: 0, contentType: '', location: null, buf: Buffer.alloc(0), text: '' }
  try {
    const res = await fetch(url, {
      headers: requestHeaders(ua, accept),
      redirect,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const buf = Buffer.from(await res.arrayBuffer())
    return {
      ok: true,
      url,
      finalUrl: res.url,
      status: res.status,
      contentType: (res.headers.get('content-type') || '').toLowerCase(),
      location: res.headers.get('location'),
      headers: res.headers,
      buf,
      text: buf.toString('utf8'),
    }
  } catch (e) {
    return { ...empty, ok: false, error: describeError(e) }
  }
}

// GET with node:http(s) so duplicate response headers stay visible in rawHeaders
// (fetch merges them). The body is drained and discarded.
export function rawGet(url, { ua } = {}) {
  return new Promise((resolve) => {
    let u
    try {
      u = new URL(url)
    } catch {
      resolve({ ok: false, error: `invalid URL ${url}` })
      return
    }
    const mod = u.protocol === 'https:' ? https : http
    let done = false
    const finish = (v) => {
      if (!done) {
        done = true
        resolve(v)
      }
    }
    const req = mod.request(u, { method: 'GET', headers: requestHeaders(ua) }, (res) => {
      res.on('data', () => {})
      res.on('end', () => finish({ ok: true, status: res.statusCode, rawHeaders: res.rawHeaders }))
      res.on('error', (e) => finish({ ok: false, error: describeError(e) }))
    })
    req.setTimeout(TIMEOUT_MS, () => req.destroy(Object.assign(new Error('timeout'), { name: 'TimeoutError' })))
    req.on('error', (e) => finish({ ok: false, error: describeError(e) }))
    req.end()
  })
}

// rawHeaders [k1, v1, k2, v2, ...] -> Map(lowercase name -> [values])
export function headerMap(rawHeaders = []) {
  const m = new Map()
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const k = String(rawHeaders[i]).toLowerCase()
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(String(rawHeaders[i + 1]))
  }
  return m
}
