// Browser-level checks against a running build, using the locally installed Chrome
// (playwright-core downloads no browser). Complements verify-site.mjs, which works over HTTP.
//
// Usage: node scripts/qa/browser-checks.mjs <baseUrl> [--shots <dir outside the repo>]
// Env:   CHROME_PATH (default: the standard Windows install path)
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { chromium } from 'playwright-core'
import sharp from 'sharp'

const require = createRequire(import.meta.url)
const AXE_PATH = require.resolve('axe-core/axe.min.js')
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '')
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

if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Set CHROME_PATH.`)
  process.exit(2)
}
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
// the viewport) but are not fully opaque.
const stuckReveals = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-rv]')]
      .flatMap((el) => [el, ...el.children, ...el.querySelectorAll('.wcell, .node, .flagtext > *')])
      .filter((el) => el.getBoundingClientRect().top < innerHeight && Number(getComputedStyle(el).opacity) < 0.99)
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
  const lcp = await page.evaluate(
    () =>
      new Promise((resolve) => {
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
      }),
  )
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

// ---------------------------------------------------------------- axe-core (WCAG 2.2 AA)
for (const vp of [
  { name: '360', width: 360, height: 800, mobile: true },
  { name: '1280', width: 1280, height: 800 },
]) {
  const { context, page } = await newPage({ ...vp, reducedMotion: 'reduce' })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
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
for (const textSpacing of [false, true]) {
  const { context, page } = await newPage({ width: 320, height: 640, mobile: true, reducedMotion: 'reduce' })
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
  const id = textSpacing ? 'T4.reflow-320-spacing' : 'T4.reflow-320'
  check(overflow.scrollWidth <= overflow.width && overflow.wide.length === 0, id, `no horizontal overflow at 320 px${textSpacing ? ' with text-spacing overrides' : ''}`, JSON.stringify(overflow))
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
  check(
    reduced.animations === 0 && reduced.waiting === 0 && reduced.scrollBehavior !== 'smooth' && !reduced.pauseShown && firstRoleOnly && stuck.length === 0 && figures.length === 0,
    'T8.reduced-motion',
    'no animations, everything visible, first role shown, figures final, pause switch hidden',
    JSON.stringify({ ...reduced, roles, stuck, figures }),
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
{
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
  check(problems.length === 0, 'T8.typed-role-live', `the running line matches the frozen one for ${holds.length} roles on a ${PHONE_SLOWDOWN}x slower CPU (caret lit in ${caretSeen})`, problems.join(' | '))
  await context.close()
}
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

  // Count-up: untouched until the visitor scrolls (a crawler or a link preview reads the real
  // numbers); from then on a figure waits at zero once it is within a screen of the fold, and
  // is back on the server's value once seen.
  const shown = () => page.evaluate(() => [...document.querySelectorAll('#proof [data-count]')].map((el) => ({ text: el.textContent.trim(), final: el.dataset.count })))
  const untouched = await unfinishedFigures(page)
  await page.evaluate(() => window.scrollTo({ top: 2, behavior: 'instant' }))
  await page.waitForTimeout(300)
  const armed = await shown()
  for (const selector of ['#proof .pstage', '#proof .figs']) {
    await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), selector)
    await page.waitForTimeout(1900)
  }
  const figures = await unfinishedFigures(page)
  const waiting = armed.filter((figure) => figure.text === '0').length
  check(
    untouched.length === 0 && waiting > 0 && armed.every((figure) => figure.text === '0' || figure.text === figure.final) && figures.length === 0,
    'T8.count-up',
    `figures wait for the first scroll, ${waiting} of ${armed.length} near the fold go to 0, all end on their server values`,
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
  const running = await page.evaluate(() => document.getAnimations().length)
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
  }))
  const figures = await unfinishedFigures(page)
  await page.locator('.pause').click()
  await page.waitForTimeout(200)
  const resumed = await page.evaluate(() => ({
    checked: document.getElementById('pause-motion').checked,
    animations: document.getAnimations().length,
    // Resuming must not play the hero's arrival again.
    arriving: [...document.querySelectorAll('.hero :is(.lede, .cta, .chip)')].filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length,
  }))
  check(
    running > 0 && secondStop.id === 'pause-motion' && !!secondStop.name && paused.checked && paused.animations === 0 && paused.transparent === 0 && paused.veiled === 0 && figures.length === 0 && !resumed.checked && resumed.animations > 0 && resumed.arriving === 0,
    'T8.pause',
    `second tab stop "${secondStop.name}"; Space stops ${running} animations and shows everything; a click resumes without replaying the arrival`,
    JSON.stringify({ running, secondStop, paused, figures, resumed }),
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
// Chrome update every CSS loop there, each frame.)
{
  const { context, page } = await newPage({ width: 412, height: 823, mobile: true })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  const counters = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
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
  check(busy.length === 0, 'T8.idle-main-thread', 'at rest the animations cost no style or layout work', busy.join(' | '))
  await context.close()
}

// ---------------------------------------------------------------- main thread while scrolling
// A full scroll at phone width with motion on. The page animates on purpose, so its frames
// are not free; what matters is that none of them would hold up a slow phone. The CPU time
// of every main-thread task is read from a trace (unaffected by whatever else this machine is
// doing) and multiplied by four for a mid-range phone. Blocking time is what a task takes
// beyond 50 ms, as in Total Blocking Time.
{
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
  const blocking = Math.round(onPhone.reduce((sum, ms) => sum + Math.max(0, ms - 50), 0))
  const worst = Math.round(Math.max(0, ...onPhone))
  check(
    tasks.length > 0 && blocking <= SCROLL_BLOCKING_MS && worst <= SCROLL_WORST_TASK_MS,
    'T8.scroll-360',
    `a full scroll blocks for ${blocking} ms on a ${PHONE_SLOWDOWN}x slower phone; worst task ${worst} ms`,
    tasks.length === 0
      ? 'no main-thread tasks in the trace'
      : `a full scroll blocks for ${blocking} ms (budget ${SCROLL_BLOCKING_MS}); worst task ${worst} ms (budget ${SCROLL_WORST_TASK_MS}) on a ${PHONE_SLOWDOWN}x slower phone`,
  )
  await context.close()
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
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  const csp = await page.evaluate(() => window.__cspViolations)
  check(consoleProblems.length === 0, 'T10.console', 'no console errors or warnings', consoleProblems.join(' | '))
  check(csp.length === 0, 'T10.csp-violations', 'no CSP report-only violations', csp.join(' | '))
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
    await button.click()
    await page.waitForTimeout(200)
    const status = await page.locator('[role="status"]').textContent()
    const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
    check(/copied/i.test(status ?? '') && copied.includes('@'), 'T10.copy-email', `"${status}" and clipboard holds ${copied}`, `status "${status}", clipboard "${copied}"`)
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

await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall browser checks passed')
process.exit(failures ? 1 : 0)
