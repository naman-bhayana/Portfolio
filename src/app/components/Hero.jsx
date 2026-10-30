import { AVATAR, HERO, PERSON, WALL } from '@/content/site'
import { optimised, srcSet } from '@/lib/images'
import Icon from './Icon'
import TypedRole from './TypedRole'

// Seconds from the first frame until the wall's light has crossed. The hero itself has landed
// by 2.2 s; each piece holds its last frame until the end.
const ARRIVE = 3.7
const EASE = 'cubic-bezier(.2,.8,.2,1)' // --ease in base.css
const MOVES = {
  rise: ['opacity:0;translate:0 22px', 'opacity:1;translate:0 0'],
  letter: ['transform:translateY(112%)', 'transform:none'],
  settle: ['scale:.94', 'scale:1'],
  pop: ['opacity:0;scale:.9', 'opacity:1;scale:1'],
  // The wall's own scroll arrival is @keyframes wallin and wallsweep in motion.css: keep the
  // distance, the stops and the easing here in step with those.
  wallin: ['opacity:0;translate:0 14px', 'opacity:1;translate:0 0'],
}
// A move with stops of its own: [share of its duration, declarations]. The wall's light.
const SWEEP = [
  [0, 'transform:translateX(-100%);opacity:0'],
  [0.1, 'opacity:1'],
  [0.9, 'opacity:1'],
  [1, 'transform:translateX(100%);opacity:0'],
]
const SWEEP_EASE = 'cubic-bezier(.3,.6,.2,1)'

// The hero arrives in a set order: [selector, move, wait, duration, loop to run alongside,
// soft, pseudo-element]. A soft piece is written with no specificity at all, so the scroll
// arrival of the same part (motion.css) wins whenever MotionIsland plays that instead.
function arrivals() {
  const first = PERSON.firstName.length
  const letter = (word, i, n) => [`.${word} .l:nth-child(${i + 1})`, 'letter', 0.3 + n * 0.045, 0.95]
  return [
    ['.d1', 'rise', 0.1, 0.8],
    ...Array.from({ length: first }, (_, i) => letter('w1', i, i)),
    ...Array.from({ length: PERSON.lastName.length }, (_, i) => letter('w2', i, first + i)),
    ['.d2', 'rise', 0.95, 0.8],
    ['.d3', 'rise', 1.1, 0.8],
    ['.d4', 'rise', 1.25, 0.8],
    ['.stage', 'settle', 0.1, 1.1],
    // The chips pop in one after another, each then bobbing a second out of step with the last.
    ...HERO.chips.map((chip, i) => [`.c${i + 1}`, 'pop', 0.85 + i * 0.13, 0.7, `bob 6s ease-in-out ${i ? `-${i}s ` : ''}infinite`]),
    // The wall is the hero's closing band. On a laptop it is on the first screen and arrives with
    // the hero, as in the approved design: the marks from 1.3 s, the light from 1.9 s. Where it
    // starts below the fold, MotionIsland marks it (.rv-armed) before its marks rise, these
    // rules let go, and it arrives as the reader reaches it instead.
    ...WALL.marks.map((_, i) => [`.wall:not(.rv-armed) .wcell:nth-child(${i + 1})`, 'wallin', 1.3 + i * 0.035, 0.8, null, true]),
    ['.wall:not(.rv-armed)', SWEEP, 1.9, 1.8, null, true, '::after'],
  ]
}

