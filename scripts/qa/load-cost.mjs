// What the page's styles cost a phone to lay out: one full style and layout of the whole page,
// timed with the CPU four times slower, script off and motion reduced, so only the CSS is
// measured. On first load this work sits between the stylesheet arriving and the first paint.
// Each variant appends one override to the stylesheet, so a candidate fix can be measured
// before it ships. Seven forced layouts per load (the median), three loads per variant.
//
// Usage: node scripts/qa/load-cost.mjs <baseUrl> [runs=3] [variant,variant...]
// A tool, not a gate.
import { chromium } from 'playwright-core'

const BASE = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '')
const RUNS = Number(process.argv[3] || 3)
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const VARIANTS = {
  baseline: '',
  'no-balance-no-pretty': '.nb * { text-wrap: wrap !important; }',
  'no-pretty': ':where(.nb) :is(.sub, .body, .flab, .flab2, .mech, .flagsum, .ixwhat, .node p, .stepwhat, .terms dd, .practice p, .lwhat, .cbody, .cextra, .lede) { text-wrap: wrap !important; }',
  'balance-headings-only': '.nb :not(.h2, .h2b) { text-wrap: wrap !important; }',
  'no-backdrop': '.nav, .chip { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }',
  'no-marquee': '.mq { display: none !important; }',
  'contain-scenes': '.scene { contain: layout paint; }',
}
const chosen = (process.argv[4] || Object.keys(VARIANTS).join(',')).split(',')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

async function measure(extra) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
    javaScriptEnabled: false,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  if (extra) {
    await page.route('**/_next/static/css/*.css', async (route) => {
      const res = await route.fetch()
      await route.fulfill({ response: res, body: (await res.text()) + '\n' + extra })
    })
  }
  await page.goto(BASE + '/', { waitUntil: 'load' })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  // The root's width changes by a pixel, which invalidates every line box; reading a size then
  // forces the full style and layout.
  const times = []
  for (let i = 0; i < 7; i++) {
    const width = i % 2 ? 412 : 411
    const expression =
      '(() => { const s = performance.now(); document.documentElement.style.width = "' + width + 'px"; document.body.offsetHeight; return performance.now() - s })()'
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true })
    times.push(r.result.value)
  }
  await context.close()
  times.sort((a, b) => a - b)
  return Math.round(times[3])
}

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]
for (const name of chosen) {
  const runs = []
  for (let i = 0; i < RUNS; i++) runs.push(await measure(VARIANTS[name]))
  console.log(name.padEnd(24) + ' full style and layout ' + median(runs) + ' ms on a 4x slower CPU   (loads: ' + runs.join(' ') + ')')
}
await browser.close()
