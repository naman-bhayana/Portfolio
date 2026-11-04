// Browser-level checks against a running build, using the locally installed Chrome
// (playwright-core downloads no browser). Complements verify-site.mjs, which works over HTTP.
//
// Usage: node scripts/qa/browser-checks.mjs <baseUrl> [--shots <dir outside the repo>]
// Env:   CHROME_PATH (default: the standard Windows install path)
//
// The concierge's gates (C9) run when the served page carries it (a build made with
// NEXT_PUBLIC_CONCIERGE=on) and are reported as skipped otherwise.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
import sharp from 'sharp'

const require = createRequire(import.meta.url)
const AXE_PATH = require.resolve('axe-core/axe.min.js')
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '')
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const shotsArg = process.argv.indexOf('--shots')
const SHOTS = shotsArg > -1 ? process.argv[shotsArg + 1] : null
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
// Style recalculations tolerated while the page rests for 2 s. One looping animation left on
// the main thread shows up as one per frame, well over a hundred.
const IDLE_RECALCS = 4
// Scrolling the whole page, on a phone taken to be four times slower than this machine: the
// total time tasks run past 50 ms, and the longest single task. Measured at 35-110 ms and
// 65-80 ms on 5 Oct 2026; an animation that lays out on every frame adds seconds.
const PHONE_SLOWDOWN = 4
const SCROLL_BLOCKING_MS = 250
const SCROLL_WORST_TASK_MS = 150
// The typed role line: how long a role must stand complete, and how many pixels the running
// line may differ from the same moment frozen. In step it differs by none; one web font's
// worth out of step, by 500 to 1,200 (5 Oct 2026).
const ROLE_HOLD_MS = 1000
const ROLE_LIVE_PIXELS = 20

let failures = 0
const report = (status, id, detail) => {
  if (status === 'FAIL') failures++
  console.log(`${status.padEnd(5)} ${id.padEnd(26)} ${detail}`)
}
const check = (ok, id, passDetail, failDetail) => report(ok ? 'PASS' : 'FAIL', id, ok ? passDetail : failDetail)
// A gate that photographs or reads a live page against its own clock can be let down by a busy
// machine (a screenshot that comes late on a throttled CPU). Such a gate gets a second attempt
// and fails only if both fail; every attempt's detail is printed.
async function timed(id, run, tries = 2) {
  const misses = []
  for (let attempt = 1; attempt <= tries; attempt++) {
    const { ok, pass, fail } = await run()
    if (ok) return report('PASS', id, misses.length ? `${pass} (attempt ${attempt}; before: ${misses.join(' || ')})` : pass)
    misses.push(fail)
  }
  report('FAIL', id, misses.join(' || '))
}

