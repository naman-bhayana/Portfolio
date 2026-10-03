// Browser-level checks against a running build, using the locally installed Chrome
// (playwright-core downloads no browser). Complements verify-site.mjs, which works over HTTP.
//
// Usage: node scripts/qa/browser-checks.mjs <baseUrl> [--shots <dir outside the repo>]
// Env:   CHROME_PATH (default: the standard Windows install path)
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { chromium } from 'playwright-core'

const require = createRequire(import.meta.url)
const AXE_PATH = require.resolve('axe-core/axe.min.js')
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '')
const shotsArg = process.argv.indexOf('--shots')
const SHOTS = shotsArg > -1 ? process.argv[shotsArg + 1] : null
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

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

// ---------------------------------------------------------------- reflow (WCAG 1.4.10, 1.4.12)
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
    const wide = [...document.querySelectorAll('main *, header *, footer *')]
      .filter((el) => el.getBoundingClientRect().right > width + 0.5)
      .map((el) => el.id || el.tagName.toLowerCase())
    return { scrollWidth: document.documentElement.scrollWidth, width, wide: [...new Set(wide)].slice(0, 6) }
  })
  const id = textSpacing ? 'T4.reflow-320-spacing' : 'T4.reflow-320'
  check(overflow.scrollWidth <= overflow.width && overflow.wide.length === 0, id, `no horizontal overflow at 320 px${textSpacing ? ' with text-spacing overrides' : ''}`, JSON.stringify(overflow))
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
  await context.close()
}

// ---------------------------------------------------------------- motion
{
  // Reduced motion: nothing animates or transitions, and scrolling is not smooth.
  const { context, page } = await newPage({ width: 1280, height: 800, reducedMotion: 'reduce' })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 40))
    }
  })
  const reduced = await page.evaluate(() => ({
    animations: document.getAnimations().length,
    pending: document.querySelectorAll('.reveal-pending').length,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }))
  check(
    reduced.animations === 0 && reduced.pending === 0 && reduced.scrollBehavior !== 'smooth',
    'T8.reduced-motion',
    'no animations, no hidden reveals, no smooth scroll',
    JSON.stringify(reduced),
  )
  await context.close()
}
{
  // Motion allowed: below-the-fold blocks reveal once; the proof strip never animates.
  const { context, page } = await newPage({ width: 1280, height: 800 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const before = await page.evaluate(() => ({
    pending: document.querySelectorAll('.reveal-pending').length,
    aboveFoldPending: [...document.querySelectorAll('.reveal-pending')].filter((el) => el.getBoundingClientRect().top < innerHeight).length,
  }))
  await page.evaluate(() => document.getElementById('proof').scrollIntoView())
  await page.waitForTimeout(300)
  const proof = await page.evaluate(() => {
    const nodes = [document.querySelector('#proof dl'), ...document.querySelectorAll('#proof dt, #proof dd')]
    return {
      animations: document.getAnimations().filter((a) => a.effect?.target && document.getElementById('proof').contains(a.effect.target)).length,
      moving: nodes.filter((n) => {
        const s = getComputedStyle(n)
        return s.animationName !== 'none' || !/^0s(, 0s)*$/.test(s.transitionDuration)
      }).length,
      insidePending: !!document.getElementById('proof').closest('[data-reveal]'),
    }
  })
  check(before.aboveFoldPending === 0, 'T8.above-fold', `nothing above the fold waits to animate (${before.pending} below)`, `${before.aboveFoldPending} above-the-fold block(s) hidden for reveal`)
  check(proof.animations === 0 && proof.moving === 0 && !proof.insidePending, 'T8.proof-static', 'proof strip has no animation or transition', JSON.stringify(proof))
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 300) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
  })
  await page.waitForTimeout(600)
  const left = await page.evaluate(() => document.querySelectorAll('.reveal-pending').length)
  check(left === 0, 'T8.reveal-complete', 'every reveal ran after scrolling', `${left} block(s) still hidden after a full scroll`)
  await context.close()
}

// ---------------------------------------------------------------- 360 px scroll at 4x CPU
{
  const { context, page } = await newPage({ width: 360, height: 640, deviceScaleFactor: 3, mobile: true })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const longTasks = await page.evaluate(async () => {
    const found = []
    new PerformanceObserver((list) => found.push(...list.getEntries().map((e) => Math.round(e.duration)))).observe({ type: 'longtask' })
    for (let y = 0; y < document.body.scrollHeight; y += 120) {
      window.scrollTo(0, y)
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 16)))
    }
    await new Promise((r) => setTimeout(r, 300))
    return found
  })
  check(longTasks.length === 0, 'T8.scroll-360', 'no long task during a full scroll at 4x CPU', `long tasks (ms): ${longTasks.join(', ')}`)
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
    // A second press must change the live region again so screen readers announce it.
    const before = await page.evaluate(() => window.__statusChanges)
    await button.click()
    await page.waitForTimeout(200)
    const after = await page.evaluate(() => window.__statusChanges)
    check(after > before, 'T10.copy-reannounce', 'a second copy updates the status region again', `no status change on the second press (${before} -> ${after})`)
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
