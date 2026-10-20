import { AVATAR, HERO, PERSON } from '@/content/site'
import { optimised, srcSet } from '@/lib/images'
import Icon from './Icon'
import TypedRole from './TypedRole'

const ARRIVE = 2.2 // seconds from the first frame until the last piece of the hero has landed
const EASE = 'cubic-bezier(.2,.8,.2,1)' // --ease in base.css
const MOVES = {
  rise: ['opacity:0;translate:0 22px', 'opacity:1;translate:0 0'],
  letter: ['transform:translateY(112%)', 'transform:none'],
  settle: ['scale:.94', 'scale:1'],
  pop: ['opacity:0;scale:.9', 'opacity:1;scale:1'],
}

// The hero arrives in a set order: [selector, move, wait, duration, loop to run alongside].
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
  arrivals().forEach(([selector, move, wait, duration, loop], i) => {
    const [from, to] = MOVES[move]
    const stops = [`0%,${pct(wait)}{${from};animation-timing-function:${EASE}}`, `${pct(wait + duration)},100%{${to}}`]
    frames.push(`@keyframes in${i + 1}{${stops.join('').replace('100%,100%', '100%')}}`)
    rules.push(`html:not(.arrived) ${selector}{animation:in${i + 1} ${ARRIVE}s both${loop ? `,${loop}` : ''}}`)
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
          ? { backgroundSize: `${word.length * 100}% 100%`, backgroundPosition: `${((i / (word.length - 1)) * 100).toFixed(2)}% 0` }
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
            </a>
            <a className="pill pill-ghost" href={HERO.secondaryCta.href}>
              {HERO.secondaryCta.label}
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
              <span className={chip.live ? 'pulse' : 'dm'} aria-hidden="true" />
              <span>{chip.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
