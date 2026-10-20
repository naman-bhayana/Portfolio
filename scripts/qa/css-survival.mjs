// The motion on this site is written in CSS that minifiers have a history of mangling or
// dropping: scroll-driven animations, :has(), @supports blocks, pseudo-element animations.
// This compares src/styles/*.css with the stylesheet `next build` produced and fails if a
// rule the motion depends on went missing, moved out of its @media / @supports guard, lost a
// keyframe declaration, or had its animation longhands reordered ahead of the shorthand.
//
// Usage: npm run build && node scripts/qa/css-survival.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

const root = process.cwd()
const sourceDir = path.join(root, 'src', 'styles')
const builtDir = path.join(root, '.next', 'static', 'css')
if (!existsSync(builtDir)) {
  console.error(`No built CSS in ${builtDir}. Run \`npm run build\` first.`)
  process.exit(2)
}

const read = (dir) =>
  readdirSync(dir)
    .filter((file) => file.endsWith('.css'))
    .sort()
    .map((file) => readFileSync(path.join(dir, file), 'utf8'))
    .join('\n')
const source = postcss.parse(read(sourceDir))
const built = postcss.parse(read(builtDir))

let failures = 0
const report = (ok, id, pass, fail) => {
  if (!ok) failures++
  console.log(`${(ok ? 'PASS' : 'FAIL').padEnd(5)} ${id.padEnd(26)} ${ok ? pass : fail}`)
}
const list = (items, max = 6) => `${items.slice(0, max).join(' | ')}${items.length > max ? ` (+${items.length - max} more)` : ''}`

