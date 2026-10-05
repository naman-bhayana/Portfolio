// Gzip size of the JavaScript a modern browser downloads to load the prerendered home page.
// Next.js 16 no longer prints "First Load JS" in `next build`, so this script is the budget check.
//
// Budget: the framework baseline plus at most 15 KB of our own code. Next 16 + React 19 alone
// measured 127.9 KB gzip (webpack build) on an empty page on 3 Oct 2026. The page adds two
// small client pieces (copy email, count-up) and the rest is server HTML and CSS.
//
// Usage: npm run build && npm run budget
import { existsSync, readFileSync } from 'node:fs'
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
process.exit(total / 1024 <= BUDGET_KB ? 0 : 1)