if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Set CHROME_PATH.`)
  process.exit(2)
}

// The concierge is in the served page when its Contact entry is: an element marked
// data-concierge, hidden until the page hydrates. On such a build the gates that measure the page
// wait for its launcher first, so they measure the page as a visitor gets it.
const served = await fetch(`${BASE}/`)
  .then((r) => r.text())
  .catch(() => '')
const CONCIERGE = /<[a-z][^>]*\sdata-concierge[\s=>]/i.test(served)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

async function newPage({ width, height, deviceScaleFactor = 1, javaScriptEnabled = true, reducedMotion = 'no-preference', mobile = false }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor,
    isMobile: mobile,
    hasTouch: mobile,
    javaScriptEnabled,
    reducedMotion,
  })
  return { context, page: await context.newPage() }
}

// ---------------------------------------------------------------- shared probes
// On a concierge build: wait until its launcher has arrived (after the hero, on the first scroll
// or once the browser is idle) and faded in (0.55 s). A launcher that never arrives fails as such.
async function withLauncher(page, id) {
  if (!CONCIERGE) return
  try {
    await page.waitForFunction(() => document.querySelector('.cg.cg-on'), null, { timeout: 15000 })
    await page.waitForTimeout(700)
  } catch {
    report('FAIL', `${id}.launcher`, 'the concierge launcher never arrived (no .cg.cg-on within 15 s)')
  }
}

// Scroll from top to bottom in steps, the way a reader would, and rest at the very end.
// Driven from here, not from a timer in the page, so it also works with JavaScript disabled.
async function scrollThrough(page, step = 300, pause = 60) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y <= height; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(pause)
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(500)
}

// Arrival blocks, and the parts of them the arrival moves, that have been reached (at or above
// the viewport) but are not fully opaque. A part that is not drawn at this width (no box) is
// not counted.
const stuckReveals = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-rv]')]
      .flatMap((el) => [el, ...el.children, ...el.querySelectorAll('.wcell, .node, .flagtext > *')])
      .filter((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().top < innerHeight && Number(getComputedStyle(el).opacity) < 0.99)
      .map((el) => el.id || String(el.className)),
  )

// The typed role line held still at one moment of its own clock, with the carets' blink at
// another. Paused animations are drawn by the main thread from fresh measurements.
const freezeRoles = (page, at, blinkAt = 0) =>
  page.evaluate(
    ({ at, blinkAt }) => {
      for (const animation of document.querySelector('.role .tw').getAnimations({ subtree: true })) {
        animation.pause()
        animation.currentTime = animation.animationName === 'blink' ? blinkAt : at
      }
    },
    { at, blinkAt },
  )

// When each typed role stands complete, in milliseconds on its animation's clock.
const roleHolds = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.role .tc')].map((box) => {
      const effect = box.getAnimations()[0].effect
      const { delay, duration } = effect.getComputedTiming()
      const complete = effect.getKeyframes().filter((frame) => parseFloat(frame.translate) === 0)
      return { start: delay, cycle: duration, from: delay + complete[0].computedOffset * duration, to: delay + complete.at(-1).computedOffset * duration }
    }),
  )

// The typed role line at one moment. For each role: how much of its text is inside its
// clipping box (0 to 1), whether the box and its caret are lit, and how far the caret is drawn
// from the open end of the text.
const roleLine = (page) =>
  page.evaluate(() => {
    const carets = [...document.querySelectorAll('.role .caret')]
    const mark = parseFloat(getComputedStyle(carets[0], '::before').left)
    return [...document.querySelectorAll('.role .tc')].map((box, i) => {
      const clip = box.getBoundingClientRect()
      const text = box.firstElementChild.getBoundingClientRect()
      const end = Math.min(clip.right, text.right)
      return {
        shown: Math.round((Math.max(0, end - Math.max(clip.left, text.left)) / text.width) * 100) / 100,
        lit: Number(getComputedStyle(box).opacity),
        caret: Number(getComputedStyle(carets[i]).opacity),
        gap: Math.round((carets[i].getBoundingClientRect().left + mark - end) * 10) / 10,
        inView: text.right <= innerWidth,
      }
    })
  })

// Pixels that clearly differ between two captures of the same box.
async function differingPixels(a, b) {
  const [x, y] = await Promise.all([a, b].map((png) => sharp(png).removeAlpha().raw().toBuffer()))
  if (x.length !== y.length) return Infinity
  let count = 0
  for (let i = 0; i < x.length; i += 3) {
    if (Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])) > 40) count++
  }
  return count
}

// Count-up figures that do not show the value the server rendered.
const unfinishedFigures = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-count]')].filter((el) => el.textContent !== el.dataset.count).map((el) => `${el.dataset.count} shows ${el.textContent}`),
  )

// ---------------------------------------------------------------- LCP element
for (const vp of [
  { name: '412x823', width: 412, height: 823, deviceScaleFactor: 1.75, mobile: true },
  { name: '360x640', width: 360, height: 640, deviceScaleFactor: 3, mobile: true },
  { name: '1280x800', width: 1280, height: 800 },
]) {
  // Reduced motion so full-page screenshots show below-the-fold blocks (a one-shot capture
  // never scrolls, so the reveal would otherwise leave them in their pre-reveal state).
  const { context, page } = await newPage({ ...vp, reducedMotion: 'reduce' })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await withLauncher(page, `T3.lcp.${vp.name}`)
  // The final candidate, not the first: on a cold load the name can paint a moment before the
  // avatar has decoded. The avatar is awaited, then the candidates are read once they settle.
  const lcp = await page.evaluate(async () => {
    const avatar = document.querySelector('.hero .stage img')
    await avatar?.decode().catch(() => {})
    await new Promise((r) => setTimeout(r, 300))
    return new Promise((resolve) => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const last = entries[entries.length - 1]
        const el = last?.element
        resolve({
          tag: el?.tagName?.toLowerCase() ?? null,
          text: el?.tagName === 'IMG' ? el.currentSrc : (el?.textContent ?? '').slice(0, 60),
          time: Math.round(last?.startTime ?? 0),
          size: last?.size ?? 0,
        })
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    })
  })
  const isAvatar = lcp.tag === 'img' && /naman-bhayana-avatar/.test(lcp.text)
  const id = `T3.lcp.${vp.name}`
  if (vp.name === '412x823') check(isAvatar, id, `avatar (${lcp.size}px², ${lcp.time} ms)`, `LCP is <${lcp.tag}> "${lcp.text}"`)
  else report(isAvatar ? 'PASS' : 'INFO', id, isAvatar ? `avatar (${lcp.size}px²)` : `<${lcp.tag}> "${lcp.text}" (informational)`)
  if (SHOTS) {
    await page.screenshot({ path: path.join(SHOTS, `viewport-${vp.name}.png`) })
    await page.screenshot({ path: path.join(SHOTS, `full-${vp.name}.png`), fullPage: true })
  }
  await context.close()
}

// ---------------------------------------------------------------- LCP on a phone, against the clock
// Lighthouse's mobile profile: 412 x 823, a CPU four times slower, 1.6 Mbps at 150 ms, a cold
// cache; three loads, the median. Judged against 2.5 s (Core Web Vitals' "good") on a deployed
// build. On a local Windows build it is reported, not judged: the first layout there waits on
// Windows looking up next/font's local() fallback faces, which a phone never does (measured
// 30 Oct 2026: 3.9 s with them, 1.9 s without, on the same load).
const LCP_BUDGET_MS = 2500
{
  const local = /^(127\.0\.0\.1|localhost)$/.test(new URL(BASE).hostname)
  const loads = []
  for (let i = 0; i < 3; i++) {
    const { context, page } = await newPage({ width: 412, height: 823, deviceScaleFactor: 1.75, mobile: true })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6e6 / 8) * 0.9, uploadThroughput: (750e3 / 8) * 0.9 })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.addInitScript(() => {
      window.__lcp = null
      new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1)
        window.__lcp = { at: Math.round(last.startTime), avatar: last.element?.tagName === 'IMG' && /naman-bhayana-avatar/.test(last.element.currentSrc) }
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    })
    await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 90000 })
    await page.waitForTimeout(1500)
    loads.push(await page.evaluate(() => ({ ...window.__lcp, fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1) })))
    await context.close()
  }
  const median = loads.map((l) => l.at).sort((a, b) => a - b)[1]
  const detail = `median LCP ${median} ms (loads ${loads.map((l) => `${l.at}${l.avatar ? '' : ' not the avatar'}`).join(', ')}; FCP ${loads.map((l) => l.fcp).join(', ')})`
  if (local) report('INFO', 'T3.lcp-budget.412x823', `${detail}; judged on a deployed build (budget ${LCP_BUDGET_MS} ms)`)
  else check(median <= LCP_BUDGET_MS && loads.every((l) => l.avatar), 'T3.lcp-budget.412x823', `${detail}, within ${LCP_BUDGET_MS} ms`, `${detail}; budget ${LCP_BUDGET_MS} ms`)
}

// ---------------------------------------------------------------- axe-core (WCAG 2.2 AA)
for (const vp of [
  { name: '360', width: 360, height: 800, mobile: true },
  { name: '1280', width: 1280, height: 800 },
]) {
  const { context, page } = await newPage({ ...vp, reducedMotion: 'reduce' })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  // The concierge's launcher is audited with the page; its open panel in C9.concierge-axe.
  await withLauncher(page, `T4.axe.${vp.name}`)
  await page.addScriptTag({ path: AXE_PATH })
  const run = (values) =>
    page.evaluate(
      (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations', 'incomplete'] }),
      values,
    )
  const main = await run(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
  const experimental = await run(['wcag21a', 'experimental'])
  const violations = [...main.violations, ...experimental.violations]
  const severe = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  check(
    severe.length === 0,
    `T4.axe.${vp.name}`,
    `0 serious/critical (${violations.length} minor/moderate: ${violations.map((v) => v.id).join(', ') || 'none'})`,
    severe.map((v) => `${v.id} [${v.impact}] x${v.nodes.length}: ${v.nodes[0]?.target}`).join(' | '),
  )
  const contrastToCheck = main.incomplete.filter((i) => i.id === 'color-contrast')
  if (contrastToCheck.length)
    report('INFO', `T4.contrast-manual.${vp.name}`, `${contrastToCheck[0].nodes.length} node(s) need a manual contrast check: ${contrastToCheck[0].nodes.map((n) => n.target).join(', ')}`)
  await context.close()
}

// ---------------------------------------------------------------- late web fonts (CLS)
// With the woff2 files delayed, the font swap must not move the layout at Lighthouse's mobile
// viewport. 360x640 is reported only. Reduced motion isolates the swap from the animations.
for (const vp of [
  { name: '412x823', width: 412, height: 823, gate: true },
  { name: '360x640', width: 360, height: 640, gate: false },
]) {
  const { context, page } = await newPage({ width: vp.width, height: vp.height, mobile: true, reducedMotion: 'reduce' })
  await page.route(/\.woff2(\?.*)?$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await route.continue()
  })
  await page.addInitScript(() => {
    window.__cls = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto(`${BASE}/`, { waitUntil: 'load' })
  await page.waitForTimeout(4000)
  const cls = await page.evaluate(() => window.__cls)
  const id = `T8.late-font-cls.${vp.name}`
  if (vp.gate) check(cls <= 0.05, id, `CLS ${cls.toFixed(3)} with fonts delayed 2.5 s`, `CLS ${cls.toFixed(3)} with fonts delayed 2.5 s (budget 0.05)`)
  else report('INFO', id, `CLS ${cls.toFixed(3)} with fonts delayed 2.5 s (display: swap kept; informational)`)
  await context.close()
}

// ---------------------------------------------------------------- reflow (WCAG 1.4.10, 1.4.12)
// Laptop widths too: the hero glow must never make the page scroll sideways.
for (const width of [1024, 1100]) {
  const { context, page } = await newPage({ width, height: 800, reducedMotion: 'reduce' })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }))
  check(sizes.scrollWidth <= sizes.width, `T4.reflow-${width}`, `no horizontal overflow at ${width} px`, JSON.stringify(sizes))
  await context.close()
}
for (const [width, textSpacing] of [[320, false], [320, true], [390, false], [390, true]]) {
  const { context, page } = await newPage({ width, height: 640, mobile: true, reducedMotion: 'reduce' })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  if (textSpacing) {
    await page.addStyleTag({
      content:
        '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
    })
  }
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth
    // The marquee and the scenes' lights are decorative and clipped on purpose. A caret is an
    // empty box as wide as its role, moved to the end of the line; only its mark shows.
    const wide = [...document.querySelectorAll('main *, header *, footer *')]
      .filter((el) => !el.closest('.mq, .caret, .light, .phalo') && el.getBoundingClientRect().right > width + 0.5)
      .map((el) => el.id || el.tagName.toLowerCase())
    return { scrollWidth: document.documentElement.scrollWidth, width, wide: [...new Set(wide)].slice(0, 6) }
  })
  const id = textSpacing ? `T4.reflow-${width}-spacing` : `T4.reflow-${width}`
  check(overflow.scrollWidth <= overflow.width && overflow.wide.length === 0, id, `no horizontal overflow at ${width} px${textSpacing ? ' with text-spacing overrides' : ''}`, JSON.stringify(overflow))
  await context.close()
}

// ---------------------------------------------------------------- narrow header over the deck
// On the narrowest phones the header must stay two rows (brand row, links row) and the deck's
// pinned cases must sit below it, never under it.
for (const width of [360, 370, 374]) {
  const { context, page } = await newPage({ width, height: 760, mobile: true, reducedMotion: 'reduce' })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const header = await page.evaluate(() => Math.round(document.querySelector('header.nav').getBoundingClientRect().height))
  const pinned = await page.evaluate(async () => {
    const first = document.querySelector('.deck .case')
    const top0 = parseFloat(getComputedStyle(first).top)
    window.scrollTo({ top: first.getBoundingClientRect().top + window.scrollY - top0 + 40, behavior: 'instant' })
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return { caseTop: Math.round(first.getBoundingClientRect().top), headerBottom: Math.round(document.querySelector('header.nav').getBoundingClientRect().bottom), top0 }
  })
  check(header <= 107 && pinned.caseTop >= pinned.headerBottom - 1, `T4.header-deck.${width}`, `header ${header} px, two rows; the pinned case sits ${pinned.caseTop - pinned.headerBottom} px below it`, JSON.stringify({ header, ...pinned }))
  await context.close()
}

// ---------------------------------------------------------------- the wall's descriptors
// A pointer uncovers a mark's descriptor; on a touch screen from tablets up it stands under the
// mark (nothing hovers there); phones show the marks alone. The marks sit in centred rows in
// every layout: a shorter row is centred under the one above, never left ragged to one side.
for (const [name, viewport, want] of [
  ['tablet-touch', { width: 1024, height: 768, mobile: true }, 'shown'],
  ['laptop-pointer', { width: 1280, height: 800 }, 'on hover'],
  ['phone-touch', { width: 390, height: 844, mobile: true }, 'hidden'],
]) {
  const { context, page } = await newPage({ ...viewport, reducedMotion: 'reduce' })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.querySelector('.wall').scrollIntoView({ block: 'center', behavior: 'instant' }))
  await page.waitForTimeout(400)
  const shown = () => page.evaluate(() => [...document.querySelectorAll('.wdesc')].map((el) => Number(getComputedStyle(el).opacity)))
  const before = await shown()
  let ok
  let detail = { before }
  if (want === 'shown') ok = before.every((o) => o === 1)
  else if (want === 'hidden') ok = before.every((o) => o === 0)
  else {
    await page.hover('.wcell')
    await page.waitForTimeout(400)
    const after = await shown()
    detail = { before, after }
    ok = before.every((o) => o === 0) && after[0] === 1 && after.slice(1).every((o) => o === 0)
  }
  // Centred rows: in each row the space left of the first mark equals the space right of the
  // last, and the label sits on a row of its own above them.
  const rows = await page.evaluate(() => {
    const grid = document.querySelector('.wlist').getBoundingClientRect()
    const byRow = new Map()
    for (const el of document.querySelectorAll('.wcell')) {
      const r = el.getBoundingClientRect()
      const top = Math.round(r.top)
      const row = byRow.get(top) ?? { left: Infinity, right: -Infinity, n: 0 }
      row.left = Math.min(row.left, r.left)
      row.right = Math.max(row.right, r.right)
      row.n++
      byRow.set(top, row)
    }
    const sizes = [...byRow.values()].map((row) => row.n)
    const ragged = [...byRow.values()].filter((row) => Math.abs(row.left - grid.left - (grid.right - row.right)) > 3).length
    const label = document.querySelector('.wlabel').getBoundingClientRect()
    return { rows: sizes.join('+'), ragged, labelAbove: label.bottom <= Math.min(...byRow.keys()) + 1 }
  })
  check(ok && rows.ragged === 0 && rows.labelAbove, `T4.wall-desc.${name}`, `descriptors ${want}; rows of ${rows.rows} marks, each centred`, JSON.stringify({ ...detail, rows }))
  await context.close()
}

// ---------------------------------------------------------------- accessible link names
// Every link's computed accessible name must equal its visible text (WCAG 2.5.3). Read from
// Chrome's accessibility tree: Playwright's own snapshots normalise whitespace and would miss
// names broken up by line-break hints. "Visible text" leaves out aria-hidden decoration.
{
  const { context, page } = await newPage({ width: 320, height: 640, mobile: true, reducedMotion: 'reduce' })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const cdp = await context.newCDPSession(page)
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'a[href]' })
  const mismatches = []
  for (const nodeId of nodeIds) {
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false })
    const name = nodes[0]?.name?.value ?? ''
    const { object } = await cdp.send('DOM.resolveNode', { nodeId })
    const { result } = await cdp.send('Runtime.callFunctionOn', {
      objectId: object.objectId,
      functionDeclaration:
        'function () { const c = this.cloneNode(true); c.querySelectorAll("[aria-hidden=true]").forEach((e) => e.remove()); return c.textContent.replace(/\\s+/g, " ").trim() }',
      returnByValue: true,
    })
    if (name !== result.value) mismatches.push(`"${name}" vs text "${result.value}"`)
  }
  check(mismatches.length === 0, 'T4.link-names', `${nodeIds.length} links: accessible name = visible text`, mismatches.join(' | '))
  await context.close()
}

// ---------------------------------------------------------------- JavaScript disabled
{
  const { context, page } = await newPage({ width: 1280, height: 800, javaScriptEnabled: false })
  await page.goto(`${BASE}/`, { waitUntil: 'load' })
  const state = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll('main section, #proof, footer')]
    const invisible = blocks.filter((el) => {
      const s = getComputedStyle(el)
      return s.opacity !== '1' || s.visibility === 'hidden' || s.display === 'none' || el.getBoundingClientRect().height === 0
    })
    const img = document.querySelector('main img')
    return {
      blocks: blocks.length,
      invisible: invisible.map((el) => el.id || el.tagName.toLowerCase()),
      h1: document.querySelector('h1')?.textContent,
      avatarLoaded: !!img && img.complete && img.naturalWidth > 0,
      copyButtonHidden: document.querySelector('[data-copy-email]')?.hidden ?? null,
    }
  })
  check(state.invisible.length === 0, 'C1.js-off.visible', `${state.blocks} blocks visible`, `hidden without JS: ${state.invisible.join(', ')}`)
  check(state.avatarLoaded, 'C1.js-off.avatar', 'avatar renders', 'avatar did not load')
  check(state.copyButtonHidden === true, 'C1.js-off.copy-button', 'copy button stays hidden without JS', 'copy button visible without JS')
  // The reveals are CSS, so they still run; the figures are never zeroed without the island.
  await scrollThrough(page)
  const stuck = await stuckReveals(page)
  const figures = await unfinishedFigures(page)
  check(stuck.length === 0 && figures.length === 0, 'C1.js-off.motion', 'reveals finish and figures stay final without JS', JSON.stringify({ stuck, figures }))
  await context.close()
}

// ---------------------------------------------------------------- motion
// The page animates on purpose. These gates assert that motion always ends on the finished
// page, costs no layout stability, and can be switched off three ways: the operating-system
// preference, the pause switch, and no JavaScript (above).
{
  // Reduced motion: nothing animates, nothing waits, the pause switch has nothing to do.
  const { context, page } = await newPage({ width: 1280, height: 800, reducedMotion: 'reduce' })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await withLauncher(page, 'T8.reduced-motion')
  await scrollThrough(page, 400, 40)
  const reduced = await page.evaluate(() => ({
    animations: document.getAnimations().length,
    waiting: document.querySelectorAll('.rv-wait').length,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    pauseShown: getComputedStyle(document.querySelector('.pause')).display !== 'none',
  }))
  const roles = (await roleLine(page)).map((role) => `${role.shown}${role.lit ? '' : ' unlit'}`)
  const stuck = await stuckReveals(page)
  const figures = await unfinishedFigures(page)
  const firstRoleOnly = roles[0] === '1' && roles.slice(1).every((role) => role === '0 unlit')
  // At the page end the concierge's launcher has stepped aside for Contact, so it is measured on
  // screen as well: at the top, and folded further down. Nothing may move there either.
  const launcher = []
  if (CONCIERGE) {
    for (const top of [0, 1600]) {
      await page.evaluate((y) => window.scrollTo(0, y), top)
      await page.waitForTimeout(400)
      const state = await page.evaluate(() => {
        const el = document.getElementById('cg-launch')
        return { shown: !!el && getComputedStyle(el).visibility === 'visible', animations: document.getAnimations().length }
      })
      if (!state.shown || state.animations) launcher.push({ top, ...state })
    }
  }
  check(
    reduced.animations === 0 && reduced.waiting === 0 && reduced.scrollBehavior !== 'smooth' && !reduced.pauseShown && firstRoleOnly && stuck.length === 0 && figures.length === 0 && launcher.length === 0,
    'T8.reduced-motion',
    `no animations${CONCIERGE ? ' (the concierge launcher on screen too)' : ''}, everything visible, first role shown, figures final, pause switch hidden`,
    JSON.stringify({ ...reduced, roles, stuck, figures, ...(CONCIERGE ? { launcher } : {}) }),
  )
  await context.close()
}
{
  // The typed role line with a visitor's own text spacing (WCAG 1.4.12) and motion on, stepped
  // through one whole cycle. Each role is typed out in full and stands long enough to read,
  // its caret rides the end of the text, and no other role or caret shows while it does.
  const { context, page } = await newPage({ width: 1280, height: 800 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.addStyleTag({
    content: '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
  })
  const holds = await roleHolds(page)
  const STEP = 50
  const held = holds.map(() => 0)
  const cleared = holds.map(() => false) // the line stood empty after this role
  const problems = new Map() // the first of each kind is enough
  const note = (key, text) => problems.has(key) || problems.set(key, text)
  let last = null // the role most recently on show
  for (let at = 0; at < holds[0].cycle; at += STEP) {
    await freezeRoles(page, holds[0].start + at)
    const line = await roleLine(page)
    const onShow = line.flatMap((role, i) => (role.lit && role.shown ? [i] : []))
    const carets = line.flatMap((role, i) => (role.caret ? [i] : []))
    if (onShow.length > 1) note('together', `roles ${onShow.map((i) => i + 1).join(' and ')} on show together`)
    if (carets.length !== 1) note('carets', `${carets.length} carets lit at once`)
    line.forEach((role, i) => {
      if (!role.lit && role.shown) note(`away${i}`, `role ${i + 1} is unlit but not put away`)
    })
    if (onShow.length === 0) {
      if (last !== null) cleared[last] = true
      continue
    }
    const [i] = onShow
    last = i
    if (carets.length === 1 && carets[0] !== i) note(`caret${i}`, `caret ${carets[0] + 1} lit while role ${i + 1} is on show`)
    // The caret is drawn 2 px after the last character on show.
    if (Math.abs(line[i].gap - 2) > 1) note(`gap${i}`, `role ${i + 1}: caret ${line[i].gap}px after the text`)
    if (!line[i].inView) note(`view${i}`, `role ${i + 1} runs off the page`)
    if (line[i].shown === 1) held[i] += STEP
  }
  held.forEach((ms, i) => {
    if (ms < ROLE_HOLD_MS) note(`held${i}`, `role ${i + 1} stands complete for ${ms} ms`)
    if (!cleared[i]) note(`cleared${i}`, `role ${i + 1} is still on show when the next one starts`)
  })
  check(problems.size === 0, 'T8.typed-role-spacing', `${holds.length} roles type out in full, one at a time, with text-spacing overrides`, [...problems.values()].join(' | '))
  await context.close()
}
await timed('T8.typed-role-live', async () => {
  // The same line as a visitor gets it: running on the compositor of a slow phone, nothing
  // paused. A role is photographed while it stands complete and compared with the same moment
  // frozen. The two differ when the compositor is still working from positions taken before a
  // web font arrived, which is why MotionIsland.jsx starts the loops again once the fonts are
  // in. The first role stands when the page rests; the second starts out hidden.
  const { context, page } = await newPage({ width: 1280, height: 800, deviceScaleFactor: 2 })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: PHONE_SLOWDOWN })
  await page.goto(`${BASE}/`, { waitUntil: 'commit' })
  await page.waitForFunction(() => document.querySelector('.role .t1 .tc')?.getAnimations().length > 0)
  // The particle field drifts behind the line; the frames are compared without it.
  await page.addStyleTag({ content: '.field, .ambient { display: none !important; }' })
  const holds = (await roleHolds(page)).slice(0, 2)
  const clock = () =>
    page.evaluate(() => {
      const line = document.querySelector('.role .tw')
      const blink = line.getAnimations({ subtree: true }).find((animation) => animation.animationName === 'blink')
      const period = blink.effect.getComputedTiming().duration
      return { role: line.querySelector('.tc').getAnimations()[0].currentTime, blink: blink.currentTime % period, period }
    })
  const problems = []
  const live = []
  let clip
  let period
  for (const [i, hold] of holds.entries()) {
    // Aim for the caret's next "on" half once the role is complete.
    const now = await clock()
    period = now.period
    const typed = Math.max(0, hold.from + 120 - now.role)
    await page.waitForTimeout(typed + ((period - ((now.blink + typed) % period)) % period))
    clip ??= await page.evaluate(() => {
      const { left, top, width, height } = document.querySelector('.role').getBoundingClientRect()
      return { x: Math.floor(left) - 4, y: Math.floor(top) - 4, width: Math.ceil(width) + 8, height: Math.ceil(height) + 8 }
    })
    live.push(await page.screenshot({ clip }))
    const taken = (await clock()).role
    if (taken > hold.to) problems.push(`role ${i + 1} was photographed ${Math.round(taken - hold.to)} ms after it stopped standing complete`)
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  let caretSeen = 0
  for (const [i, hold] of holds.entries()) {
    const frozen = []
    for (const blinkAt of [period * 0.25, period * 0.75]) {
      await freezeRoles(page, (hold.from + hold.to) / 2, blinkAt)
      frozen.push(await page.screenshot({ clip }))
    }
    const [caretOn, caretOff] = await Promise.all(frozen.map((frame) => differingPixels(live[i], frame)))
    if (caretOn <= ROLE_LIVE_PIXELS) caretSeen++
    else if (caretOff > ROLE_LIVE_PIXELS) problems.push(`role ${i + 1} differs from the same moment frozen by ${Math.min(caretOn, caretOff)} px`)
    if (SHOTS) {
      writeFileSync(path.join(SHOTS, `typed-role-${i + 1}-live.png`), live[i])
      writeFileSync(path.join(SHOTS, `typed-role-${i + 1}-frozen.png`), frozen[0])
    }
  }
  if (problems.length === 0 && caretSeen === 0) problems.push('the caret was never caught lit, so its place went unchecked')
  await context.close()
  return {
    ok: problems.length === 0,
    pass: `the running line matches the frozen one for ${holds.length} roles on a ${PHONE_SLOWDOWN}x slower CPU (caret lit in ${caretSeen})`,
    fail: problems.join(' | '),
  }
})
{
  // Motion on: the hero has finished arriving 2.4 s after its first paint. A piece is still
  // arriving while it is transparent, scaled, or moved from its place (the chips keep
  // bobbing, so their translate is not read).
  const { context, page } = await newPage({ width: 1440, height: 900 })
  await page.goto(`${BASE}/`, { waitUntil: 'load' })
  await page.waitForFunction(() => {
    const [paint] = performance.getEntriesByName('first-contentful-paint')
    return paint && performance.now() >= paint.startTime + 2400
  })
  const unsettled = await page.evaluate(() => {
    const at = (value, rest) => value === 'none' || value.split(' ').every((part) => parseFloat(part) === rest)
    return [...document.querySelectorAll('.hero :is(.hello, .role, .lede, .cta, .name .l, .stage, .chip)')]
      .filter((el) => {
        const style = getComputedStyle(el)
        // The letters arrive by transform; everything else by translate, scale and opacity. The
        // chips keep bobbing and stand proud of the stage, so neither is read for them.
        const moved = el.matches('.name .l')
          ? !['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(style.transform)
          : !at(style.scale, 1) || (!el.matches('.chip') && !at(style.translate, 0))
        return Number(style.opacity) < 0.99 || moved
      })
      .map((el) => el.className)
  })
  check(unsettled.length === 0, 'T8.hero-settle', 'hero fully shown 2.4 s after first paint', `still arriving: ${[...new Set(unsettled)].join(', ')}`)

  // Count-up: untouched until a visitor shows up (a crawler or a link preview reads the real
  // numbers); from then on a figure waits at zero once it is within a screen of the fold, and
  // is back on the server's value once seen (520 ms of scramble, then 1.3 s of count).
  const shown = () => page.evaluate(() => [...document.querySelectorAll('#proof [data-count]')].map((el) => ({ text: el.textContent.trim(), final: el.dataset.count })))
  const untouched = await unfinishedFigures(page)
  await page.evaluate(() => window.scrollTo({ top: 2, behavior: 'instant' }))
  await page.waitForTimeout(300)
  const armed = await shown()
  for (const selector of ['#proof .pstage', '#proof .figs']) {
    await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), selector)
    await page.waitForTimeout(2300)
  }
  const figures = await unfinishedFigures(page)
  const waiting = armed.filter((figure) => figure.text === '0').length
  check(
    untouched.length === 0 && waiting > 0 && armed.every((figure) => figure.text === '0' || figure.text === figure.final) && figures.length === 0,
    'T8.count-up',
    `figures wait for a visitor, ${waiting} of ${armed.length} near the fold go to 0, all end on their server values`,
    JSON.stringify({ untouched, armed: armed.map((figure) => figure.text), figures }),
  )

  // Printing a page whose figures are still waiting at zero puts the real numbers back.
  const sheet = await context.newPage()
  await sheet.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await sheet.evaluate(() => window.scrollTo({ top: 2, behavior: 'instant' }))
  await sheet.waitForTimeout(300)
  const zeroed = (await unfinishedFigures(sheet)).length
  await sheet.emulateMedia({ media: 'print' })
  await sheet.waitForTimeout(200)
  const printed = await unfinishedFigures(sheet)
  check(zeroed > 0 && printed.length === 0, 'T8.count-up-print', `${zeroed} waiting figures show their real values in print`, JSON.stringify({ zeroed, printed }))
  // The page is dark and its accent text is a clipped gradient: printed without backgrounds,
  // those words would be blank. Print must keep its colours.
  const inks = await sheet.evaluate(() => [...document.querySelectorAll('.grad, .name .l, body')].filter((el) => getComputedStyle(el).printColorAdjust !== 'exact').length)
  check(inks === 0, 'T8.print-colours', 'gradient text and the ground keep their colours in print', `${inks} element(s) would print without their background`)
  await context.close()
}
for (const vp of [
  { name: '412x823', width: 412, height: 823, mobile: true },
  { name: '1440x2000', width: 1440, height: 2000 },
]) {
  // Scroll-driven reveals: tied to scroll, and none is left transparent, even at the page end.
  const { context, page } = await newPage(vp)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const driven = await page.evaluate(() => ({
    supported: CSS.supports('animation-timeline: view()'),
    timelines: ['.light', '.case', '.progress', '.pimg'].map((sel) => `${sel}=${getComputedStyle(document.querySelector(sel)).animationTimeline}`),
  }))
  if (!driven.supported) report('INFO', `T8.scroll-driven.${vp.name}`, 'this Chrome has no scroll-driven animations; the fallback path was exercised instead')
  else check(driven.timelines.every((t) => !/=auto(,|$)|=$/.test(t)), `T8.scroll-driven.${vp.name}`, driven.timelines.join('  '), `a reveal lost its timeline: ${driven.timelines.join('  ')}`)
  await scrollThrough(page)
  const stuck = await stuckReveals(page)
  check(stuck.length === 0, `T8.reveal-complete.${vp.name}`, 'every block is fully shown after a full scroll', `still transparent: ${stuck.join(', ')}`)
  await context.close()
}
for (const vp of [
  { name: '412x823', width: 412, height: 823, mobile: true },
  { name: '1440x900', width: 1440, height: 900 },
]) {
  // Layout stability with everything moving: load, wait for the hero, then a slow full scroll.
  const { context, page } = await newPage(vp)
  await page.addInitScript(() => {
    window.__cls = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2600)
  await scrollThrough(page, 200, 80)
  const cls = await page.evaluate(() => window.__cls)
  check(cls <= 0.05, `T8.motion-cls.${vp.name}`, `CLS ${cls.toFixed(4)} with motion on, load to footer`, `CLS ${cls.toFixed(4)} with motion on (budget 0.05)`)
  await context.close()
}
{
  // Pause switch (WCAG 2.2.2): second tab stop, Space pauses everything, a click resumes.
  const { context, page } = await newPage({ width: 1440, height: 900 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await withLauncher(page, 'T8.pause')
  const running = await page.evaluate(() => document.getAnimations().length)
  // On a concierge build the launcher's waveform is among them and must stop with the rest.
  const waves = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === 'cg-wave').length)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  const secondStop = await page.evaluate(() => ({ id: document.activeElement?.id, name: document.activeElement?.getAttribute('aria-label') }))
  await page.keyboard.press('Space')
  await page.waitForTimeout(200)
  const paused = await page.evaluate(() => ({
    checked: document.getElementById('pause-motion').checked,
    animations: document.getAnimations().length,
    // Everything an arrival or the deck could hold back: the blocks and their parts, the words
    // of split headlines, the wall's marks, and the veil over every case.
    transparent: [...document.querySelectorAll('[data-rv]')]
      .flatMap((el) => [el, ...el.children, ...el.querySelectorAll('.wcell, .wd, .node, .flagtext > *')])
      .filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length,
    veiled: [...document.querySelectorAll('.case')].filter((el) => Number(getComputedStyle(el, '::after').opacity) > 0.01).length,
    icons: [...document.querySelectorAll('.pause .ic')].map((el) => Number(getComputedStyle(el).opacity)).join(','),
  }))
  const figures = await unfinishedFigures(page)
  await page.locator('.pause').click()
  await page.waitForTimeout(400)
  const icons = await page.evaluate(() => [...document.querySelectorAll('.pause .ic')].map((el) => Number(getComputedStyle(el).opacity)).join(','))
  const resumed = await page.evaluate(() => ({
    checked: document.getElementById('pause-motion').checked,
    animations: document.getAnimations().length,
    // Resuming must not play the hero's arrival again, and brings smooth scrolling back.
    arriving: [...document.querySelectorAll('.hero :is(.lede, .cta, .chip)')].filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length,
    smooth: getComputedStyle(document.documentElement).scrollBehavior,
  }))
  check(
    running > 0 && (!CONCIERGE || waves > 0) && secondStop.id === 'pause-motion' && !!secondStop.name && paused.checked && paused.animations === 0 && paused.transparent === 0 && paused.veiled === 0 && paused.icons === '0,1' && figures.length === 0 && !resumed.checked && resumed.animations > 0 && resumed.arriving === 0 && resumed.smooth === 'smooth' && icons === '1,0',
    'T8.pause',
    `second tab stop "${secondStop.name}"; Space stops ${running} animations${CONCIERGE ? ` (the launcher's ${waves} waveform bars among them)` : ''}, shows everything and the play icon; a click resumes without replaying the arrival`,
    JSON.stringify({ running, ...(CONCIERGE ? { waves } : {}), secondStop, paused, figures, resumed, icons }),
  )

  // The switch must leave the page where it is: its checkbox is not at the top of the document.
  const jumps = []
  for (const [how, toggle] of [
    ['click', () => page.locator('.pause').click()],
    ['keyboard', async () => {
      await page.evaluate(() => document.getElementById('pause-motion').focus())
      await page.keyboard.press('Space')
    }],
  ]) {
    await page.evaluate(() => window.scrollTo({ top: 3000, behavior: 'instant' }))
    await page.waitForTimeout(200)
    await toggle()
    await page.waitForTimeout(700)
    const y = await page.evaluate(() => Math.round(scrollY))
    if (Math.abs(y - 3000) > 2) jumps.push(`${how}: 3000 -> ${y}`)
  }
  check(jumps.length === 0, 'T8.pause-in-place', 'using the pause switch does not scroll the page', jumps.join('; '))
  await context.close()
}

// ---------------------------------------------------------------- reduced motion turned off mid-page
// A visitor who turns their system's reduced motion off while the page is open gets motion from
// then on, but the first screen they are reading never blanks to replay its arrival.
{
  const { context, page } = await newPage({ width: 1440, height: 900, reducedMotion: 'reduce' })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const hidden = []
  for (const wait of [100, 600]) {
    await page.waitForTimeout(wait)
    hidden.push(
      ...(await page.evaluate(() =>
        [...document.querySelectorAll('.hero :is(.hello, .role, .lede, .cta, .chip), .wcell')].filter((el) => Number(getComputedStyle(el).opacity) < 0.99).map((el) => String(el.className)),
      )),
    )
  }
  check(hidden.length === 0, 'T8.reduced-flip', 'turning reduced motion off mid-page hides nothing and replays no arrival', `hidden after the switch: ${[...new Set(hidden)].join(', ')}`)
  await context.close()
}

// ---------------------------------------------------------------- the strip with less motion
// Nothing moves the services strip along, so every service must be on screen, once.
for (const vp of [
  { name: '1280', width: 1280, height: 800 },
  { name: '390', width: 390, height: 844, mobile: true },
]) {
  const { context, page } = await newPage({ ...vp, reducedMotion: 'reduce' })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const strip = await page.evaluate(() => {
    const cut = [...document.querySelectorAll('.mqg[aria-label] li')].filter((li) => {
      const box = li.getBoundingClientRect()
      return box.left < 0 || box.right > window.innerWidth + 0.5
    })
    const copies = [...document.querySelectorAll('.mqg[aria-hidden]')].filter((ul) => getComputedStyle(ul).display !== 'none')
    return { cut: cut.map((li) => li.textContent.trim()), copies: copies.length, items: document.querySelectorAll('.mqg[aria-label] li').length }
  })
  check(strip.items > 0 && strip.cut.length === 0 && strip.copies === 0, `T8.reduced-strip.${vp.name}`, `all ${strip.items} services show, once, without moving`, JSON.stringify(strip))
  await context.close()
}

// ---------------------------------------------------------------- the deck's recede
// Case 1 recedes from the moment case 2 enters the viewport to the moment case 2 is pinned (the
// approved design's timing): read at four scroll positions against the design's values.
{
  const { context, page } = await newPage({ width: 1440, height: 900 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const geometry = await page.evaluate(() => {
    const [c1, c2] = document.querySelectorAll('.deck .case')
    return { c2: Math.round(c2.getBoundingClientRect().top + window.scrollY), top: parseFloat(getComputedStyle(c1).top), step: parseFloat(getComputedStyle(c2).top) - parseFloat(getComputedStyle(c1).top), vh: window.innerHeight }
  })
  const at = async (y) => {
    await page.evaluate(async (y) => {
      window.scrollTo({ top: y, behavior: 'instant' })
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    }, y)
    await page.waitForTimeout(120)
    return page.evaluate(() => {
      const c1 = document.querySelector('.deck .case')
      const m = new DOMMatrix(getComputedStyle(c1).transform)
      return { scale: Math.round(m.a * 1000) / 1000, veil: Math.round(Number(getComputedStyle(c1, '::after').opacity) * 100) / 100 }
    })
  }
  const { c2, top, step, vh } = geometry
  // A fully covered case ends at this scale and veil (motion.css @keyframes recede and veil).
  const SCALE_END = 0.955
  const VEIL_END = 0.96
  const pinnedAt = c2 - top - step
  const progress = (y) => Math.min(1, Math.max(0, (y - (c2 - vh)) / (pinnedAt - (c2 - vh))))
  const problems = []
  for (const [y, name] of [
    [c2 - vh - 10, 'case 2 just below the viewport'],
    [c2 - vh / 2, 'case 2 half way up'],
    [c2 - top - 216, 'case 2 touching case 1'],
    [pinnedAt + 5, 'case 2 pinned'],
  ]) {
    const got = await at(y)
    const p = progress(y)
    const want = { scale: Math.round((1 - (1 - SCALE_END) * p) * 1000) / 1000, veil: Math.round(VEIL_END * p * 100) / 100 }
    if (Math.abs(got.scale - want.scale) > 0.004 || Math.abs(got.veil - want.veil) > 0.04) problems.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
  }
  check(problems.length === 0, 'T8.deck-recede', 'case 1 recedes from the moment case 2 enters the viewport to the moment it is pinned', problems.join(' | '))
  await context.close()
}

// ---------------------------------------------------------------- the wall's arrival
// Where the wall is on the first screen (laptops) its marks rise with the hero from 1.3 s and
// its light crosses from 1.9 s, as in the approved design. Where little or none of it shows at
// first (1366x768 shows a 5% sliver, 1280x720 none) it waits, hidden before its marks would
// have risen, and arrives as the reader reaches it.
const sinceFirstPaint = () => performance.now() - (performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? Infinity)
for (const vp of [
  { name: '1440x900', width: 1440, height: 900, onScreen: true },
  { name: '1536x864', width: 1536, height: 864, onScreen: true },
  { name: '1366x768', width: 1366, height: 768, onScreen: false },
  { name: '1280x720', width: 1280, height: 720, onScreen: false },
]) {
  const { context, page } = await newPage(vp)
  const read = () =>
    page.evaluate(() => {
      const wall = document.querySelector('.wall')
      return {
        cells: [...wall.querySelectorAll('.wcell')].map((el) => Math.round(Number(getComputedStyle(el).opacity) * 100) / 100),
        armed: wall.classList.contains('rv-armed'),
        waiting: wall.classList.contains('rv-wait'),
        light: wall.getAnimations({ subtree: true }).some((a) => a.effect?.pseudoElement === '::after'),
      }
    })
  let ok
  let detail
  if (vp.onScreen) {
    await page.goto(`${BASE}/`, { waitUntil: 'commit' })
    await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0, null, { polling: 'raf' })
    const at = await page.evaluate(sinceFirstPaint)
    const early = await read()
    await page.waitForFunction((ms) => performance.now() - performance.getEntriesByName('first-contentful-paint')[0].startTime >= ms, 2900)
    const late = await read()
    ok = at < 1200 && early.cells.every((o) => o < 0.05) && late.cells.every((o) => o > 0.99) && late.light && !late.armed
    detail = { at: Math.round(at), early, late }
  } else {
    await page.goto(`${BASE}/`, { waitUntil: 'load' })
    await page.waitForFunction(() => document.querySelector('.wall').classList.contains('rv-wait'), null, { timeout: 4000 }).catch(() => {})
    await page.waitForFunction((ms) => performance.now() - performance.getEntriesByName('first-contentful-paint')[0].startTime >= ms, 2900)
    const waiting = await read()
    await page.evaluate(() => window.scrollTo({ top: 320, behavior: 'instant' }))
    await page.waitForFunction(() => !document.querySelector('.wall').classList.contains('rv-wait'), null, { timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(2600)
    const arrived = await read()
    ok = waiting.waiting && waiting.armed && waiting.cells.every((o) => o < 0.05) && arrived.cells.every((o) => o > 0.99)
    detail = { waiting, arrived }
  }
  check(ok, `T8.wall-arrival.${vp.name}`, vp.onScreen ? 'on the first screen the marks rise with the hero and the light crosses' : 'below the fold the wall waits hidden and arrives when reached', JSON.stringify(detail))
  await context.close()
}

// ---------------------------------------------------------------- the rail's pulse
// The pulse starts at the first node once the rail has arrived, waits there 1.2 s (collapsed,
// not transparent), then crosses; no positive delay anywhere.
{
  const { context, page } = await newPage({ width: 1440, height: 900 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.documentElement.classList.contains('rv-on'))
  const before = await page.evaluate(() => document.querySelector('.rpulse').getAnimations().length)
  await page.evaluate(() => document.querySelector('.rail').scrollIntoView({ block: 'center', behavior: 'instant' }))
  await page.waitForFunction(() => document.querySelector('.railwrap').classList.contains('lit'), null, { timeout: 3000 }).catch(() => {})
  const pulse = () =>
    page.evaluate(() => {
      const el = document.querySelector('.rpulse')
      const [a] = el.getAnimations()
      const m = new DOMMatrix(getComputedStyle(el).transform)
      return a ? { name: a.animationName, delay: a.effect.getComputedTiming().delay, time: Math.round(a.currentTime), scale: Math.round(m.a * 100) / 100, x: Math.round(m.e), opacity: Number(getComputedStyle(el).opacity) } : null
    })
  const lit = await pulse()
  await page.waitForTimeout(900)
  const waitingAtNode = await pulse()
  await page.waitForTimeout(1100)
  const crossing = await pulse()
  // Every pulse rides the rail's line, not somewhere below it.
  const offLine = await page.evaluate(() => {
    const rail = document.querySelector('.rail')
    const line = rail.getBoundingClientRect().top + parseFloat(getComputedStyle(rail, '::before').top) + 0.5
    return [...document.querySelectorAll('.rpulse')].map((el) => {
      const box = el.getBoundingClientRect()
      return Math.round(Math.abs(box.top + box.height / 2 - line) * 10) / 10
    })
  })
  const ok =
    before === 0 && lit?.name === 'rpulse' && lit.delay === 0 && lit.time < 400 && waitingAtNode?.scale === 0 && waitingAtNode.x === 0 && crossing?.scale === 1 && crossing.x > 0 && crossing.opacity > 0.5 && offLine.every((px) => px <= 1)
  check(ok, 'T8.rail-pulse', 'the pulses ride the rail; the first waits for it, holds 1.2 s at the first node, then crosses', JSON.stringify({ before, lit, waitingAtNode, crossing, offLine }))
  await context.close()
}

// ---------------------------------------------------------------- the dots
// The 400 dots fly in at full size and brightness (the approved design), then the canvas fades
// out over the grid rather than vanishing. Brightness is the canvas's summed blue times alpha
// 600 ms into the flight, at device pixel ratio 1: 821,000 on 30 Oct 2026, against 98,000 when
// the dots shrank to pinpoints as they flew.
const DOTS_BRIGHT = 400_000
{
  const { context, page } = await newPage({ width: 1280, height: 800 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.documentElement.classList.contains('rv-on'))
  await page.evaluate(() => document.querySelector('#proof .pstage').scrollIntoView({ block: 'center', behavior: 'instant' }))
  await page.waitForSelector('canvas.assemble', { timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(600)
  const brightness = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.assemble')
    if (!canvas) return null
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
    let sum = 0
    for (let i = 0; i < data.length; i += 4) sum += (data[i + 2] * data[i + 3]) / 255
    return Math.round(sum)
  })
  await page.waitForFunction(() => !document.querySelector('#proof .pstage').classList.contains('assembling'), null, { timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(100)
  const fade = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.assemble')
    return { canvas: canvas ? Number(getComputedStyle(canvas).opacity) : null, grid: Number(getComputedStyle(document.querySelector('.dotfield')).opacity) }
  })
  check(brightness >= DOTS_BRIGHT && fade.canvas !== null && fade.canvas < 1 && fade.grid > 0, 'T8.dots-bright', `the flight is bright (${brightness}) and fades out over the grid`, JSON.stringify({ brightness, floor: DOTS_BRIGHT, fade }))
  await context.close()
}

// ---------------------------------------------------------------- the tilt
// The avatar stage follows the pointer through a 0.15 s transition: most of the angle within
// 400 ms. The deck's cases are eased by script, never by the transition.
{
  const { context, page } = await newPage({ width: 1440, height: 900 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3800)
  const box = await page.evaluate(() => {
    const r = document.querySelector('.hero .stage').getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  })
  await page.mouse.move(box.x + box.w / 2, box.y + box.h / 2)
  await page.waitForTimeout(300)
  await page.mouse.move(box.x + 10, box.y + 10)
  const samples = []
  for (let t = 0; t <= 600; t += 50) {
    samples.push(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.hero .stage')).rotate.split(' ').at(-1)) || 0))
    await page.waitForTimeout(50)
  }
  const final = samples.at(-1)
  const by400 = samples.slice(0, 9).some((deg) => deg >= final * 0.9)
  const transitions = await page.evaluate(() => ({
    stage: `${getComputedStyle(document.querySelector('.hero .stage')).transitionProperty} ${getComputedStyle(document.querySelector('.hero .stage')).transitionDuration}`,
    case: getComputedStyle(document.querySelector('.deck .case')).transitionProperty,
  }))
  check(
    final >= 7 && by400 && /rotate/.test(transitions.stage) && /0\.15s/.test(transitions.stage) && !/rotate/.test(transitions.case),
    'T8.tilt',
    `the stage reaches ${final.toFixed(1)} deg, 90% of it within 400 ms; the cases are eased by script`,
    JSON.stringify({ samples, transitions }),
  )
  await context.close()
}

// ---------------------------------------------------------------- a link to a section
// Opening the page on a section link lands on that section at once, with nothing above it left
// waiting or dim, the figures on their values, smooth scrolling on once the page is marked, and
// the section marked in the nav.
for (const vp of [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '412x823', width: 412, height: 823, mobile: true },
]) {
  for (const target of ['contact', 'work']) {
    const { context, page } = await newPage(vp)
    await page.goto(`${BASE}/#${target}`, { waitUntil: 'load' })
    const landed = await page.evaluate((id) => {
      const el = document.getElementById(id)
      const want = Math.min(el.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(el).scrollMarginTop), document.documentElement.scrollHeight - window.innerHeight)
      return { scrollY: Math.round(window.scrollY), want: Math.round(want) }
    }, target)
    await page.waitForFunction(() => document.documentElement.classList.contains('rv-on'), null, { timeout: 4000 }).catch(() => {})
    await page.waitForFunction((ms) => performance.now() - performance.getEntriesByName('first-contentful-paint')[0].startTime >= ms, 3800)
    const after = await page.evaluate(() => ({
      waitingAbove: [...document.querySelectorAll('.rv-wait')].filter((el) => el.getBoundingClientRect().bottom <= 0).length,
      behavior: getComputedStyle(document.documentElement).scrollBehavior,
      current: document.querySelector('.nav .links a[aria-current]')?.getAttribute('href') ?? null,
    }))
    const stuck = await stuckReveals(page)
    const figures = await unfinishedFigures(page)
    const ok = Math.abs(landed.scrollY - landed.want) <= 2 && after.waitingAbove === 0 && stuck.length === 0 && figures.length === 0 && after.behavior === 'smooth' && after.current?.endsWith(`#${target}`)
    check(ok, `T8.deep-link.${target}.${vp.name}`, `/#${target} opens on its section; nothing above waits or stays dim; figures final; nav marks it`, JSON.stringify({ landed, after, stuck, figures }))
    await context.close()
  }
}