const MOTION = /^(animation(-.+)?|view-timeline(-.+)?|scroll-timeline(-.+)?|timeline-scope)$/
const squash = (text) => text.replace(/\s+/g, '').replace(/"/g, "'").toLowerCase()
// Spacing, the minifier's one-colon ::before / ::after, its dropped `*` before a
// pseudo-element, its unquoted attribute values and its :first-child are not differences.
const selectorKey = (selector) =>
  selector
    .replace(/\s+/g, ' ')
    .replace(/\s*([>~+,])\s*/g, '$1')
    .replace(/::(before|after)/g, ':$1')
    .replace(/(^|[ >~+])\*(?=:)/g, '$1')
    .replace(/\[([\w-]+)=["']?([\w-]+)["']?\]/g, '[$1=$2]')
    .replace(/:nth-child\(1\)/g, ':first-child')
    .replace(/:nth-last-child\(1\)/g, ':last-child')
    .trim()
    .toLowerCase()
const isKeyframeStep = (rule) => rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)

// The guards a declaration sits behind, outermost first: "@media(...)>@supports(...)".
function guards(node) {
  const chain = []
  for (let parent = node.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    if (parent.type === 'atrule') chain.unshift(`@${parent.name}${squash(parent.params)}`)
  }
  return chain.join('>')
}

// selector + property -> the set of guard chains it appears under.
function index(tree, keep) {
  const found = new Map()
  tree.walkDecls((decl) => {
    const rule = decl.parent
    if (rule.type !== 'rule' || isKeyframeStep(rule) || !keep(decl, rule)) return
    for (const selector of rule.selectors) {
      const key = `${selectorKey(selector)} { ${decl.prop} }`
      if (!found.has(key)) found.set(key, new Set())
      found.get(key).add(guards(decl))
    }
  })
  return found
}

function compare(id, what, keep) {
  const want = index(source, keep)
  const have = index(built, keep)
  const missing = []
  const moved = []
  for (const [key, chains] of want) {
    if (!have.has(key)) missing.push(key)
    else for (const chain of chains) if (!have.get(key).has(chain)) moved.push(`${key} expected under ${chain || 'no guard'}, found under ${[...have.get(key)].map((c) => c || 'no guard').join(' and ')}`)
  }
  report(missing.length === 0 && moved.length === 0, id, `${want.size} ${what} survive the build, each behind its guard`, list([...missing.map((m) => `missing: ${m}`), ...moved]))
}

compare('CSS.motion-declarations', 'animation and timeline declarations', (decl) => MOTION.test(decl.prop))
compare('CSS.has-selectors', 'declarations under :has() selectors', (decl, rule) => rule.selector.includes(':has('))
// The still states: everything a rule sets when motion is paused, reduced, printed or not
// supported, and the rules that draw decoration from data-t or uncover a focused block.
compare('CSS.still-states', 'declarations for the paused, reduced, printed and fallback states', (decl, rule) => {
  const guard = guards(decl)
  return /#pause-motion|\[data-t\]|\.rv-wait|\.rv-in|:focus-within/.test(rule.selector) || /@media(print|\(prefers-reduced-motion:reduce\)|\(forced-colors)/.test(guard)
})

// In a rule that sets both, `animation` must come before the longhands that refine it
// (timeline, range, delay): the shorthand resets them all.
const reordered = []
built.walkRules((rule) => {
  if (isKeyframeStep(rule)) return
  const props = rule.nodes.filter((node) => node.type === 'decl').map((decl) => decl.prop)
  const shorthand = props.lastIndexOf('animation')
  if (shorthand === -1) return
  const early = props.slice(0, shorthand).filter((prop) => /^animation-/.test(prop))
  if (early.length) reordered.push(`${selectorKey(rule.selector)}: ${early.join(', ')} before animation`)
})
report(reordered.length === 0, 'CSS.shorthand-first', 'no animation longhand is reset by a later shorthand', list(reordered))

// Keyframes: every declaration of every step, by offset, is in the build.
function keyframes(tree) {
  const sets = new Map()
  tree.walkAtRules(/keyframes$/, (rule) => {
    const steps = new Set()
    for (const step of rule.nodes ?? []) {
      if (step.type !== 'rule') continue
      for (const offset of step.selectors.map((s) => s.trim().toLowerCase().replace(/^from$/, '0%').replace(/^to$/, '100%'))) {
        for (const decl of step.nodes) if (decl.type === 'decl') steps.add(`${offset} ${decl.prop}`)
      }
    }
    sets.set(rule.params, steps)
  })
  return sets
}
const wantFrames = keyframes(source)
const haveFrames = keyframes(built)
const frameProblems = [...wantFrames].flatMap(([name, steps]) => {
  if (!haveFrames.has(name)) return [`@keyframes ${name} is gone`]
  const lost = [...steps].filter((step) => !haveFrames.get(name).has(step))
  return lost.length ? [`@keyframes ${name} lost ${lost.join(', ')}`] : []
})
const frameCount = [...wantFrames.values()].reduce((sum, steps) => sum + steps.size, 0)
report(frameProblems.length === 0, 'CSS.keyframes', `${wantFrames.size} keyframe sets survive with all ${frameCount} step declarations`, list(frameProblems))

// Names an `animation` or `animation-name` value starts: whatever is left once times, numbers,
// keywords and functions are taken out.
const NOT_A_NAME = /^(none|initial|inherit|unset|revert|normal|reverse|alternate|alternate-reverse|infinite|forwards|backwards|both|running|paused|linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|auto)$/
function started(tree) {
  const names = new Set()
  tree.walkDecls(/^animation(-name)?$/, (decl) => {
    if (isKeyframeStep(decl.parent)) return
    const plain = decl.value.replace(/\b[\w-]+\([^()]*(\([^()]*\)[^()]*)*\)/g, ' ')
    for (const word of plain.split(/[\s,]+/)) {
      if (word && !NOT_A_NAME.test(word) && !/^[-+.\d]/.test(word)) names.add(word)
    }
  })
  return names
}
const startedInBuild = started(built)
const orphans = [...wantFrames.keys()].filter((name) => !startedInBuild.has(name))
report(orphans.length === 0, 'CSS.keyframes-used', 'every keyframe set is started by a rule in the build', `never started: ${list(orphans)}`)
// The other way round. The hero's arrival and the typed role line bring their keyframes with
// them in the page, so only names the stylesheet itself should define are checked.
const undefinedNames = [...startedInBuild].filter((name) => !haveFrames.has(name))
report(undefinedNames.length === 0, 'CSS.animations-defined', `all ${startedInBuild.size} animations the build starts have keyframes`, `no keyframes for: ${list(undefinedNames)}`)

process.exit(failures ? 1 : 0)
