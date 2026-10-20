// What the concierge does to the page: show the part of it a reply names (follow, from the
// store) and say which part is on screen (get_page_context, the agent's tool). It runs on the
// conversation, never at rest.
import { CONCIERGE as C, INFRA, PROOF, STUDIO } from '@/content/site'

export { named } from './named'

const OFFSET = 28 // room between the sticky header and what is shown
const PAD = 10 // the ring's margin round its target
const LANDING_MS = 1600 // the longest the ring waits for a block's arrival to finish

const q = (selector) => document.querySelector(selector)
const byId = (id) => () => document.getElementById(id)
// The item of a list rendered from site.js, found by its place in the data.
const nth = (selector, list, match) => {
  const i = list.findIndex(match)
  return i < 0 ? null : q(`${selector}:nth-child(${i + 1})`)
}
const cell = (id) => () => nth('#proof .figs > li', PROOF.cells, (item) => item.id === id)
const node = (name) => () => nth('#stack .rail > li', INFRA.nodes, (item) => item.name === name)
const practice = (name) => () => nth('#nexerah .practices > li', STUDIO.practices, (item) => item.name === name)

// Every part of the page the concierge can show. `find` is what is brought under the header and
// lit; `light` replaces it for the ring; `whole` marks a key that stands for a part of the page
// rather than an item in it (see onScreen).
export const TARGETS = {
  top: { area: 'top', whole: true, find: () => q('.hero') },
  proof: { area: 'proof', whole: true, find: () => q('#proof .head') },
  figure_400_models: { area: 'proof', find: () => q('#proof .pstage') },
  figure_200_signals: { area: 'proof', find: cell('signals') },
  figure_30_40_manual_work: { area: 'proof', find: cell('manual') },
  figure_14_stage_agent: { area: 'proof', find: cell('agent') },
  figure_11_sources: { area: 'proof', find: cell('sources') },
  work: { area: 'work', whole: true, find: () => q('#work .headrow') },
  ideasiq: { area: 'work', find: byId('ideasiq') },
  myleadsiq: { area: 'work', find: byId('myleadsiq') },
  investbeans: { area: 'work', find: byId('investbeans') },
  docpad: { area: 'work', find: byId('docpad') },
  prozone: { area: 'work', find: byId('prozone') },
  artize_dental: { area: 'work', find: byId('artize-dental') },
  more_builds: { area: 'work', find: () => q('#work .index') },
  stack: { area: 'stack', whole: true, find: () => q('#stack .head') },
  node_evals: { area: 'stack', find: node('Evals and guardrails') },
  node_model_gateway: { area: 'stack', find: node('Model gateway') },
  studio: { area: 'studio', whole: true, find: () => q('#nexerah .studiohead') },
  practice_ai_products: { area: 'studio', find: practice('AI products and agents') },
  practice_automation: { area: 'studio', find: practice('Automation') },
  practice_growth: { area: 'studio', find: practice('Growth engine') },
  method: { area: 'studio', find: () => q('#nexerah .method') },
  step_sprint: { area: 'studio', find: () => nth('#nexerah .steps > li', STUDIO.steps, (step) => step.name === 'Sprint') },
  terms: { area: 'studio', find: () => q('#nexerah .terms') },
  about: { area: 'about', whole: true, find: () => q('#about .abouttext') },
  contact: { area: 'contact', whole: true, find: () => q('#contact .contactin'), light: () => q('#contact .addr') },
}

// The parts of the page, top to bottom, for get_page_context.
const AREAS = [
  ['top', '.hero'],
  ['wall', '.wall'],
  ['proof', '#proof'],
  ['work', '#work'],
  ['stack', '#stack'],
  ['studio', '#nexerah'],
  ['about', '#about'],
  ['contact', '#contact'],
]

export const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!document.getElementById('pause-motion')?.checked

const header = () => q('.nav')?.offsetHeight ?? 72

// Where an element sits in the page, without the transform of an arrival still in play (summed
// up the offsetParent chain: a transformed box counts as an offsetParent). A case of the deck is
// sticky, so where it is pinned says nothing about where it is: for the measurement, and only
// for it, it is static (not relative, which would still apply its `top`).
function flowTop(el) {
  const sticky = getComputedStyle(el).position === 'sticky'
  if (sticky) el.style.position = 'static'
  let y = 0
  for (let n = el; n; n = n.offsetParent) y += n.offsetTop
  if (sticky) el.style.position = ''
  return y
}

function scrollPage(top, instant) {
  try {
    window.scrollTo({ top, behavior: instant ? 'instant' : 'smooth' })
  } catch {
    window.scrollTo(0, top)
  }
}

let token = 0