// ---------------------------------------------------------------- keyboard focus on a moving page
// Tabbing down, a link must not take focus while the block around it is still transparent
// (the scroll reveal). Tabbing up, focus must not land under the sticky header (WCAG 2.4.11).
for (const vp of [
  { name: '412x823', width: 412, height: 823, mobile: true },
  { name: '1280x800', width: 1280, height: 800 },
]) {
  const { context, page } = await newPage(vp)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' })
  await page.waitForTimeout(2600)
  await withLauncher(page, `T4.focus-seen.${vp.name}`)
  const stops = await page.evaluate(() => document.querySelectorAll('a[href], button:not([hidden]), input').length)
  const focused = () =>
    page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const box = el.getBoundingClientRect()
      let opacity = 1
      for (let p = el; p && p.nodeType === 1; p = p.parentElement) opacity *= Number(getComputedStyle(p).opacity)
      return {
        name: (el.getAttribute('aria-label') || el.textContent || el.id).trim().replace(/\s+/g, ' ').slice(0, 30),
        faded: opacity < 0.95,
        covered: !el.closest('header') && el.id !== 'pause-motion' && !el.matches('.skip-link') && box.top < document.querySelector('header').getBoundingClientRect().bottom - 1,
      }
    })
  const problems = []
  for (const [key, direction] of [['Tab', 'down'], ['Shift+Tab', 'up']]) {
    for (let i = 0; i < stops + 1; i++) {
      await page.keyboard.press(key)
      await page.waitForTimeout(60)
      const stop = await focused()
      if (stop?.faded) problems.push(`${direction}: "${stop.name}" takes focus while transparent`)
      if (stop?.covered) problems.push(`${direction}: "${stop.name}" lands under the header`)
    }
  }
  check(problems.length === 0, `T4.focus-seen.${vp.name}`, `${stops} tab stops, down and up: each is visible and clear of the header`, [...new Set(problems)].slice(0, 6).join(' | '))
  await context.close()
}

