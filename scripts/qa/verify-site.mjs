#!/usr/bin/env node
// HTTP-level verification of a deployed or locally served build of namanbhayana.com.
//
//   node scripts/qa/verify-site.mjs <baseUrl> [--profile local|preview|production] [--repo]
//
// Env: TERMS_FILE (TSV kept outside the repo), VERCEL_BYPASS, DRIVE_FILE_PATTERN.
// Prints one PASS / FAIL / WARN / SKIP line per check and exits 1 when anything FAILs.
// Expected copy comes from src/content/site.js; nothing here duplicates it.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'node-html-parser'
import { CHROME_UA, HTML_ACCEPT, get, headerMap, rawGet } from './lib/net.mjs'
import {
  findEmoji,
  isCopyLeaf,
  isUrlish,
  lineOf,
  norm,
  readTerms,
  snippet,
  stringLeaves,
  tagOf,
  textOf,
} from './lib/text.mjs'

// site.js is ESM inside a typeless package; Node reparses it and warns. Keep output clean.
const emitWarning = process.emitWarning
process.emitWarning = (w, ...rest) => {
  const code = (rest[0] && rest[0].code) || rest[1] || (w && w.code)
  if (code === 'MODULE_TYPELESS_PACKAGE_JSON' || /Reparsing as ES module/.test(String(w))) return
  return emitWarning.call(process, w, ...rest)
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SITE = await import(pathToFileURL(path.join(REPO_ROOT, 'src', 'content', 'site.js')).href)
const { SITE_URL, UPDATED, PERSON, HEAD, HERO, WHAT_I_BUILD, SELECTED_WORK, PROOF, ABOUT, NEXERAH, CONTACT, FOOTER } =
  SITE
const { OG_IMAGE, SHARE, AVATAR, RESUME_PATH, RESUME_DRIVE_URL } = SITE

// ---------------------------------------------------------------- arguments

const argv = process.argv.slice(2)
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: node scripts/qa/verify-site.mjs <baseUrl> [--profile local|preview|production] [--repo]')
  process.exit(argv.length ? 0 : 2)
}
let base
try {
  base = new URL(argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--profile'))
} catch {
  console.error('verify-site: first argument must be an absolute base URL')
  process.exit(2)
}
const BASE = base.origin
const PROD = new URL(SITE_URL)
const PROD_HOSTS = new Set([PROD.host, PROD.host.replace(/^www\./, '')])
const pIdx = argv.indexOf('--profile')
let PROFILE = pIdx >= 0 ? argv[pIdx + 1] : null
if (!PROFILE) {
  if (/^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(base.hostname)) PROFILE = 'local'
  else if (PROD_HOSTS.has(base.host)) PROFILE = 'production'
  else PROFILE = 'preview'
}
if (!['local', 'preview', 'production'].includes(PROFILE)) {
  console.error(`verify-site: unknown profile "${PROFILE}"`)
  process.exit(2)
}
const REPO = argv.includes('--repo')
let DRIVE_RE
try {
  DRIVE_RE = new RegExp(process.env.DRIVE_FILE_PATTERN || '^https://drive\\.google\\.com/file/d/')
} catch (e) {
  console.error(`verify-site: DRIVE_FILE_PATTERN is not a valid regex: ${e.message}`)
  process.exit(2)
}

// ---------------------------------------------------------------- reporting

const counts = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 }
function report(status, id, detail = '') {
  counts[status]++
  const oneLine = String(detail).replace(/\s+/g, ' ').trim()
  console.log(`${status.padEnd(4)}  ${id.padEnd(22)} ${oneLine.length > 400 ? oneLine.slice(0, 397) + '...' : oneLine}`)
}
const pass = (id, d) => report('PASS', id, d)
const fail = (id, d) => report('FAIL', id, d)
const warn = (id, d) => report('WARN', id, d)
const skip = (id, d) => report('SKIP', id, d)
const check = (cond, id, okDetail, badDetail) => (cond ? pass(id, okDetail) : fail(id, badDetail ?? okDetail))
const q = (s, n = 80) => JSON.stringify(String(s).length > n ? String(s).slice(0, n) + '...' : String(s))

async function section(name, fn) {
  try {
    await fn()
  } catch (e) {
    fail(`${name}.crash`, `check group threw: ${e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e}`)
  }
}

// ---------------------------------------------------------------- URL helpers

// Production absolute URLs point at the live origin; on local/preview runs fetch the base instead.
function toBase(url) {
  try {
    const u = new URL(url, BASE + '/')
    if (PROD_HOSTS.has(u.host) && u.origin !== BASE) return BASE + u.pathname + u.search
    return u.href
  } catch {
    return null
  }
}
const isSameSite = (url) => {
  try {
    const u = new URL(url)
    return PROD_HOSTS.has(u.host) || u.origin === BASE
  } catch {
    return false
  }
}
const at = (p) => BASE + p
const fetchErr = (r) => (r.ok ? `HTTP ${r.status}` : `request failed: ${r.error}`)

// ---------------------------------------------------------------- fetch the site

const UAS = {
  chrome: CHROME_UA,
  LinkedInBot: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  WhatsApp: 'WhatsApp/2.23.20.0 A',
  facebookexternalhit: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  Twitterbot: 'Twitterbot/1.0',
  Slackbot: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  Discordbot: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  TelegramBot: 'TelegramBot (like TwitterBot)',
}
const CRAWLERS = {
  Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  Bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  ClaudeBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  Applebot: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
  Chrome: CHROME_UA,
}

console.log(`verify-site  base=${BASE}  profile=${PROFILE}${REPO ? '  repo=on' : ''}  updated=${UPDATED}`)