// Once the page has stopped moving: one frame for an instant jump, else six frames without a
// change of scroll position (four seconds at most).
function whenSettled(mine, instant, done) {
  if (instant) {
    requestAnimationFrame(() => mine === token && done())
    return
  }
  let last = Number.NaN
  let same = 0
  let frames = 0
  const tick = () => {
    if (mine !== token) return
    const y = window.scrollY
    if (y === last) same += 1
    else {
      same = 0
      last = y
    }
    if (same > 5 || ++frames > 240) done()
    else requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// A block below the fold arrives as it comes into view (MotionIsland). The ring waits for it to
// land, so it is drawn round where the block ends up.
function landed(el) {
  const moving = []
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    for (const animation of n.getAnimations?.() ?? []) {
      const loops = animation.effect?.getComputedTiming?.().iterations === Infinity
      if (animation.timeline === document.timeline && animation.playState !== 'finished' && !loops) moving.push(animation.finished.catch(() => {}))
    }
  }
  if (!moving.length) return Promise.resolve()
  return Promise.race([Promise.all(moving), new Promise((resolve) => setTimeout(resolve, LANDING_MS))])
}

const removeRings = () => {
  for (const ring of document.querySelectorAll('.cg-ring')) ring.remove()
}

// Closing the panel or starting again: the rings go, and one still waiting for the page to
// settle never appears.
export function clearRings() {
  token += 1
  removeRings()
}

// The highlight: a ring round the target, inside .nb so the pause switch and print reach it.
// Its fade is in motion.css; it is removed once it has played.
function ring(el) {
  removeRings()
  const host = q('.nb') ?? document.body
  const box = el.getBoundingClientRect()
  if (!box.width || !box.height) return
  const origin = host.getBoundingClientRect()
  const width = document.documentElement.clientWidth
  const left = Math.max(2, box.left - PAD)
  const right = Math.min(width - 2, box.right + PAD)
  const span = document.createElement('span')
  span.className = 'cg-ring'
  span.setAttribute('aria-hidden', 'true')
  span.style.cssText = `left:${left - origin.left}px;top:${box.top - PAD - origin.top}px;width:${right - left}px;height:${box.height + PAD * 2}px`
  host.append(span)
  setTimeout(() => span.remove(), still() ? 2200 : 2900)
}

// Scroll the target under the header, then light it. Smooth, unless motion is reduced or
// paused. Returns false for a key the page has no place for.
export function showSection(key) {
  const target = Object.hasOwn(TARGETS, key) ? TARGETS[key] : null
  const el = target?.find()
  if (!el) return false
  const mine = ++token
  const instant = still()
  const max = document.documentElement.scrollHeight - window.innerHeight
  const goal = key === 'top' ? 0 : Math.max(0, Math.min(max, Math.round(flowTop(el) - header() - OFFSET)))
  if (Math.abs(window.scrollY - goal) > 1) scrollPage(goal, instant)
  if (key === 'top') {
    removeRings()
    return true
  }
  const light = target.light?.() ?? el
  whenSettled(mine, instant, () =>
    landed(light).then(() => {
      if (mine === token) ring(light)
    }),
  )
  return true
}

// Whether a part of the page is already in view under the header, so naming it again leaves the
// page where it is.
export function inView(key) {
  const el = Object.hasOwn(TARGETS, key) ? TARGETS[key].find() : null
  if (!el) return false
  const top = el.getBoundingClientRect().top
  return top >= header() - 1 && top < window.innerHeight * 0.6
}

// The part of the page at the reading line (40% down the screen), and the item there, if one
// item clearly is: the deck's cases pile up where they are pinned and the last is on top; nested
// items (a step in the method) give the innermost.
function onScreen() {
  const line = window.innerHeight * 0.4
  let area = 'top'
  for (const [key, selector] of AREAS) {
    const el = q(selector)
    if (el && el.getBoundingClientRect().top <= line) area = key
  }
  const hits = Object.entries(TARGETS)
    .filter(([, target]) => target.area === area && !target.whole)
    .map(([key, target]) => [key, target.find()])
    .filter(([, el]) => {
      if (!el) return false
      const box = el.getBoundingClientRect()
      return box.top <= line && box.bottom >= line
    })
  if (hits.length < 2) return { area, item: hits[0]?.[0] ?? null }
  const pile = hits.every(([, el]) => el.classList.contains('case'))
  const nested = hits.every(([, el], i) => i === 0 || hits[i - 1][1].contains(el))
  return { area, item: pile || nested ? hits.at(-1)[0] : null }
}

export function pageArea() {
  const { area, item } = onScreen()
  return item ? `${C.areas[area]}, ${C.places[item]}` : C.areas[area]
}

// get_page_context's answer: "On screen: the work, DocPad."
export const pageContext = () => `${C.shown}: ${pageArea()}.`