// ---------------------------------------------------------------- main thread at rest
// Every loop animates opacity or a transform, so the compositor runs it alone, and the particle
// field draws in a worker (MotionIsland). A page that sits still must ask the main thread for
// nothing: no style recalculation, no layout. (A frame loop on the main thread would also make
// Chrome update every CSS loop there, each frame.) On a busy machine an arrival can still be
// finishing when a section is measured, so the gate gets a second attempt.
await timed('T8.idle-main-thread', async () => {
  const { context, page } = await newPage({ width: 412, height: 823, mobile: true })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  const counters = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await withLauncher(page, 'T8.idle-main-thread')
  const busy = []
  for (const selector of ['.hero', '#proof .pstage', '.flag', '.deck', '.rail', '#contact']) {
    await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center', behavior: 'instant' }), selector)
    // The particle field keeps drifting, in its worker; the main thread must rest all the same.
    await page.waitForTimeout(3000)
    const before = await counters()
    await page.waitForTimeout(2000)
    const after = await counters()
    const recalcs = after.RecalcStyleCount - before.RecalcStyleCount
    const layouts = after.LayoutCount - before.LayoutCount
    if (recalcs > IDLE_RECALCS || layouts > 0) busy.push(`${selector}: ${recalcs} style recalcs, ${layouts} layouts in 2 s`)
  }
  await context.close()
  return { ok: busy.length === 0, pass: 'at rest the animations cost no style or layout work', fail: busy.join(' | ') }
})