const [home, robots, sitemap, llms, manifest] = await Promise.all([
  get(at('/'), { accept: HTML_ACCEPT }),
  get(at('/robots.txt')),
  get(at('/sitemap.xml')),
  get(at('/llms.txt')),
  get(at('/manifest.webmanifest')),
])
const HOME_OK = home.ok && home.status === 200 && home.text.length > 0
const html = HOME_OK ? home.text : ''
const doc = parse(html, { comment: false })
// Copy of the tree with script/template/noscript removed: what a JS-off reader gets.
const docNoJs = parse(html, { comment: false })
for (const el of docNoJs.querySelectorAll('script, template, noscript, style')) el.remove()
const body = docNoJs.querySelector('body') || docNoJs
const headEl = doc.querySelector('head')
const bodyText = textOf(body)
const titleText = norm(doc.querySelector('title')?.text ?? '')

const metaContents = doc.querySelectorAll('meta[content]').map((m) => m.getAttribute('content') ?? '')
const attrValues = []
for (const el of doc.querySelectorAll('[alt], [aria-label], [title]')) {
  for (const a of ['alt', 'aria-label', 'title']) {
    const v = el.getAttribute(a)
    if (v != null && v !== '') attrValues.push(v)
  }
}

// JSON-LD
const ldScripts = doc.querySelectorAll('script').filter((s) => (s.getAttribute('type') || '').trim().toLowerCase() === 'application/ld+json')
let ld = null
let ldError = null
if (ldScripts.length) {
  try {
    ld = JSON.parse(ldScripts[0].rawText || ldScripts[0].innerHTML)
  } catch (e) {
    ldError = e.message
  }
}
const ldStrings = ld ? stringLeaves(ld) : []

const textOrEmpty = (r) => (r.ok && r.status === 200 ? r.text : '')
// Corpora shared by C2 (terms, emoji) and C4 (voice). `voice` marks prose-like corpora.
const corpora = [
  { name: 'body', text: bodyText, visible: true, voice: true },
  { name: 'title', text: titleText, voice: true },
  { name: 'meta', text: metaContents.join('\n'), voice: true },
  { name: 'json-ld', text: ldStrings.map((l) => l.value).join('\n') },
  {
    name: 'json-ld-prose',
    text: ldStrings.filter((l) => !l.key.startsWith('@') && !isUrlish(l.value)).map((l) => l.value).join('\n'),
    voice: true,
    termsSkip: true,
  },
  { name: 'attributes', text: attrValues.join('\n'), voice: true },
  { name: 'llms.txt', text: textOrEmpty(llms), voice: true },
  { name: 'sitemap.xml', text: textOrEmpty(sitemap) },
  { name: 'robots.txt', text: textOrEmpty(robots) },
  { name: 'manifest', text: textOrEmpty(manifest), voice: true },
]

// ---------------------------------------------------------------- C1 server HTML

function findWorkItem(item) {
  const byId = body.querySelector(`[id="${item.id}"]`)
  if (byId) return byId
  const h = body.querySelectorAll('h3').find((e) => norm(e.text) === item.name)
  if (!h) return null
  for (let p = h.parentNode; p && p !== body; p = p.parentNode) if (['article', 'li'].includes(tagOf(p))) return p
  return h.parentNode
}

