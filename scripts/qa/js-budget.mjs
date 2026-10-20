// Gzip size of the JavaScript a modern browser downloads to load the prerendered home page.
// Next.js 16 no longer prints "First Load JS" in `next build`, so this script is the budget check.
//
// Budget: the framework baseline plus at most 15 KB of our own code. Next 16 + React 19 alone
// measured 127.9 KB gzip (webpack build) on an empty page on 3 Oct 2026. The page adds two
// small client pieces (copy email, count-up) and the rest is server HTML and CSS.
//
// A build with the concierge (NEXT_PUBLIC_CONCIERGE=on) also has chunks the page never loads
// until the visitor asks for it: the panel, the ElevenLabs client and the QA mock. They are
// reported after the page, with budgets of their own (see the end of this file).
//
// Usage: npm run build && npm run budget
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

// Framework-only total for `next build --webpack` on next 16.3.8 + react 19.3.0.
// Re-measure on a placeholder page whenever next or react is upgraded.
const FRAMEWORK_BASELINE_KB = Number(process.env.FRAMEWORK_BASELINE_KB || 127.9)
const PAGE_BUDGET_KB = 15
const BUDGET_KB = FRAMEWORK_BASELINE_KB + PAGE_BUDGET_KB

const root = process.cwd()
const htmlFile = path.join(root, '.next', 'server', 'app', 'index.html')
if (!existsSync(htmlFile)) {
  console.error(`No prerendered home page at ${htmlFile}. Run \`npm run build\` first.`)
  process.exit(2)
}
const html = readFileSync(htmlFile, 'utf8')

// Legacy polyfills load with `nomodule`; modern browsers never fetch them.
const legacy = new Set()
for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) {
  const src = tag.match(/\bsrc="([^"]+)"/)?.[1]
  if (src && /\bnomodule\b/i.test(tag)) legacy.add(src.replace(/^.*?\/_next\//, ''))
}

// Script tags plus chunk references inside the inline RSC payload (client components).
// Next 16.3 can serve chunks from static/immutable/chunks/ as well as static/chunks/.
const refs = new Set()
for (const [ref] of html.matchAll(/static\/(?:immutable\/)?chunks\/[\w\-./[\]%~]+?\.js/g)) {
  if (!legacy.has(ref)) refs.add(ref)
}

function locate(ref) {
  for (const candidate of [ref, ref.replace('static/immutable/', 'static/')]) {
    const file = path.join(root, '.next', decodeURIComponent(candidate))
    if (existsSync(file)) return file
  }
  return null
}

const rows = []
for (const ref of refs) {
  const file = locate(ref)
  if (!file) {
    console.error(`Referenced chunk not found on disk: ${ref}`)
    process.exit(2)
  }
  rows.push({ ref, bytes: gzipSync(readFileSync(file)).length })
}
rows.sort((a, b) => b.bytes - a.bytes)

const kb = (bytes) => (bytes / 1024).toFixed(1).padStart(7)
for (const { ref, bytes } of rows) console.log(`${kb(bytes)} KB  ${ref}`)
const total = rows.reduce((sum, row) => sum + row.bytes, 0)
console.log(`${kb(total)} KB  total gzip, ${rows.length} files (budget ${BUDGET_KB.toFixed(1)} KB)`)
if (legacy.size) console.log(`          (skipped ${legacy.size} nomodule polyfill file${legacy.size > 1 ? 's' : ''})`)

const pageKb = total / 1024 - FRAMEWORK_BASELINE_KB
console.log(`${pageKb.toFixed(1).padStart(7)} KB  page code above the ${FRAMEWORK_BASELINE_KB} KB framework baseline (budget ${PAGE_BUDGET_KB} KB)`)
const pageOk = total / 1024 <= BUDGET_KB

// ---------------------------------------------------------------- the concierge's lazy chunks
// The launcher and the Contact entry are in the page, counted above. The rest is fetched only on
// intent (a click; hover, focus or touch warm the panel): the panel, the ElevenLabs client (with
// LiveKit, for voice) and the QA mock, which answers on 127.0.0.1 and localhost only. Each is
// found by what only it contains (browser-checks.mjs C9.concierge-quiet looks for the same) and
// none may be referenced by the prerendered home page. Budgets set against 17.1 KB for the
// panel and 158.0 KB for the client, measured on 16 Oct 2026 (@elevenlabs/client 1.28.0).
const PANEL_BUDGET_KB = 25
const CLIENT_BUDGET_KB = 190
const KINDS = [
  { kind: 'panel', label: 'panel', marker: /cg-statustext|cg-briefwrap/ },
  { kind: 'client', label: 'ElevenLabs client', marker: /livekit|@elevenlabs\/client/ },
  { kind: 'mock', label: 'QA mock', marker: /__cgMock/ },
]
const chunkDir = path.join(root, '.next', 'static', 'chunks')
const lazy = []
for (const name of existsSync(chunkDir) ? readdirSync(chunkDir, { recursive: true }) : []) {
  if (!String(name).endsWith('.js')) continue
  const file = path.join(chunkDir, String(name))
  const source = readFileSync(file)
  const text = source.toString('utf8')
  const kinds = KINDS.filter(({ marker }) => marker.test(text))
  if (!kinds.length) continue
  const ref = `static/chunks/${String(name).split(path.sep).join('/')}`
  lazy.push({ ref, kinds: kinds.map(({ kind }) => kind), label: kinds.map(({ label }) => label).join(' + '), bytes: gzipSync(source).length, referenced: html.includes(path.basename(file)) })
}

let conciergeOk = true
console.log('')
if (!lazy.length) console.log('          no concierge chunks: a build without NEXT_PUBLIC_CONCIERGE=on')
else {
  console.log('Concierge, fetched on intent only:')
  lazy.sort((a, b) => b.bytes - a.bytes)
  for (const { ref, label, bytes } of lazy) console.log(`${kb(bytes)} KB  ${ref}  ${label}`)
  const of = (kind) => lazy.filter((chunk) => chunk.kinds.includes(kind))
  const sum = (kind) => of(kind).reduce((total, chunk) => total + chunk.bytes, 0)
  const panel = sum('panel')
  const client = sum('client')
  console.log(`${kb(panel)} KB  panel${of('panel').length > 1 ? `, ${of('panel').length} chunks` : ''} (budget ${PANEL_BUDGET_KB} KB)`)
  console.log(`${kb(client)} KB  ElevenLabs client, ${of('client').length} chunk${of('client').length === 1 ? '' : 's'} (budget ${CLIENT_BUDGET_KB} KB)`)
  const problems = []
  if (!of('panel').length) problems.push('no panel chunk (cg-statustext, cg-briefwrap) of its own: the panel may be in the page bundle')
  if (panel / 1024 > PANEL_BUDGET_KB) problems.push(`the panel is over its ${PANEL_BUDGET_KB} KB budget`)
  if (client / 1024 > CLIENT_BUDGET_KB) problems.push(`the ElevenLabs client is over its ${CLIENT_BUDGET_KB} KB budget`)
  for (const { ref, label } of lazy.filter((chunk) => chunk.referenced)) problems.push(`${ref} (${label}) is referenced by the prerendered home page`)
  if (problems.length) {
    conciergeOk = false
    for (const problem of problems) console.log(`   FAIL   ${problem}`)
  } else console.log('          none is referenced by the prerendered home page')
}
process.exit(pageOk && conciergeOk ? 0 : 1)