// ---------------------------------------------------------------- React's animationiteration listener
// The behavioural proof is T8.idle-main-thread; this names the cause. React registers every
// event on its root (the document) and on each portal container, the route announcer's
// included; instrumentation-client.js drops that one registration. None may be left.
{
  const { context, page } = await newPage({ width: 1280, height: 800 })
  const cdp = await context.newCDPSession(page)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const holders = []
  for (const [name, expression] of [
    ['document', 'document'],
    ['route announcer', "document.querySelector('next-route-announcer')"],
    ['route announcer shadow root', "document.querySelector('next-route-announcer')?.shadowRoot ?? null"],
  ]) {
    const { result } = await cdp.send('Runtime.evaluate', { expression })
    if (!result.objectId) continue
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId, depth: 0 })
    if (listeners.some((l) => l.type === 'animationiteration')) holders.push(name)
  }
  check(holders.length === 0, 'T8.no-iteration-listener', 'no animationiteration listener on the React root or the route announcer', `animationiteration listened for on: ${holders.join(', ')}`)
  await context.close()
}

// ---------------------------------------------------------------- printed page
// Paper gets the page, not its decorations.
{
  const { context, page } = await newPage({ width: 1280, height: 800 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.emulateMedia({ media: 'print' })
  const shown = await page.evaluate(() =>
    ['.field', '.ambient', '.grain', '.progress', '.cursor', '.pause', '#pause-motion'].filter((sel) => [...document.querySelectorAll(sel)].some((el) => getComputedStyle(el).display !== 'none')),
  )
  check(shown.length === 0, 'T8.print-decor', 'the field, light, grain, reading line, cursor and motion switch are not printed', `printed: ${shown.join(', ')}`)
  await context.close()
}

// ---------------------------------------------------------------- main thread while scrolling
// A full scroll at phone width with motion on. The page animates on purpose, so its frames
// are not free; what matters is that none of them would hold up a slow phone. The CPU time
// of every main-thread task is read from a trace and multiplied by four for a mid-range phone.
// Blocking time is what a task takes beyond 50 ms, as in Total Blocking Time. One trace varies
// by a factor of three from run to run on this machine (70 to 212 ms on 30 Oct 2026), so the
// scroll is traced three times and the medians are judged.
const scrollTrace = async () => {
  const { context, page } = await newPage({ width: 360, height: 640, deviceScaleFactor: 3, mobile: true })
  const cdp = await context.newCDPSession(page)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const events = []
  cdp.on('Tracing.dataCollected', ({ value }) => events.push(...value))
  await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] } })
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 120) {
      window.scrollTo({ top: y, behavior: 'instant' })
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 16)))
    }
    await new Promise((r) => setTimeout(r, 300))
  })
  const traced = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve))
  await cdp.send('Tracing.end')
  await traced
  // The renderer's main thread is the one that recalculates style.
  const anchor = events.find((e) => e.name === 'UpdateLayoutTree')
  const tasks = events.filter((e) => e.name === 'RunTask' && e.ph === 'X' && e.pid === anchor?.pid && e.tid === anchor?.tid)
  const onPhone = tasks.map((e) => ((e.tdur ?? 0) / 1000) * PHONE_SLOWDOWN)
  await context.close()
  return { tasks: tasks.length, blocking: Math.round(onPhone.reduce((sum, ms) => sum + Math.max(0, ms - 50), 0)), worst: Math.round(Math.max(0, ...onPhone)) }
}
{
  const traces = []
  for (let n = 0; n < 3; n++) traces.push(await scrollTrace())
  const median = (key) => traces.map((t) => t[key]).sort((a, b) => a - b)[1]
  const blocking = median('blocking')
  const worst = median('worst')
  const runs = traces.map((t) => t.blocking).join(', ')
  check(
    traces.every((t) => t.tasks > 0) && blocking <= SCROLL_BLOCKING_MS && worst <= SCROLL_WORST_TASK_MS,
    'T8.scroll-360',
    `a full scroll blocks for ${blocking} ms (median of ${runs}) on a ${PHONE_SLOWDOWN}x slower phone; worst task ${worst} ms`,
    traces.some((t) => t.tasks === 0)
      ? 'no main-thread tasks in a trace'
      : `a full scroll blocks for ${blocking} ms (median of ${runs}; budget ${SCROLL_BLOCKING_MS}); worst task ${worst} ms (budget ${SCROLL_WORST_TASK_MS}) on a ${PHONE_SLOWDOWN}x slower phone`,
  )
}

