import { HERO } from '@/content/site'

const LEAD = 1.5 // seconds of bare caret before the first role: time for the name to land
const SLOT = 4 // seconds each role owns
const PER_CHARACTER = 0.0464 // seconds to type one character

// Keyframes written from the roles' lengths. Each role owns one slot of the cycle: typed in
// one character per step, held, then deleted. A role is revealed by sliding its clipping box
// in from the left while the text inside slides the other way, so the text stands still and
// only its right edge moves; its caret rides the same edge and shows only in that slot.
// Every stop is a translate by a share of the role's own width: one step is one character
// because the line is monospace, whatever the font size or letter spacing, and typing costs
// no layout and no main-thread work.
//
// The pause before the first role is part of the cycle, not an animation-delay: a positive
// delay wakes the main thread when it runs out. A role outside its slot is transparent as
// well as moved away. Chrome works the percentages out in pixels when it starts a loop, and
// they can be a web font out of date (MotionIsland.jsx starts the loops again once the fonts
// are in); a line that is not being typed must not show through in the meantime.
function typingCss(roles) {
  const cycle = LEAD + roles.length * SLOT
  const at = (seconds) => `${Number(((seconds / cycle) * 100).toFixed(2))}%`
  const frames = roles.map((role, i) => {
    const n = role.length
    const begin = LEAD + i * SLOT
    const start = at(begin)
    const typed = at(begin + Math.min(SLOT * 0.38, n * PER_CHARACTER))
    const hold = at(begin + SLOT * 0.82)
    const gone = at(begin + SLOT * 0.96)
    const end = at(begin + SLOT)
    const steps = `animation-timing-function:steps(${n},end)`
    // The text slides in from the right and back, one character per step.
    const text =
      `@keyframes tx${i + 1}{0%{translate:100%}${start}{translate:100%;${steps}}` +
      `${typed}{translate:0;animation-timing-function:linear}${hold}{translate:0;${steps}}${gone}{translate:100%}100%{translate:100%}}`
    // The clipping box and the caret make the same trip from `rest` to `shown`, and are only
    // visible in this role's slot. `lead` is what they show before the slot begins.
    const gated = (name, rest, shown, lead) =>
      `@keyframes ${name}{0%{translate:${rest};opacity:${lead};animation-timing-function:step-end}` +
      `${start}{translate:${rest};opacity:1;${steps}}${typed}{translate:${shown};opacity:1;animation-timing-function:linear}` +
      `${hold}{translate:${shown};opacity:1;${steps}}${gone}{translate:${rest};opacity:1;animation-timing-function:step-end}` +
      `${end}{translate:${rest};opacity:0}${end === '100%' ? '' : `100%{translate:${rest};opacity:0}`}}`
    // The first caret also shows through the pause that opens the cycle.
    return text + gated(`ty${i + 1}`, '-100%', '0', 0) + gated(`tk${i + 1}`, '0', '100%', i === 0 ? 1 : 0)
  })
  const timing = `${cycle}s infinite`
  const rules = roles.map(
    (_, i) => `.t${i + 1} .tc{animation:ty${i + 1} ${timing}}.t${i + 1} .tc>span{animation:tx${i + 1} ${timing}}.t${i + 1} .caret{animation:tk${i + 1} ${timing}}`,
  )
  return `${frames.join('')}@media (prefers-reduced-motion:no-preference){${rules.join('')}}`
}

// The roles type themselves in turn with CSS alone. Without motion the first role is shown.
// The line is drawn by CSS (data-t); the text of the paragraph is one plain sentence, which is
// what screen readers and anything else reading the HTML get instead of the animation.
export default function TypedRole() {
  return (
    <p className="role d2">
      <style dangerouslySetInnerHTML={{ __html: typingCss(HERO.roles) }} />
      <span className="sr">{HERO.rolesSummary}</span>
      <span className="pro" aria-hidden="true" data-t=">" />
      <span className="tw" aria-hidden="true">
        {HERO.roles.map((role, i) => (
          <span key={role} className={`t t${i + 1}`}>
            <span className="tc">
              <span data-t={role} />
            </span>
            <span className="caret" />
          </span>
        ))}
      </span>
    </p>
  )
}