await section('C1', async () => {
  if (!HOME_OK) {
    fail('C1.home', `cannot read / (${fetchErr(home)}); C1 skipped`)
    return
  }
  const h1s = body.querySelectorAll('h1')
  check(h1s.length === 1, 'C1.h1-count', `${h1s.length} h1`, `expected exactly one h1, found ${h1s.length}`)
  if (h1s.length) {
    const t = norm(h1s[0].text)
    check(t === HERO.heading, 'C1.h1-text', q(t), `h1 is ${q(t)}, expected ${q(HERO.heading)}`)
  }

  const all = body.querySelectorAll('*')
  const h1Index = h1s.length ? all.indexOf(h1s[0]) : -1
  const eyebrowIndex = all.findIndex((e) => tagOf(e) === 'p' && norm(e.text) === HERO.eyebrow)
  check(
    eyebrowIndex >= 0 && h1Index >= 0 && eyebrowIndex < h1Index,
    'C1.eyebrow',
    'eyebrow <p> precedes the h1',
    eyebrowIndex < 0 ? `no <p> with text ${q(HERO.eyebrow)}` : 'eyebrow <p> does not precede the h1',
  )

  const header = body.querySelector('header')
  check(header && textOf(header).includes(PERSON.name), 'C1.header', `header contains ${q(PERSON.name)}`,
    header ? `header does not contain ${q(PERSON.name)}` : 'no <header> element')

  // Proof <dl>
  const dl = body.querySelectorAll('dl').find((d) => d.querySelectorAll('dt').some((dt) => norm(dt.text) === PROOF[0].value))
  if (!dl) fail('C1.proof', `no <dl> with a <dt> ${q(PROOF[0].value)}`)
  else {
    const kids = dl.querySelectorAll('dt, dd')
    const dts = kids.filter((k) => tagOf(k) === 'dt')
    const problems = []
    if (dts.length !== PROOF.length) problems.push(`${dts.length} <dt>, expected ${PROOF.length}`)
    PROOF.forEach((p, i) => {
      const dt = dts[i]
      if (!dt) return
      if (norm(dt.text) !== p.value) problems.push(`dt[${i}] ${q(norm(dt.text))} != ${q(p.value)}`)
      const dd = kids[kids.indexOf(dt) + 1]
      if (!dd || tagOf(dd) !== 'dd') problems.push(`dt[${i}] has no following <dd>`)
      else if (norm(dd.text) !== p.label) problems.push(`dd[${i}] ${q(norm(dd.text))} != ${q(p.label)}`)
    })
    check(!problems.length, 'C1.proof', `${PROOF.length} dt/dd pairs in order`, problems.join('; '))
  }

  // About
  const aboutText = norm(ABOUT.paragraph.map((s) => (typeof s === 'string' ? s : s.text)).join(''))
  const aboutP = body.querySelectorAll('p').find((p) => norm(p.text) === aboutText)
  check(!!aboutP, 'C1.about', 'About paragraph matches site.js', `no <p> equal to the joined ABOUT.paragraph (starts ${q(aboutText, 50)})`)
  check(bodyText.includes(norm(ABOUT.disclosure)), 'C1.disclosure', 'ABOUT.disclosure present', `missing ${q(ABOUT.disclosure)}`)

  // Selected work headings
  const names = SELECTED_WORK.items.map((i) => i.name)
  const workRoot = body.querySelector('#work')
  const h3s = (workRoot || body).querySelectorAll('h3').map((h) => norm(h.text))
  if (workRoot) {
    check(JSON.stringify(h3s) === JSON.stringify(names), 'C1.work-h3', `#work h3s ${names.join(', ')}`,
      `#work h3s are [${h3s.join(', ')}], expected [${names.join(', ')}]`)
  } else {
    const seq = h3s.filter((t) => names.includes(t))
    check(JSON.stringify(seq) === JSON.stringify(names), 'C1.work-h3', `h3s ${names.join(', ')} in order (no #work section found)`,
      `h3s matching work items are [${seq.join(', ')}], expected [${names.join(', ')}]; no #work section`)
  }

  // Nexerah block and footer
  const nex = [
    ['heading', NEXERAH.heading],
    ['body', NEXERAH.body],
    ['status', NEXERAH.status],
    ['updated', NEXERAH.updated],
    ['cta.label', NEXERAH.cta.label],
    ['domainNote', NEXERAH.domainNote],
  ]
  const missingNex = nex.filter(([, v]) => !bodyText.includes(norm(v))).map(([k]) => k)
  check(!missingNex.length, 'C1.nexerah', 'heading, body, status, updated, cta, domainNote present', `missing NEXERAH.${missingNex.join(', NEXERAH.')}`)
  const footer = body.querySelector('footer')
  check(bodyText.includes(norm(FOOTER.line)), 'C1.footer', 'FOOTER.line present', `missing ${q(FOOTER.line)}`)
  if (footer && bodyText.includes(norm(FOOTER.line)) && !textOf(footer).includes(norm(FOOTER.line))) warn('C1.footer-place', 'FOOTER.line is not inside <footer>')

  // HEAD leaves render in <head>, not in the body.
  check(titleText === norm(HEAD.title), 'C1.head-title', q(titleText), `<title> is ${q(titleText)}, expected ${q(HEAD.title)}`)
  const desc = norm(doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '')
  check(desc === norm(HEAD.description), 'C1.head-description', 'meta description matches HEAD.description',
    desc ? `meta description ${q(desc)} != HEAD.description` : 'no meta description')

  // Every visible copy leaf. CONTACT.copy holds interaction states (copied / fallback) that
  // only exist after hydration, so it is excluded. The Resume link is rendered only once
  // RESUME_DRIVE_URL is set in site.js.
  const groups = { HERO, WHAT_I_BUILD, SELECTED_WORK, PROOF, ABOUT, NEXERAH, CONTACT, FOOTER }
  let total = 0
  const missing = []
  for (const [g, v] of Object.entries(groups)) {
    for (const leaf of stringLeaves(v, g)) {
      if (!isCopyLeaf(leaf) || leaf.path.startsWith('CONTACT.copy')) continue
      if (leaf.path === 'CONTACT.resumeLabel' && !RESUME_DRIVE_URL) continue
      total++
      if (!bodyText.includes(norm(leaf.value))) missing.push(leaf)
    }
  }
  for (const m of missing.slice(0, 20)) fail('C1.copy', `${m.path} not rendered: ${q(m.value, 70)}`)
  if (missing.length > 20) fail('C1.copy', `${missing.length - 20} more of ${total} copy strings not rendered`)
  if (!missing.length) pass('C1.copy', `${total}/${total} site.js copy strings rendered verbatim`)

  // Hidden content
  const hiddenStyle = body
    .querySelectorAll('[style]')
    .filter((e) => /opacity\s*:\s*0*(\.0*)?\s*(;|!|$)|visibility\s*:\s*hidden/i.test(e.getAttribute('style') || ''))
  check(!hiddenStyle.length, 'C1.inline-hidden', 'no inline opacity:0 or visibility:hidden',
    `${hiddenStyle.length} element(s) hidden by inline style, first <${tagOf(hiddenStyle[0])}> style=${q(hiddenStyle[0]?.getAttribute('style') ?? '')}`)
  const markedCopy = (e) => {
    for (let p = e; p && p.nodeType === 1; p = p.parentNode) if (p.hasAttribute && p.hasAttribute('data-copy-email')) return true
    return false
  }
  // Empty hidden elements are framework markers (Next renders <div hidden><!--$--><!--/$--></div>);
  // only hidden elements that carry content count.
  const hidden = body.querySelectorAll('[hidden]').filter((e) => !markedCopy(e) && (textOf(e) || e.querySelector('*')))
  check(!hidden.length, 'C1.hidden-attr', 'no [hidden] content outside data-copy-email',
    `${hidden.length} [hidden] element(s), first <${tagOf(hidden[0])}> ${q(textOf(hidden[0]), 50)}`)
})

// ---------------------------------------------------------------- C2 terms and emoji