// ---------------------------------------------------------------- console, CSP issues, copy button, keyboard
{
  const { context, page } = await newPage({ width: 1280, height: 800 })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const consoleProblems = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoleProblems.push(`${m.type()}: ${m.text().slice(0, 140)}`)
  })
  page.on('pageerror', (e) => consoleProblems.push(`pageerror: ${e.message.slice(0, 140)}`))
  const cdp = await context.newCDPSession(page)
  const issues = []
  cdp.on('Audits.issueAdded', ({ issue }) => issues.push(issue.code))
  await cdp.send('Audits.enable')
  await page.addInitScript(() => {
    window.__cspViolations = []
    document.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`))
  })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await withLauncher(page, 'T10.console')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  const csp = await page.evaluate(() => window.__cspViolations)
  check(consoleProblems.length === 0, 'T10.console', 'no console errors or warnings', consoleProblems.join(' | '))
  check(csp.length === 0, 'T10.csp-violations', 'nothing blocked by the Content Security Policy', csp.join(' | '))
  check(issues.length === 0, 'T10.devtools-issues', 'no DevTools issues', [...new Set(issues)].join(', '))

  // Copy email: visible after hydration, announces through the status region.
  const button = page.locator('[data-copy-email]')
  const visible = await button.isVisible()
  if (visible) {
    await page.evaluate(() => {
      window.__statusChanges = 0
      const region = document.querySelector('#contact [role="status"]')
      new MutationObserver(() => window.__statusChanges++).observe(region, { childList: true, subtree: true, characterData: true })
    })
    const addressAt = () => page.evaluate(() => Math.round(document.getElementById('contact-email').getBoundingClientRect().left * 10) / 10)
    const leftBefore = await addressAt()
    await button.click()
    await page.waitForTimeout(200)
    const status = await page.locator('[role="status"]').textContent()
    const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
    // The button says "Copied" in cyan and the centred address beside it stays where it was.
    const marked = await button.evaluate((el) => el.hasAttribute('data-copied'))
    const leftAfter = await addressAt()
    check(
      /copied/i.test(status ?? '') && copied.includes('@') && marked && Math.abs(leftAfter - leftBefore) < 1,
      'T10.copy-email',
      `"${status}" and clipboard holds ${copied}; the button is marked copied and the address stays put`,
      JSON.stringify({ status, copied, marked, leftBefore, leftAfter }),
    )
    // A second press must empty and then refill the live region, so screen readers announce
    // it again (they only speak changes).
    await page.evaluate(() => {
      window.__statusLog = []
      const region = document.querySelector('#contact [role="status"]')
      new MutationObserver(() => window.__statusLog.push(region.textContent)).observe(region, { childList: true, subtree: true, characterData: true })
    })
    await button.click()
    await page.waitForTimeout(250)
    const log = await page.evaluate(() => window.__statusLog)
    const refilled = log.length >= 2 && log.at(-2) === '' && /copied/i.test(log.at(-1) ?? '')
    check(refilled, 'T10.copy-reannounce', 'a second copy empties and refills the status region', `status changes on the second press: ${JSON.stringify(log)}`)
  } else {
    report('FAIL', 'T10.copy-email', 'copy button not visible after hydration')
  }

  // Keyboard: the first Tab lands on the skip link, which moves focus into <main>.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.keyboard.press('Tab')
  const first = await page.evaluate(() => ({ text: document.activeElement?.textContent, visible: document.activeElement?.getBoundingClientRect().top >= 0 }))
  await page.keyboard.press('Enter')
  await page.waitForTimeout(100)
  const afterSkip = await page.evaluate(() => document.activeElement?.id)
  check(first.text === 'Skip to content' && first.visible && afterSkip === 'main', 'T4.skip-link', 'first Tab = visible skip link; Enter focuses <main>', JSON.stringify({ first, afterSkip }))
  await context.close()
}

// ---------------------------------------------------------------- the concierge (C9)
// Only on a build made with NEXT_PUBLIC_CONCIERGE=on; anywhere else each gate is reported as
// skipped. The conversations are the QA mock's (session.js, mock.js): on 127.0.0.1 or localhost,
// localStorage cg-mock=1 stands a scripted agent in for ElevenLabs and hands the panel's client
// tools to window.__cgMock; cg-mock-mic=denied|missing fails the microphone and
// cg-mock-route=<status> the session route. With the mock on, nothing calls the route or
// ElevenLabs. Against any other host the gates that need the mock are skipped, so a check never
// starts a real conversation.
const C9 = ['C9.concierge-quiet', 'C9.concierge-arrive', 'C9.concierge-open', 'C9.concierge-axe', 'C9.concierge-mock']
if (!CONCIERGE) {
  for (const id of C9) report('SKIP', id, 'no [data-concierge] in the served page: a build without the concierge')
} else {
  // site.js is ESM inside a typeless package; Node reparses it and warns. Keep output clean.
  const emitWarning = process.emitWarning
  process.emitWarning = (w, ...rest) => {
    const code = (rest[0] && rest[0].code) || rest[1] || (w && w.code)
    if (code === 'MODULE_TYPELESS_PACKAGE_JSON' || /Reparsing as ES module/.test(String(w))) return
    return emitWarning.call(process, w, ...rest)
  }
  const { CONCIERGE: TEXT } = await import(pathToFileURL(path.join(REPO_ROOT, 'src', 'content', 'site.js')).href)

  const LOCAL = /^(127\.0\.0\.1|localhost)$/.test(new URL(BASE).hostname)
  const MOCK = { 'cg-mock': '1' }
  // What only the concierge's lazy chunks contain (js-budget.mjs finds them the same way): the
  // panel, the ElevenLabs client with LiveKit, and the QA mock.
  const LAZY = [
    ['panel', /cg-statustext|cg-briefwrap/],
    ['ElevenLabs client', /livekit|@elevenlabs\/client/],
    ['QA mock', /__cgMock/],
  ]
  // What the concierge may call only once a conversation starts: ElevenLabs, or its own routes.
  const calling = (url) => {
    try {
      const { hostname, pathname } = new URL(url)
      return /(^|\.)elevenlabs\.io$/i.test(hostname) || pathname.startsWith('/api/concierge')
    } catch {
      return false
    }
  }
  // The tag sets of T4.axe.
  const AXE_SETS = [
    ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
    ['wcag21a', 'experimental'],
  ]
  const BRIEF = { name: 'QA Visitor', company: 'QA Studio', building: 'A browser check', stuck: 'Nowhere yet', timeline: 'This week' }

  // Each gate opens its own browser contexts (with whatever localStorage steers the mock) and
  // watches every page's requests, sockets and console. A step that never happens fails the gate
  // with its reason instead of ending the run.
  async function gate(id, run) {
    const contexts = []
    const open = async (options, store = {}) => {
      const { context, page } = await newPage(options)
      contexts.push(context)
      if (Object.keys(store).length) {
        await page.addInitScript((pairs) => {
          try {
            for (const [key, value] of Object.entries(pairs)) localStorage.setItem(key, value)
          } catch {}
        }, store)
      }
      const seen = { calls: [], scripts: new Set(), console: [] }
      page.on('request', (request) => {
        if (calling(request.url())) seen.calls.push(`called ${request.url()}`)
        if (request.resourceType() === 'script') seen.scripts.add(request.url())
      })
      page.on('websocket', (socket) => {
        if (calling(socket.url())) seen.calls.push(`opened ${socket.url()}`)
      })
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') seen.console.push(`${m.type()}: ${m.text().slice(0, 140)}`)
      })
      page.on('pageerror', (e) => seen.console.push(`pageerror: ${e.message.slice(0, 140)}`))
      return { page, seen }
    }
    try {
      await run(open)
    } catch (error) {
      report('FAIL', id, `stopped: ${String(error?.message ?? error).split('\n')[0]}`)
    } finally {
      for (const context of contexts) await context.close().catch(() => {})
    }
  }
  // Here a launcher that never arrives stops the gate.
  const arrive = async (page) => {
    await page.waitForFunction(() => document.querySelector('.cg.cg-on'), null, { timeout: 15000 })
    await page.waitForTimeout(700)
  }
  const auditPanel = (page) =>
    page.evaluate(async (sets) => {
      const panel = document.getElementById('cg-panel')
      const found = []
      for (const values of sets) {
        const { violations } = await window.axe.run(panel, { runOnly: { type: 'tag', values }, resultTypes: ['violations'] })
        found.push(...violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes.slice(0, 4).map((node) => String(node.target)).join(', ') })))
      }
      return found
    }, AXE_SETS)

  // Quiet until asked: loading, the launcher's arrival and a full scroll (the quick questions
  // peek on the way) call neither ElevenLabs nor the routes, fetch none of the concierge's lazy
  // chunks and open no connection ahead (hover, focus or touch may; a scroll may not).
  await gate('C9.concierge-quiet', async (open) => {
    const { page, seen } = await open({ width: 1280, height: 800 })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await arrive(page)
    await scrollThrough(page)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1500)
    const preconnect = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel~="preconnect"], link[rel~="dns-prefetch"]')].map((link) => link.href).filter((href) => /elevenlabs/i.test(href)),
    )
    const chunks = []
    for (const url of seen.scripts) {
      const text = await fetch(url)
        .then((r) => r.text())
        .catch(() => '')
      const kinds = LAZY.filter(([, marker]) => marker.test(text)).map(([kind]) => kind)
      if (kinds.length) chunks.push(`${new URL(url).pathname} (${kinds.join(', ')})`)
    }
    check(
      seen.calls.length === 0 && chunks.length === 0 && preconnect.length === 0,
      'C9.concierge-quiet',
      `load, arrival and a full scroll: nothing to ElevenLabs or /api/concierge, none of ${seen.scripts.size} scripts a concierge chunk, no preconnect`,
      JSON.stringify({ calls: seen.calls, chunks, preconnect }),
    )
  })

  // The launcher arrives only once the hero has: the moment it is marked cg-on is noted from the
  // first frame, after a scroll as early as the page allows (a scroll brings it in otherwise).
  // While Contact is on screen it steps aside, out of sight and out of the tab order, its loop at
  // rest, and it comes back once Contact has gone.
  await gate('C9.concierge-arrive', async (open) => {
    const { page } = await open({ width: 1280, height: 800 })
    await page.addInitScript(() => {
      window.__cgArrival = null
      new MutationObserver((records, observer) => {
        if (!document.querySelector('.cg.cg-on')) return
        observer.disconnect()
        const finite = (document.querySelector('.hero')?.getAnimations({ subtree: true }) ?? []).filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        window.__cgArrival = { at: Math.round(performance.now()), finite: finite.length, running: finite.filter((a) => a.playState !== 'finished').length }
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
    })
    await page.goto(`${BASE}/`, { waitUntil: 'commit' })
    await page.waitForFunction(() => document.querySelector('.cg'), null, { timeout: 15000 })
    for (const top of [40, 80]) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top)
      await page.waitForTimeout(250)
    }
    await page.waitForFunction(() => window.__cgArrival, null, { timeout: 15000 })
    const arrival = await page.evaluate(() => window.__cgArrival)
    await page.waitForTimeout(700)
    await page.evaluate(() => document.getElementById('contact').scrollIntoView({ behavior: 'instant' }))
    await page.waitForFunction(() => document.querySelector('.cg.cg-hide'), null, { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(800) // the fade out (0.55 s), then visibility
    const atContact = await page.evaluate(() => {
      const launcher = document.getElementById('cg-launch')
      launcher.focus()
      return {
        hide: !!document.querySelector('.cg.cg-hide'),
        visibility: getComputedStyle(launcher).visibility,
        focusable: document.activeElement === launcher,
        waves: document.getAnimations().filter((a) => a.animationName === 'cg-wave').length,
      }
    })
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.waitForTimeout(900)
    const back = await page.evaluate(() => getComputedStyle(document.getElementById('cg-launch')).visibility)
    check(
      arrival.finite > 0 && arrival.running === 0 && atContact.hide && atContact.visibility === 'hidden' && !atContact.focusable && atContact.waves === 0 && back === 'visible',
      'C9.concierge-arrive',
      `arrives at ${arrival.at} ms, all ${arrival.finite} hero arrivals finished despite an early scroll; at Contact hidden, unfocusable, waveform off; back at the top`,
      JSON.stringify({ arrival, atContact, back }),
    )
  })

  // The launcher opens the panel as a dialog with focus inside, calling nobody; Escape closes it
  // and focus is back on the launcher. On a phone the panel is a modal sheet that keeps Tab
  // inside it and never makes the page scroll sideways.
  await gate('C9.concierge-open', async (open) => {
    const problems = []
    {
      const { page, seen } = await open({ width: 1280, height: 800 })
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
      await arrive(page)
      await page.click('#cg-launch')
      await page.waitForSelector('#cg-panel', { timeout: 8000 })
      await page.waitForTimeout(300)
      const opened = await page.evaluate(() => {
        const panel = document.getElementById('cg-panel')
        return { role: panel.getAttribute('role'), expanded: document.getElementById('cg-launch').getAttribute('aria-expanded'), inside: panel.contains(document.activeElement) }
      })
      if (opened.role !== 'dialog' || opened.expanded !== 'true' || !opened.inside) problems.push(`opened: ${JSON.stringify(opened)}`)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      const closed = await page.evaluate(() => ({
        panel: !!document.getElementById('cg-panel'),
        focus: document.activeElement?.id || null,
        expanded: document.getElementById('cg-launch').getAttribute('aria-expanded'),
      }))
      if (closed.panel || closed.focus !== 'cg-launch' || closed.expanded !== 'false') problems.push(`Escape: ${JSON.stringify(closed)}`)
      problems.push(...seen.calls, ...seen.console)
    }
    {
      const { page, seen } = await open({ width: 390, height: 844, mobile: true })
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
      await arrive(page)
      await page.click('#cg-launch')
      await page.waitForSelector('#cg-panel', { timeout: 8000 })
      await page.waitForTimeout(600) // the sheet's rise (0.45 s)
      const inside = () => page.evaluate(() => !!document.activeElement?.closest('#cg-panel'))
      const sheet = await page.evaluate(() => ({ modal: document.getElementById('cg-panel').getAttribute('aria-modal'), scrollWidth: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }))
      const focusIn = await inside()
      let escaped = 0
      for (const [key, times] of [['Tab', 14], ['Shift+Tab', 6]]) {
        for (let i = 0; i < times; i++) {
          await page.keyboard.press(key)
          if (!(await inside())) escaped++
        }
      }
      const after = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (sheet.modal !== 'true' || !focusIn || escaped > 0 || sheet.scrollWidth > sheet.width || after > 0) problems.push(`390 px: ${JSON.stringify({ ...sheet, focusIn, escaped, after })}`)
      problems.push(...seen.calls, ...seen.console)
    }
    check(
      problems.length === 0,
      'C9.concierge-open',
      'a dialog with focus inside, nothing called; Escape closes it, focus back on the launcher; at 390 px a modal sheet, Tab stays inside (20 presses), no sideways scroll',
      problems.join(' | '),
    )
  })

  // The open panel with axe, the sets of T4.axe: the start screen, and a text conversation with
  // the brief card the mock's fill_brief puts up, at a desktop and a phone width.
  await gate('C9.concierge-axe', async (open) => {
    const severe = []
    const minor = new Set()
    let audits = 0
    for (const vp of [
      { name: '1280', width: 1280, height: 800 },
      { name: '390', width: 390, height: 844, mobile: true },
    ]) {
      const { page } = await open({ ...vp, reducedMotion: 'reduce' }, MOCK)
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
      await arrive(page)
      await page.click('#cg-launch')
      await page.waitForSelector('#cg-panel #cg-start', { timeout: 8000 })
      await page.addScriptTag({ path: AXE_PATH })
      const audit = async (screen) => {
        audits++
        for (const v of await auditPanel(page)) {
          if (v.impact === 'serious' || v.impact === 'critical') severe.push(`${vp.name} ${screen}: ${v.id} [${v.impact}] x${v.nodes}: ${v.target}`)
          else minor.add(v.id)
        }
      }
      await audit('start')
      if (!LOCAL) continue
      // A text conversation: the agent's greeting in the log, then the brief card under it.
      await page.click('#cg-type')
      await page.waitForFunction(() => window.__cgMock && document.querySelector('.cg-agent .sr:not(:empty)'), null, { timeout: 10000 })
      await page.evaluate((brief) => window.__cgMock.tools.fill_brief(brief), BRIEF)
      await page.waitForSelector('#cg-brief', { timeout: 5000 })
      await audit('brief')
    }
    check(
      severe.length === 0,
      'C9.concierge-axe',
      `${audits} audits of the open panel (start screen${LOCAL ? ' and brief card' : '; the brief card needs the mock, local only'}, 1280 and 390 px): 0 serious/critical (minor/moderate: ${[...minor].join(', ') || 'none'})`,
      severe.join(' | '),
    )
  })

  // A conversation with the mock. A chip is the visitor's first message; the agent answers it,
  // naming the Sprint, and the page follows: the Sprint comes up and the conversation notes it.
  // Named again with the page scrolled away, it comes back under the header, ringed. fill_brief,
  // called as the agent calls it, puts up the brief, which refuses a bad address and sends with a
  // valid one. The route refusing (503) rests the concierge on its email card; a refused
  // microphone shows the blocked card.
  if (!LOCAL) report('SKIP', 'C9.concierge-mock', `the QA mock answers on 127.0.0.1 and localhost only, not on ${new URL(BASE).hostname}`)
  else {
    await gate('C9.concierge-mock', async (open) => {
      const problems = []
      {
        const { page, seen } = await open({ width: 1280, height: 800 }, MOCK)
        await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
        await arrive(page)
        await page.click('#cg-launch')
        const chip = page.locator('#cg-panel .cg-chip[data-chip="engagement"]')
        const asked = (await chip.textContent()).trim()
        await chip.click()
        await page.waitForFunction(() => document.querySelector('.cg-agent .sr:not(:empty)') && document.querySelector('.cg-act'), null, { timeout: 12000 })
        const turn = await page.evaluate(() => ({
          user: [...document.querySelectorAll('.cg-user')].map((el) => el.textContent.trim()),
          agent: document.querySelectorAll('.cg-agent').length,
          act: document.querySelector('.cg-act')?.textContent ?? null,
        }))
        if (turn.user[0] !== asked || turn.agent === 0 || !turn.act) problems.push(`chip: ${JSON.stringify({ asked, ...turn })}`)

        // From the top of the page, once the ring of the chip's own reply has been drawn.
        await page.waitForSelector('.cg-ring', { timeout: 8000 }).catch(() => {})
        await page.evaluate(() => {
          document.querySelectorAll('.cg-ring').forEach((ring) => ring.remove())
          window.scrollTo({ top: 0, behavior: 'instant' })
        })
        await page.waitForTimeout(300)
        const acts = await page.evaluate(() => document.querySelectorAll('.cg-act').length)
        await page.evaluate(() => window.__cgMock.say('It starts with the two-week Sprint on your own data.'))
        await page.waitForSelector('.cg-ring', { timeout: 8000 })
        const shown = await page.evaluate(() => {
          const step = [...document.querySelectorAll('#nexerah .steps > li')].find((li) => li.querySelector('.stepname')?.textContent.trim() === 'Sprint')
          const box = step.getBoundingClientRect()
          const ring = document.querySelector('.cg-ring').getBoundingClientRect()
          const head = document.querySelector('.nav').getBoundingClientRect().bottom
          return {
            top: Math.round(box.top),
            head: Math.round(head),
            under: box.top >= head - 1 && box.top < innerHeight,
            ringed: ring.top <= box.top + 1 && ring.bottom >= box.bottom - 1 && ring.left <= box.left + 1 && ring.right >= box.right - 1,
            acts: document.querySelectorAll('.cg-act').length,
          }
        })
        if (!shown.under || !shown.ringed || shown.acts !== acts + 1) problems.push(`a reply naming the Sprint: ${JSON.stringify({ ...shown, actsBefore: acts })}`)

        const answer = await page.evaluate((brief) => window.__cgMock.tools.fill_brief(brief), BRIEF)
        await page.waitForSelector('#cg-brief', { timeout: 5000 })
        const fields = await page.evaluate(() => Object.fromEntries(['name', 'company', 'email', 'building', 'stuck', 'timeline'].map((key) => [key, document.getElementById(`cg-b-${key}`)?.value ?? null])))
        if (typeof answer !== 'string' || !answer || fields.name !== BRIEF.name || fields.building !== BRIEF.building || fields.email !== '') problems.push(`fill_brief: ${JSON.stringify({ answer, fields })}`)
        await page.fill('#cg-b-email', 'not-an-email')
        await page.click('.cg-send')
        await page.waitForTimeout(250)
        const refused = await page.evaluate(() => ({
          error: document.getElementById('cg-b-err')?.textContent ?? '',
          invalid: document.getElementById('cg-b-email')?.getAttribute('aria-invalid') ?? null,
          sent: !!document.querySelector('.cg-sent'),
        }))
        if (!refused.error || refused.invalid !== 'true' || refused.sent) problems.push(`a bad address: ${JSON.stringify(refused)}`)
        await page.fill('#cg-b-email', 'visitor@example.com')
        await page.click('.cg-send')
        await page.waitForSelector('.cg-sent', { timeout: 5000 })
        const remembered = await page.evaluate(() => localStorage.getItem('cg-brief-sent'))
        if (remembered !== '1') problems.push(`sent, but cg-brief-sent is ${remembered}`)
        problems.push(...seen.calls, ...seen.console)
      }
      for (const [store, start, title, status] of [
        [{ 'cg-mock-route': '503' }, '#cg-type', TEXT.resting.title, TEXT.status.resting],
        [{ 'cg-mock-mic': 'denied' }, '#cg-talk', TEXT.blocked.title, TEXT.status.blocked],
      ]) {
        const { page, seen } = await open({ width: 1280, height: 800 }, { ...MOCK, ...store })
        await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
        await arrive(page)
        await page.click('#cg-launch')
        await page.click(start)
        // Talk explains the microphone first; the mock refuses it once it is allowed.
        if (start === '#cg-talk') await page.click('.cg-card .cg-primary')
        const reached = await page
          .waitForFunction((want) => document.querySelector('.cg-card h3')?.textContent === want, title, { timeout: 8000 })
          .then(
            () => true,
            () => false,
          )
        const card = await page.evaluate(() => ({
          title: document.querySelector('.cg-card h3')?.textContent ?? null,
          status: document.getElementById('cg-statustext')?.textContent ?? null,
          mail: document.querySelector('.cg-card .cg-mail')?.textContent ?? null,
          call: document.documentElement.dataset.call ?? null,
        }))
        const [[key, value]] = Object.entries(store)
        if (!reached || card.status !== status || card.call !== null || (start === '#cg-type' && !card.mail?.includes('@'))) problems.push(`${key}=${value}: ${JSON.stringify(card)}`)
        problems.push(...seen.calls, ...seen.console)
      }
      check(
        problems.length === 0,
        'C9.concierge-mock',
        `a chip: message, reply, "${TEXT.shown}" line; a reply naming the Sprint brings it under the header, ringed; fill_brief, a bad address refused, sent; route 503: resting card; microphone denied: blocked card; nothing called`,
        problems.join(' | '),
      )
    })
  }
}

await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall browser checks passed')
process.exit(failures ? 1 : 0)
