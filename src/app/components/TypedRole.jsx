import { HERO } from '@/content/site'

const CYCLE = 16 // seconds for one pass through every role
const DELAY = 1.5 // seconds: starts after the name has landed

// Keyframes written from the roles' lengths. Each role owns an equal slot of the cycle: typed
// in one character per step, held, then deleted. A role is revealed by sliding its clipping
// box in from the left while the text inside slides the other way, so the text stands still
// and only its right edge moves; its caret rides the same edge and shows only in that slot.
// Every stop is a translate by a share of the role's own width: one step is one character
// because the line is monospace, whatever the font size or letter spacing, and typing costs
// no layout and no main-thread work.
function typingCss(roles) {
  const slot = 100 / roles.length
  const pct = (value) => `${Number(value.toFixed(2))}%`
  const css = roles.map((role, i) => {
    const n = role.length
    const first = i === 0
    const start = pct(i * slot)
    const typed = pct(i * slot + Math.min(slot * 0.38, n * 0.29))
    const hold = pct(i * slot + slot * 0.82)
    const gone = pct(i * slot + slot * 0.96)
    const end = pct((i + 1) * slot)
    const steps = `animation-timing-function:steps(${n},end)`
    // From `rest` to `shown` and back, one character per step.
    const slide = (name, rest, shown) =>
      `@keyframes ${name}{${first ? '' : `0%{translate:${rest}}`}` +
      `${start}{translate:${rest};${steps}}${typed}{translate:${shown};animation-timing-function:linear}` +
      `${hold}{translate:${shown};${steps}}${gone}{translate:${rest}}100%{translate:${rest}}}`
    // The caret also switches itself on for exactly this slot.
    const caret =
      `@keyframes tk${i + 1}{${first ? '' : '0%{translate:0;opacity:0;animation-timing-function:step-end}'}` +
      `${start}{translate:0;opacity:1;${steps}}${typed}{translate:100%;opacity:1;animation-timing-function:linear}` +
      `${hold}{translate:100%;opacity:1;${steps}}${gone}{translate:0;opacity:1;animation-timing-function:step-end}` +
      `${end}{translate:0;opacity:0}${end === '100%' ? '' : '100%{translate:0;opacity:0}'}}`
    return { frames: slide(`ty${i + 1}`, '-100%', '0') + slide(`tx${i + 1}`, '100%', '0') + caret, i }
  })
  const timing = `${CYCLE}s ${DELAY}s infinite both`
  const rules = css.map(({ i }) => `.t${i + 1} .tc{animation:ty${i + 1} ${timing}}.t${i + 1} .tc>span{animation:tx${i + 1} ${timing}}.t${i + 1} .caret{animation:tk${i + 1} ${timing}}`)
  return `${css.map(({ frames }) => frames).join('')}@media (prefers-reduced-motion:no-preference){${rules.join('')}}`
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