// Every arrival is the same length and starts with the page; each piece's wait and its rest
// afterwards are written into its own keyframes. Staggering them with animation-delay looks
// the same but makes the browser wake the main thread at each start and each finish, which
// with this many pieces is most frames of the first two seconds.
// The rules stop applying once the page is marked as arrived (MotionIsland does that when the
// visitor pauses), so resuming the motion does not play the arrival a second time.
function arrivalCss() {
  const pct = (seconds) => `${Number(((seconds / ARRIVE) * 100).toFixed(2))}%`
  const frames = []
  const rules = []
  arrivals().forEach(([selector, move, wait, duration, loop, soft, pseudo = ''], i) => {
    const name = `in${i + 1}`
    let stops
    if (Array.isArray(move)) {
      stops = move.map(([share, declarations], k) => {
        const at = pct(wait + share * duration)
        if (k === 0) return `0%,${at}{${declarations};animation-timing-function:${SWEEP_EASE}}`
        if (k === move.length - 1) return `${at},100%{${declarations}}`
        return `${at}{${declarations};animation-timing-function:${SWEEP_EASE}}`
      })
    } else {
      const [from, to] = MOVES[move]
      stops = [`0%,${pct(wait)}{${from};animation-timing-function:${EASE}}`, `${pct(wait + duration)},100%{${to}}`]
    }
    frames.push(`@keyframes ${name}{${stops.join('').replace('100%,100%', '100%')}}`)
    rules.push(
      soft
        ? `:where(html:not(.arrived) ${selector})${pseudo}{animation:${name} ${ARRIVE}s backwards}`
        : `html:not(.arrived) ${selector}${pseudo}{animation:${name} ${ARRIVE}s both${loop ? `,${loop}` : ''}}`,
    )
  })
  return `${frames.join('')}@media (prefers-reduced-motion:no-preference){${rules.join('')}}`
}

// One span per letter so the name can rise in letter by letter. The letters are drawn by CSS
// (data-t): the h1 already carries the name as text. For the gradient word, each letter's
// slice of the gradient is set inline from the name itself.
function letters(word, gradient = false) {
  return [...word].map((letter, i) => (
    <span
      key={i}
      className="l"
      data-t={letter}
      style={
        gradient
          ? { backgroundSize: `${word.length * 100}% 100%`, backgroundPosition: `${word.length > 1 ? ((i / (word.length - 1)) * 100).toFixed(2) : 0}% 0` }
          : undefined
      }
    />
  ))
}

// Everything here is in the server HTML and visible without JavaScript; the motion is CSS.
// The avatar is the largest element on first paint, so it loads eagerly at high priority.
// The stage tilts towards the pointer (MotionIsland, data-tilt is the angle in degrees).
export default function Hero() {
  const { chips } = HERO
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <style dangerouslySetInnerHTML={{ __html: arrivalCss() }} />
      <div className="wrap herogrid">
        <div className="herotext">
          <h1 id="hero-heading" className="h1">
            <span className="hello grad d1">{HERO.greeting}</span> <span className="sr">{PERSON.name}</span>
            <span className="name" aria-hidden="true">
              <span className="w w1">{letters(PERSON.firstName)}</span>
              <span className="w w2">{letters(PERSON.lastName, true)}</span>
            </span>
          </h1>
          <TypedRole />
          <p className="lede d3">{HERO.lede}</p>
          <div className="cta d4">
            <a className="pill pill-primary" href={HERO.primaryCta.href}>
              {HERO.primaryCta.label} <Icon name="arrow" />
              <i className="lq" aria-hidden="true" />
            </a>
            <a className="pill pill-ghost" href={HERO.secondaryCta.href}>
              {HERO.secondaryCta.label}
              <i className="lq" aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="stage tilt" data-tilt="6">
          <div className="spot" aria-hidden="true" />
          <div className="orbit2" aria-hidden="true" />
          <div className="orbit" aria-hidden="true" />
          <div className="disc" aria-hidden="true" />
          <div className="halo" aria-hidden="true" />
          <div className="cut">
            {/* eslint-disable-next-line @next/next/no-img-element -- optimised URLs built in lib/images */}
            <img
              src={optimised(AVATAR.src, 768)}
              srcSet={srcSet(AVATAR.src)}
              sizes="(max-width: 960px) 346px, 520px"
              width={AVATAR.width}
              height={AVATAR.height}
              alt={AVATAR.alt}
              loading="eager"
              fetchPriority="high"
            />
          </div>
          {chips.map((chip, i) => (
            <div key={chip.id} className={`chip c${i + 1}`}>
              {/* `live` (site.js) gives a chip the pinging dot; none has it until the concierge ships. */}
              <span className={chip.live ? 'pulse' : 'dm'} aria-hidden="true" />
              <span>{chip.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
