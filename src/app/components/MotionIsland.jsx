'use client'

import { useEffect } from 'react'

const COUNT_MS = 1400
const BLANK = ' ' // holds an empty digit slot open

// Two enhancements on top of the CSS motion. The page is complete without either:
// 1. the proof figures count up from zero (the server HTML already holds the final values);
// 2. browsers without scroll-driven animations still get the section reveals.
// Both only touch what is still below the fold, and neither runs when the visitor has asked
// for less motion or has paused it.
export default function MotionIsland() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const pause = document.getElementById('pause-motion')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const printing = window.matchMedia('print')
    const still = () => reduced.matches || pause?.checked
    if (still()) return

    const belowFold = (el) => el.getBoundingClientRect().top > window.innerHeight
    const observers = []
    // An observer that hands over the elements that have just come into range, once each.
    const onEnter = (options, handle) => {
      const observer = new IntersectionObserver((entries) => {
        const entered = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target)
        entered.forEach((el) => observer.unobserve(el))
        if (entered.length) handle(entered)
      }, options)
      observers.push(observer)
      return observer
    }

    // Count-up. Every digit sits in a slot as wide as its final glyph, so the digits change
    // without moving anything around them: a figure that reflows on each frame counts as
    // layout shift. A narrower digit passing through keeps to the right of its slot, next to
    // the digit after it.
    const counting = new Map()
    const show = (el, value) => {
      const slots = counting.get(el)
      const digits = String(value).padStart(slots.length, BLANK)
      slots.forEach((slot, i) => {
        if (slot.textContent !== digits[i]) slot.replaceChildren(digits[i])
      })
    }
    const finish = (el) => {
      if (counting.delete(el)) el.textContent = el.dataset.count
    }
    const count = (el) => {
      const target = Number(el.dataset.count)
      const started = performance.now()
      const step = (now) => {
        if (!counting.has(el)) return
        const progress = Math.min(1, (now - started) / COUNT_MS)
        if (progress === 1) return finish(el)
        show(el, Math.round(target * (1 - (1 - progress) ** 3)))
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    const seen = onEnter({ threshold: 0.6 }, (figures) => figures.forEach(count))

    // A figure is set to zero when it is about a screen away, a few at a time. Each digit's
    // width is read off the untouched text before anything is written, so the browser lays
    // the figures out once, in its own time, and the work never becomes a long task.
    const arm = (near) => {
      if (still()) return
      const figures = near.filter(belowFold)
      const range = document.createRange()
      const widths = figures.map((el) =>
        [...el.textContent].map((_, i) => {
          range.setStart(el.firstChild, i)
          range.setEnd(el.firstChild, i + 1)
          return range.getBoundingClientRect().width
        }),
      )
      figures.forEach((el, n) => {
        const slots = widths[n].map((width, i, all) => {
          const slot = document.createElement('span')
          slot.style.cssText = `display:inline-block;width:${width}px;text-align:right`
          slot.textContent = i === all.length - 1 ? '0' : BLANK
          return slot
        })
        el.replaceChildren(...slots)
        counting.set(el, slots)
        seen.observe(el)
      })
    }
    // Nothing is touched until the visitor starts to scroll. Whatever reads the page without
    // scrolling (a crawler, a link preview, a print) finds the real numbers.
    const approach = onEnter({ rootMargin: '0px 0px 100% 0px' }, arm)
    const start = () => document.querySelectorAll('[data-count]').forEach((el) => approach.observe(el))
    window.addEventListener('scroll', start, { once: true, passive: true })

    // Pausing, asking the system for less motion, or printing puts every figure on its
    // final value. Pausing also marks the page as arrived, so that resuming the motion does
    // not play the hero's arrival a second time (see Hero.jsx).
    const settle = () => [...counting.keys()].forEach(finish)
    const settleIfStill = () => {
      if (!still()) return
      if (pause?.checked) document.documentElement.classList.add('arrived')
      settle()
    }
    const settleForPrint = (query) => {
      if (query.matches) settle()
    }
    pause?.addEventListener('change', settleIfStill)
    reduced.addEventListener('change', settleIfStill)
    printing.addEventListener('change', settleForPrint)
    window.addEventListener('beforeprint', settle)

    // Reveal fallback for browsers without scroll-driven animations. A waiting block plays in
    // when it comes into view, and lets go of the animation once played, so resuming from a
    // pause does not replay it. A block that takes keyboard focus first is shown at once.
    let revealFocused = null
    if (!CSS.supports('animation-timeline: view()')) {
      const reveal = (el) => {
        if (!el.classList.replace('rv-wait', 'rv-in')) return
        const played = (event) => {
          if (event.target !== el) return
          el.classList.remove('rv-in')
          el.removeEventListener('animationend', played)
          el.removeEventListener('animationcancel', played)
        }
        el.addEventListener('animationend', played)
        el.addEventListener('animationcancel', played)
      }
      const arriving = onEnter({ rootMargin: '0px 0px -10% 0px' }, (blocks) => blocks.forEach(reveal))
      for (const el of [...document.querySelectorAll('.rv')].filter(belowFold)) {
        el.classList.add('rv-wait')
        arriving.observe(el)
      }
      revealFocused = (event) => {
        const block = event.target.closest?.('.rv-wait')
        if (!block) return
        arriving.unobserve(block)
        block.classList.remove('rv-wait')
      }
      document.addEventListener('focusin', revealFocused)
    }

    return () => {
      observers.forEach((observer) => observer.disconnect())
      window.removeEventListener('scroll', start)
      pause?.removeEventListener('change', settleIfStill)
      reduced.removeEventListener('change', settleIfStill)
      printing.removeEventListener('change', settleForPrint)
      window.removeEventListener('beforeprint', settle)
      if (revealFocused) document.removeEventListener('focusin', revealFocused)
      settle()
    }
  }, [])

  return null
}