await section('C2', async () => {
  const termsFile = process.env.TERMS_FILE
  let terms = []
  if (!termsFile) {
    ;(PROFILE === 'local' ? warn : fail)('C2.terms-file', 'TERMS_FILE not set; term scan skipped')
  } else {
    try {
      const r = readTerms(termsFile)
      terms = r.terms
      for (const e of r.errors) fail('C2.terms-file', e)
      if (!terms.length) fail('C2.terms-file', 'TERMS_FILE has no usable rules')
    } catch (e) {
      fail('C2.terms-file', `cannot read TERMS_FILE: ${e.code || e.message}`)
    }
  }
  // Matches are reported by rule label and line, never by the matched text: some rules
  // hold names that must not reach logs.
  for (const c of corpora) {
    if (c.termsSkip) continue
    if (!c.text) {
      warn(`C2.${c.name}`, 'no content to scan (missing or empty)')
      continue
    }
    const hits = terms.filter((t) => t.re.test(c.text))
    for (const t of hits) fail(`C2.${c.name}`, `matches TERMS_FILE rule "${t.label}" (line ${t.line})`)
    const emoji = findEmoji(c.text)
    if (emoji.length) fail(`C2.emoji.${c.name}`, `${emoji.length} emoji/pictograph: ${[...new Set(emoji.map((e) => e.cp))].join(' ')}`)
    if (!hits.length && !emoji.length) pass(`C2.${c.name}`, `${terms.length} rules, no emoji`)
  }

  if (!REPO) return
  for (const f of ['AGENTS.md', 'CLAUDE.md'])
    check(!existsSync(path.join(REPO_ROOT, f)), `C2.repo.${f}`, `${f} absent at repo root`, `${f} exists at repo root`)
  const TEXT_EXT = /\.(m?[jt]sx?|cjs|css|scss|json|md|mdx|txt|html?|svg|xml|webmanifest|ya?ml|toml)$/i
  const files = []
  const walk = (dir) => {
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile() && TEXT_EXT.test(e.name) && statSync(p).size < 5_000_000) files.push(p)
    }
  }
  walk(path.join(REPO_ROOT, 'src'))
  walk(path.join(REPO_ROOT, 'public'))
  let bad = 0
  for (const f of files) {
    const rel = path.relative(REPO_ROOT, f).replace(/\\/g, '/')
    const text = readFileSync(f, 'utf8')
    for (const t of terms) {
      const g = new RegExp(t.re.source, 'giu')
      const m = g.exec(text)
      if (m) {
        bad++
        fail('C2.repo', `${rel}:${lineOf(text, m.index)} matches TERMS_FILE rule "${t.label}" (line ${t.line})`)
      }
    }
    const emoji = findEmoji(text)
    if (emoji.length) {
      bad++
      fail('C2.repo.emoji', `${rel}:${lineOf(text, emoji[0].index)} ${emoji.map((e) => e.cp).slice(0, 5).join(' ')}`)
    }
  }
  if (!bad) pass('C2.repo', `${files.length} text files under src/ and public/ clean`)
})

// ---------------------------------------------------------------- C4 voice

await section('C4', async () => {
  if (!HOME_OK) {
    fail('C4.home', `cannot read / (${fetchErr(home)}); C4 skipped`)
    return
  }
  const voice = corpora.filter((c) => c.voice && c.text)
  const scan = (id, re, cs, label) => {
    let found = 0
    for (const c of cs) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
      for (const m of c.text.matchAll(g)) {
        found++
        if (found <= 5) fail(id, `${c.name}: ${label || 'found'} ${q(m[0], 40)} in ${q(snippet(c.text, m.index, m[0].length), 110)}`)
      }
    }
    if (found > 5) fail(id, `${found - 5} more`)
    if (!found) pass(id, `none in ${cs.map((c) => c.name).join(', ')}`)
  }
  // Every voice rule applies to all public text (title, meta, structured data, alt text,
  // llms.txt, manifest), not only the page body.
  scan('C4.exclamation', /!/, voice)
  scan('C4.new-delhi', /\bNew\s+Delhi\b/i, voice)
  const H = '[-\\u2010\\u2011]'
  const MON = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?'
  scan('C4.range-dash', new RegExp(
    `\\b(?:19|20)\\d{2}\\s*${H}\\s*(?:\\d{2}(?:\\d{2})?\\b(?!${H}\\d)|present\\b|now\\b|today\\b)` +
      `|\\b${MON}(?:\\s+\\d{4})?\\s*${H}\\s*(?:${MON}\\s+)?(?:\\d{4}|present)\\b`, 'i'), voice, 'hyphenated range')
  scan('C4.weak-verbs', /\b(helped with|worked on|responsible for)\b/i, voice)
  scan('C4.tech-names', /\b(?:MongoDB|MySQL|OAuth|JWT|MERN|Redux|Bootstrap|Tailwind|Mapbox|TensorFlow|PyTorch)\b|\bNext\.?js\b/i, voice)
  scan('C4.tech-names-cs', /\b(?:React|Node|Express)\b/, voice)

  // ideasIQ casing: only 'ideasIQ' or the domain 'ideasiq.ai'
  let badCase = 0
  for (const c of corpora.filter((c) => c.text && c.name !== 'json-ld-prose')) {
    for (const m of c.text.matchAll(/ideasiq/gi)) {
      if (m[0] === 'ideasIQ' || c.text.startsWith('ideasiq.ai', m.index)) continue
      badCase++
      if (badCase <= 5) fail('C4.ideasiq-case', `${c.name}: ${q(m[0])} in ${q(snippet(c.text, m.index, 7), 100)}`)
    }
  }
  if (!badCase) pass('C4.ideasiq-case', 'every occurrence is ideasIQ or ideasiq.ai')

  // Work items
  const byId = Object.fromEntries(SELECTED_WORK.items.map((i) => [i.id, i]))
  const item = (id) => (byId[id] ? findWorkItem(byId[id]) : null)
  const mli = item('myleadsiq')
  if (!mli) fail('C4.item-myleadsiq', 'myLeadsIQ item not found')
  else {
    const a = mli.querySelectorAll('a').length
    const founder = /founder/i.test(textOf(mli))
    check(!a && !founder, 'C4.item-myleadsiq', 'no link, no "founder"', [a && `${a} <a>`, founder && 'mentions founder'].filter(Boolean).join('; '))
  }
  const dp = item('docpad')
  if (!dp) fail('C4.item-docpad', 'DocPad item not found')
  else check(!dp.querySelectorAll('a').length, 'C4.item-docpad', 'no link', `${dp.querySelectorAll('a').length} <a> in DocPad item`)
  const iq = item('ideasiq')
  if (!iq) fail('C4.item-ideasiq', 'ideasIQ item not found')
  else
    check(iq.querySelectorAll('a').some((a) => a.getAttribute('href') === 'https://ideasiq.ai/'), 'C4.item-ideasiq',
      'links https://ideasiq.ai/', 'no <a href="https://ideasiq.ai/"> in the ideasIQ item')

  // Oxford commas fail everywhere except inside these spec §3 strings, which are final copy
  // and already contain one. The list is frozen: a new string with a serial comma fails.
  const allow = [
    HERO.subline,
    SELECTED_WORK.subline,
    SELECTED_WORK.items[0].summary,
    SELECTED_WORK.items[0].bullets[2],
    ABOUT.paragraph.map((s) => (typeof s === 'string' ? s : s.text)).join(''),
    CONTACT.body,
  ].map(norm)
  let oxford = 0
  for (const c of voice) {
    const covered = []
    for (const s of allow) for (let i = c.text.indexOf(s); i >= 0; i = c.text.indexOf(s, i + 1)) covered.push([i, i + s.length])
    for (const m of c.text.matchAll(/,\s(and|or)\s/g)) {
      if (covered.some(([s, e]) => m.index >= s && m.index < e)) continue
      oxford++
      if (oxford <= 5) fail('C4.oxford-comma', `${c.name}: ${q(snippet(c.text, m.index, m[0].length, 50), 120)}`)
    }
  }
  if (!oxford) pass('C4.oxford-comma', `none outside the ${allow.length} allow-listed spec §3 strings`)

  // American spellings the British-spelling rule (§7 rule 10) would catch.
  scan(
    'C4.us-spelling',
    /\b(?:optimiz\w*|organiz\w*|productiz\w*|prioritiz\w*|analyz\w*|realiz\w*|recogniz\w*|customiz\w*|monetiz\w*|standardiz\w*|utiliz\w*|color\w*|center(?:ed|s)?|behavior\w*|modeling|modeled|catalog|favorite\w*|honor\w*)\b/i,
    voice,
  )
})

