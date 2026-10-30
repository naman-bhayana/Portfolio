// A lab for the first paint on a phone, as Lighthouse's mobile profile sees it: 412 x 823, a CPU
// four times slower, 1.6 Mbps at 150 ms, a cold cache. Loads the page several times per variant
// and prints the medians, so a change to the first screen can be judged before it ships.
//
// Usage: node scripts/qa/lcp-lab.mjs <baseUrl> [runs=5] [variant,variant...]
// Variants: baseline, arrived (no hero arrival), nowall (the hero's arrival without the wall's),
// nojs (no script at all), webp (WebP, not AVIF).
// A tool, not a gate: T3.lcp in browser-checks.mjs holds the budget.
import { chromium } from 'playwright-core'

const BASE = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '')
const RUNS = Number(process.argv[3] || 5)
const VARIANTS = (process.argv[4] || 'baseline,arrived,nojs').split(',')
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

async function load(variant) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
    javaScriptEnabled: variant !== 'nojs',
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6e6 / 8) * 0.9, uploadThroughput: (750e3 / 8) * 0.9 })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  if (variant === 'arrived') {
    // The page as if the hero's arrival were already over: the class goes on before first paint.
    await page.addInitScript(() => {
      const mark = () => document.documentElement?.classList.add('arrived')
      mark()
      new MutationObserver(mark).observe(document, { childList: true, subtree: true })
    })
  }
  if (variant === 'nowall') {
    // Injected into the page, not the stylesheet: a routed response would skip the throttling.
    await page.addInitScript(() => {
      const add = () => {
        if (!document.head || document.getElementById('lab-nowall')) return
        const style = document.createElement('style')
        style.id = 'lab-nowall'
        style.textContent = '.wall .wcell, .wall::after { animation: none !important; }'
        document.head.append(style)
      }
      add()
      new MutationObserver(add).observe(document, { childList: true, subtree: true })
    })
  }
  if (variant === 'webp') {
    await page.route('**/_next/image**', (route) => route.continue({ headers: { ...route.request().headers(), accept: 'image/webp,*/*' } }))
  }
  await page.addInitScript(() => {
    window.__lcp = null
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1)
      window.__lcp = { start: last.startTime, render: last.renderTime, load: last.loadTime, size: last.size, el: last.element?.tagName + (last.element?.className ? `.${String(last.element.className).split(' ')[0]}` : '') }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    window.__long = []
    try {
      new PerformanceObserver((list) => list.getEntries().forEach((e) => window.__long.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true })
    } catch {}
  })
  await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 90000 })
  await page.waitForTimeout(1500)
  const result = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null
    const res = performance.getEntriesByType('resource')
    const end = (re) => Math.round(res.find((r) => re.test(r.name))?.responseEnd ?? -1)
    const lcp = window.__lcp
    return {
      fcp: Math.round(fcp),
      lcp: lcp ? Math.round(lcp.start) : null,
      el: lcp?.el ?? null,
      avatar: end(/naman-bhayana-avatar/),
      mono: end(/\/media\/[^/]*\.woff2/) /* first font file */,
      longBeforeLcp: (window.__long ?? []).filter(([s]) => !lcp || s < lcp.start).reduce((n, [, d]) => n + d, 0),
    }
  })
  await context.close()
  return result
}

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : null
}

for (const variant of VARIANTS) {
  const runs = []
  for (let i = 0; i < RUNS; i++) runs.push(await load(variant))
  const pick = (k) => median(runs.map((r) => r[k]))
  const elements = [...new Set(runs.map((r) => r.el))].join(' / ')
  console.log(
    `${variant.padEnd(9)} FCP ${pick('fcp')} ms  LCP ${pick('lcp')} ms (${elements})  avatar in ${pick('avatar')} ms  long tasks before LCP ${pick('longBeforeLcp')} ms   runs: ${runs.map((r) => r.lcp).join(' ')}`,
  )
}
await browser.close()