// ---------------------------------------------------------------- SHARE

function headProblems(res) {
  if (!res.ok || res.status !== 200) return [`GET / ${fetchErr(res)}`]
  const p = []
  const end = res.buf.indexOf('</head>')
  if (end < 0) return ['no </head> in response']
  if (end > 300 * 1024) p.push(`</head> ends at byte ${end}, beyond the first 300 KB`)
  const head = parse(res.buf.subarray(0, Math.min(end, 300 * 1024)).toString('utf8') + '</head>', { comment: false })
  const metas = (k) =>
    head.querySelectorAll('meta').filter((m) => m.getAttribute('property') === k || m.getAttribute('name') === k).map((m) => m.getAttribute('content') ?? '')
  const one = (k) => {
    const v = metas(k)
    if (!v.length) p.push(`missing ${k}`)
    else if (v.length > 1) p.push(`${v.length}x ${k}`)
    return v[0]
  }
  const eq = (k, want) => {
    const v = one(k)
    if (v != null && norm(v) !== norm(String(want))) p.push(`${k}=${q(v, 50)} expected ${q(want, 50)}`)
  }
  eq('og:title', SHARE.title)
  eq('og:description', SHARE.ogDescription)
  const ogUrl = one('og:url')
  if (ogUrl != null && !/^https:\/\//.test(ogUrl)) p.push(`og:url not absolute https: ${q(ogUrl)}`)
  const ogImage = one('og:image')
  if (ogImage != null && !/^https:\/\//.test(ogImage)) p.push(`og:image not absolute https: ${q(ogImage)}`)
  eq('og:image:width', OG_IMAGE.width)
  eq('og:image:height', OG_IMAGE.height)
  eq('og:image:type', OG_IMAGE.type)
  eq('og:image:alt', OG_IMAGE.alt)
  eq('og:type', 'profile')
  eq('profile:first_name', PERSON.firstName)
  eq('profile:last_name', PERSON.lastName)
  eq('twitter:card', 'summary_large_image')
  const tw = one('twitter:image')
  if (tw != null && !/^https:\/\//.test(tw)) p.push(`twitter:image not absolute https: ${q(tw)}`)
  eq('twitter:image:alt', OG_IMAGE.alt)
  const canon = head.querySelectorAll('link').filter((l) => (l.getAttribute('rel') || '').toLowerCase().split(/\s+/).includes('canonical'))
  if (canon.length !== 1) p.push(`${canon.length} canonical links`)
  else if (!/^https?:\/\//.test(canon[0].getAttribute('href') || '')) p.push(`canonical not absolute: ${q(canon[0].getAttribute('href'))}`)
  const robotsMeta = metas('robots')
  if (!robotsMeta.some((v) => /max-image-preview\s*:\s*large/i.test(v))) p.push('meta robots lacks max-image-preview:large')
  if (metas('keywords').length) p.push('meta keywords present')
  return p
}

let ogImageUrl = null
await section('SHARE', async () => {
  const results = await Promise.all(
    Object.entries(UAS).map(async ([name, ua]) => [name, headProblems(await get(at('/'), { ua, accept: HTML_ACCEPT }))]),
  )
  for (const [name, problems] of results) {
    if (name === 'chrome') {
      for (const pr of problems) fail('SHARE.head', pr)
      if (!problems.length) pass('SHARE.head', 'all share tags present in <head>, canonical ok, robots ok, no keywords')
    } else check(!problems.length, `SHARE.ua.${name}`, 'head ok', `${problems.length} problem(s): ${problems.join('; ')}`)
  }
  if (headEl) ogImageUrl = headEl.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null

  // next/font should preload both Poppins files. Windows builds of Next 16.3.8 drop these
  // links (a path-separator bug in the font manifest), so a local miss is only a warning;
  // the Linux build on Vercel must have them.
  const fontPreloads = [...(home.text ?? '').matchAll(/<link\b[^>]*rel="preload"[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => /as="font"/.test(tag) && /\/_next\/static\/media\/[^"]+\.p\.woff2/.test(tag))
  if (fontPreloads.length === 2) pass('SHARE.font-preload', '2 woff2 font preloads in <head>')
  else (PROFILE === 'local' ? warn : fail)('SHARE.font-preload', `${fontPreloads.length} font preload link(s), expected 2`)
})

// ---------------------------------------------------------------- LD

const ldTypes = (n) => [].concat(n?.['@type'] ?? [])
await section('LD', async () => {
  if (!HOME_OK) {
    fail('LD.home', `cannot read / (${fetchErr(home)})`)
    return
  }
  check(ldScripts.length === 1, 'LD.count', '1 application/ld+json block', `${ldScripts.length} application/ld+json blocks, expected 1`)
  if (!ldScripts.length) return
  if (ldError) {
    fail('LD.parse', `JSON-LD does not parse: ${ldError}`)
    return
  }
  pass('LD.parse', 'JSON-LD parses')
  const graph = Array.isArray(ld?.['@graph']) ? ld['@graph'] : null
  if (!graph) {
    fail('LD.graph', 'no @graph array')
    return
  }
  const find = (t) => graph.find((n) => ldTypes(n).includes(t))
  const person = find('Person')
  const page = find('ProfilePage')
  const site = find('WebSite')
  const missing = [!person && 'Person', !page && 'ProfilePage', !site && 'WebSite'].filter(Boolean)
  check(!missing.length, 'LD.types', '@graph has Person, ProfilePage, WebSite', `@graph lacks ${missing.join(', ')}`)

  if (person) {
    let wf = [].concat(person.worksFor ?? [])[0]
    if (wf && wf['@id'] && !wf.name) wf = graph.find((n) => n['@id'] === wf['@id']) || wf
    const id = wf?.['@id']
    check(id === 'https://ideasiq.ai/#organization' && wf?.name === 'ideasIQ', 'LD.worksFor', 'worksFor ideasIQ (#organization)',
      `worksFor @id=${q(id ?? '')} name=${q(wf?.name ?? '')}`)
  }

  const bad = []
  const walk = (v, p) => {
    if (typeof v === 'string') {
      if (/nexerah\.com/i.test(v)) bad.push(`${p} contains nexerah.com`)
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`))
    else if (v && typeof v === 'object') {
      if (typeof v.name === 'string' && /nexerah/i.test(v.name)) bad.push(`${p}.name ${q(v.name)}`)
      for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`)
    }
  }
  walk(ld, '$')
  check(!bad.length, 'LD.no-nexerah', 'no Nexerah-named node, no nexerah.com URL', bad.slice(0, 5).join('; '))

  if (page) {
    const dm = String(page.dateModified ?? '')
    check(dm.startsWith(UPDATED), 'LD.dateModified', dm, `ProfilePage.dateModified ${q(dm)} does not start with ${UPDATED}`)
  }
  if (person) {
    const img = [].concat(person.image ?? [])[0]
    const imgUrl = typeof img === 'string' ? img : img?.url || img?.contentUrl
    if (!imgUrl) fail('LD.person-image', 'Person.image missing')
    else {
      const r = await get(toBase(imgUrl))
      check(r.status === 200 && r.contentType.startsWith('image/png'), 'LD.person-image', `${imgUrl} 200 image/png`,
        `${imgUrl} -> ${fetchErr(r)} ${r.contentType}`)
    }
  }
})

// ---------------------------------------------------------------- T7 routes

await section('T7', async () => {
  check(home.status === 200 && home.contentType.startsWith('text/html'), 'T7.home', '/ 200 text/html', `/ -> ${fetchErr(home)} ${home.contentType}`)

  // robots.txt
  if (robots.status !== 200) fail('T7.robots', `/robots.txt -> ${fetchErr(robots)}`)
  else {
    const lines = robots.text.split(/\r?\n/).map((l) => l.trim())
    const stars = lines.filter((l) => /^user-agent\s*:\s*\*$/i.test(l)).length
    const sm = lines.filter((l) => /^sitemap\s*:/i.test(l))
    const want = `Sitemap: ${SITE_URL}/sitemap.xml`
    const problems = []
    if (!robots.contentType.startsWith('text/plain')) problems.push(`content-type ${q(robots.contentType)}`)
    if (stars !== 1) problems.push(`${stars} "User-agent: *" groups`)
    if (sm.length !== 1 || sm[0] !== want) problems.push(`Sitemap lines ${JSON.stringify(sm)}, expected [${q(want)}]`)
    check(!problems.length, 'T7.robots', '200 text/plain, one * group, one Sitemap line', problems.join('; '))
  }

  // sitemap.xml
  let sitemapLocs = []
  if (sitemap.status !== 200) fail('T7.sitemap', `/sitemap.xml -> ${fetchErr(sitemap)}`)
  else {
    sitemapLocs = [...sitemap.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'))
    const homeLocs = sitemapLocs.filter((l) => l === SITE_URL || l === SITE_URL + '/').length
    const problems = []
    if (homeLocs !== 1) problems.push(`${homeLocs} <loc> for the home page`)
    if (sitemap.text.includes('/work')) problems.push("contains '/work'")
    check(!problems.length, 'T7.sitemap', `200, ${sitemapLocs.length} <loc>, one home page`, problems.join('; '))
  }

  // llms.txt
  let llmsUrls = []
  if (llms.status !== 200) fail('T7.llms', `/llms.txt -> ${fetchErr(llms)}`)
  else {
    const lines = llms.text.replace(/^﻿/, '').split(/\r?\n/)
    const problems = []
    if (!llms.contentType.startsWith('text/plain')) problems.push(`content-type ${q(llms.contentType)}`)
    if (lines[0].trim() !== `# ${PERSON.name}`) problems.push(`first line ${q(lines[0])}`)
    if (!lines.some((l) => l.startsWith('> '))) problems.push("no '> ' line")
    // llmstxt.org: free-form details (lists included) may precede the first H2; list items
    // inside the H2 sections must be links.
    const firstH2 = lines.findIndex((l) => l.startsWith('## '))
    const sectionLines = firstH2 === -1 ? [] : lines.slice(firstH2)
    const badItems = sectionLines.filter((l) => /^\s*- /.test(l) && !/^\s*- \[[^\]]+\]\([^)\s]+\)/.test(l))
    if (badItems.length) problems.push(`${badItems.length} section list item(s) not a markdown link, first ${q(badItems[0].trim(), 60)}`)
    const missingWork = SELECTED_WORK.items.filter((i) => !llms.text.includes(i.name)).map((i) => i.name)
    if (missingWork.length) problems.push(`work items missing: ${missingWork.join(', ')}`)
    if (llms.text.includes('/work')) problems.push("contains '/work'")
    check(!problems.length, 'T7.llms', `200 text/plain, ${lines.filter((l) => /^\s*- /.test(l)).length} link items`, problems.join('; '))
    llmsUrls = [...llms.text.matchAll(/https?:\/\/[^\s)<>\]"']+/g)].map((m) => m[0].replace(/[.,;:]+$/, ''))
  }

  // manifest
  if (manifest.status !== 200) fail('T7.manifest', `/manifest.webmanifest -> ${fetchErr(manifest)}`)
  else {
    try {
      JSON.parse(manifest.text)
      pass('T7.manifest', '200, valid JSON')
    } catch (e) {
      fail('T7.manifest', `not JSON: ${e.message}`)
    }
  }

  // icon / apple-touch-icon / manifest links
  const iconLinks = doc.querySelectorAll('link').filter((l) => {
    const rel = (l.getAttribute('rel') || '').toLowerCase().split(/\s+/)
    return rel.includes('icon') || rel.includes('apple-touch-icon') || rel.includes('manifest')
  })
  if (HOME_OK && !iconLinks.length) fail('T7.icon-links', 'no icon, apple-touch-icon or manifest links in the HTML')
  const iconRes = await Promise.all(iconLinks.map(async (l) => [l.getAttribute('href'), await get(toBase(l.getAttribute('href') || ''))]))
  for (const [href, r] of iconRes) check(r.status === 200, 'T7.icon-link', `${href} 200`, `${href} -> ${fetchErr(r)}`)

  // og:image and avatar
  if (!ogImageUrl) fail('T7.og-image', 'no og:image to fetch')
  else {
    const r = await get(toBase(ogImageUrl))
    check(r.status === 200 && r.contentType.startsWith('image/png'), 'T7.og-image', `${ogImageUrl} 200 image/png`, `${ogImageUrl} -> ${fetchErr(r)} ${r.contentType}`)
  }
  const av = await get(at(AVATAR.src))
  check(av.status === 200 && av.contentType.startsWith('image/png'), 'T7.avatar', `${AVATAR.src} 200 image/png`, `${AVATAR.src} -> ${fetchErr(av)} ${av.contentType}`)

  // same-site URLs listed in sitemap.xml and llms.txt
  const urls = [...new Set([...sitemapLocs, ...llmsUrls].filter(isSameSite))]
  const linkRes = await Promise.all(urls.map(async (u) => [u, await get(toBase(u), { redirect: 'manual' })]))
  let linkBad = 0
  for (const [u, r] of linkRes) {
    const isResume = new URL(u).pathname === RESUME_PATH
    const ok = r.status === 200 || (isResume && r.status === 307)
    if (!ok) {
      linkBad++
      fail('T7.listed-url', `${u} -> ${fetchErr(r)}${r.location ? ` Location ${r.location}` : ''}`)
    }
  }
  if (!urls.length) warn('T7.listed-url', 'no same-site URLs found in sitemap.xml or llms.txt')
  else if (!linkBad) pass('T7.listed-url', `${urls.length} same-site URLs from sitemap.xml and llms.txt return 200`)

  // /resume
  const rs = await get(at(RESUME_PATH), { redirect: 'manual' })
  if (!rs.ok) fail('T7.resume', `${RESUME_PATH} request failed: ${rs.error}`)
  else if (rs.status === 404 || (!rs.location && rs.status !== 200)) warn('T7.resume', `resume link not configured (${RESUME_PATH} -> ${rs.status})`)
  else if (!rs.location) fail('T7.resume', `${RESUME_PATH} -> ${rs.status} without a redirect`)
  else if (!DRIVE_RE.test(rs.location)) fail('T7.resume', `${RESUME_PATH} -> ${rs.status} Location does not match DRIVE_FILE_PATTERN`)
  else check(rs.status === 307, 'T7.resume', `${RESUME_PATH} 307 to a Drive file`, `${RESUME_PATH} -> ${rs.status}, expected 307`)

  for (const p of ['/api/send', '/this-path-should-not-exist']) {
    const r = await get(at(p), { redirect: 'manual' })
    check(r.status === 404, `T7.404`, `${p} 404`, `${p} -> ${fetchErr(r)}, expected 404`)
  }
})

// ---------------------------------------------------------------- T9

await section('T9', async () => {
  const where = [
    ['html', html],
    ['llms.txt', textOrEmpty(llms)],
    ['sitemap.xml', textOrEmpty(sitemap)],
    ['json-ld', ld ? JSON.stringify(ld) : ''],
  ].filter(([, t]) => /drive\.google/i.test(t))
  check(!where.length, 'T9.drive', 'no drive.google in HTML, llms.txt, sitemap.xml, JSON-LD', `drive.google found in ${where.map(([n]) => n).join(', ')}`)
})

// ---------------------------------------------------------------- T10 headers

await section('T10', async () => {
  const paths = ['/', '/robots.txt', '/llms.txt', OG_IMAGE.url, AVATAR.src]
  const once = [
    'strict-transport-security',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy',
    'x-frame-options',
    'cross-origin-opener-policy',
    'content-security-policy-report-only',
  ]
  const results = await Promise.all(paths.map(async (p) => [p, await rawGet(at(p))]))
  for (const [p, r] of results) {
    if (!r.ok) {
      fail(`T10.headers`, `${p} request failed: ${r.error}`)
      continue
    }
    const h = headerMap(r.rawHeaders)
    const fails = []
    const warns = []
    if (r.status !== 200) fails.push(`HTTP ${r.status}`)
    for (const name of once) {
      const n = (h.get(name) || []).length
      if (n === 1) continue
      if (n === 0 && name === 'strict-transport-security' && PROFILE === 'local') warns.push(`no ${name} (local)`)
      else fails.push(n ? `${name} sent ${n}x` : `no ${name}`)
    }
    if (h.has('x-powered-by')) fails.push('x-powered-by present')
    const pp = (h.get('permissions-policy') || []).join(',')
    for (const bad of ['clipboard', 'browsing-topics']) if (pp.includes(bad)) fails.push(`permissions-policy mentions ${bad}`)
    const csp = (h.get('content-security-policy-report-only') || []).join(';')
    for (const bad of ['nonce-', 'upgrade-insecure-requests']) if (csp.includes(bad)) fails.push(`CSP mentions ${bad}`)
    const id = `T10.headers`
    if (fails.length) fail(id, `${p}: ${[...fails, ...warns].join('; ')}`)
    else if (warns.length) warn(id, `${p}: ${warns.join('; ')}`)
    else pass(id, `${p}: security headers once each`)
  }
})

// ---------------------------------------------------------------- T11 icons

await section('T11', async () => {
  if (!HOME_OK) {
    fail('T11.home', `cannot read / (${fetchErr(home)})`)
    return
  }
  const links = doc.querySelectorAll('link').map((l) => ({
    rel: (l.getAttribute('rel') || '').toLowerCase().split(/\s+/),
    type: (l.getAttribute('type') || '').toLowerCase(),
    href: l.getAttribute('href') || '',
  }))
  const svg = links.filter((l) => l.rel.includes('icon') && l.type === 'image/svg+xml').length
  const fav = links.filter((l) => l.rel.includes('icon') && /favicon\.ico(\?|$)/i.test(l.href)).length
  const apple = links.filter((l) => l.rel.includes('apple-touch-icon')).length
  const man = links.filter((l) => l.rel.includes('manifest')).length
  check(svg === 1, 'T11.svg-icon', '1 image/svg+xml icon', `${svg} image/svg+xml icon links`)
  check(fav === 1, 'T11.favicon-link', '1 favicon.ico link', `${fav} favicon.ico links`)
  check(apple === 1, 'T11.apple-touch-icon', '1 apple-touch-icon', `${apple} apple-touch-icon links`)
  check(man === 1, 'T11.manifest-link', '1 manifest link', `${man} manifest links`)
  const ico = await get(at('/favicon.ico'))
  if (ico.status !== 200) fail('T11.favicon-bytes', `/favicon.ico -> ${fetchErr(ico)}`)
  else {
    const md5 = createHash('md5').update(ico.buf).digest('hex')
    check(!md5.startsWith('c30c7d42'), 'T11.favicon-bytes', `md5 ${md5.slice(0, 8)} (not create-next-app)`, `favicon.ico is the create-next-app default (md5 ${md5.slice(0, 8)})`)
  }
})

// ---------------------------------------------------------------- T12 crawler parity

await section('T12', async () => {
  if (PROFILE !== 'production') {
    skip('T12.parity', `crawler parity runs only with --profile production (profile ${PROFILE})`)
    return
  }
  const res = await Promise.all(Object.entries(CRAWLERS).map(async ([n, ua]) => [n, await get(at('/'), { ua, accept: HTML_ACCEPT })]))
  const texts = {}
  for (const [n, r] of res) {
    if (r.status !== 200) fail('T12.status', `${n} -> ${fetchErr(r)}`)
    else {
      const d = parse(r.text, { comment: false })
      for (const el of d.querySelectorAll('script, template, noscript, style')) el.remove()
      texts[n] = textOf(d.querySelector('body') || d)
    }
  }
  const ref = texts.Chrome
  if (ref == null) {
    fail('T12.parity', 'desktop Chrome did not get a 200')
    return
  }
  const differ = Object.entries(texts).filter(([, t]) => t !== ref).map(([n]) => n)
  check(!differ.length && Object.keys(texts).length === Object.keys(CRAWLERS).length, 'T12.parity',
    `${Object.keys(texts).length} user agents, identical body text (${ref.length} chars)`,
    differ.length ? `body text differs from Chrome for ${differ.join(', ')}` : 'not every user agent got a 200')
})

// ---------------------------------------------------------------- summary

console.log(`\n${counts.PASS} passed, ${counts.FAIL} failed, ${counts.WARN} warnings, ${counts.SKIP} skipped`)
process.exitCode = counts.FAIL ? 1 : 0
