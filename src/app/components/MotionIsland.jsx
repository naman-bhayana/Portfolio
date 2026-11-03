'use client'

import { useEffect } from 'react'

const SCRAMBLE_MS = 520 // a figure shows random digits for this long before it counts
const COUNT_MS = 1300
const BLANK = ' ' // holds an empty digit slot open
const ASSEMBLE_MS = 1500 // one dot's flight into the grid
const DPR_CAP = 1.5
// A block that starts with less than this share of itself on screen may still wait for the
// reader, if it is the wall and its marks have not risen yet (the approved design's threshold).
const WAIT_SHARE = 0.12
const BATCH = /^in\d+$/ // the hero's arrival (Hero.jsx), which the wall is part of

// The particle field runs in a worker, on the canvas it is handed (field.worker.js). A frame
// loop on the main thread would make Chrome update every CSS loop on the page there, every
// frame, so a page with the field drifting could never rest (T8.idle-main-thread). A canvas
// can be handed over only once, so there is one worker for the life of the page; React's
// strict mode mounts this effect twice in development, and the second mount reuses it.
let field = null

// What needs a script, on top of the CSS. The page is complete without any of it.
// Always, because none of it moves anything:
// - the nav marks the section on screen;
// - scroll-driven parts far from the screen let go of their animation (.far, motion.css);
// - the rail's pulse learns the rail's width, and starts once the rail has arrived (.lit).
// Only while motion runs, which is from the start, or from the first resume when the page
// opens paused or with less motion asked for:
// - the proof figures scramble, then count up (the server HTML already holds the final values);
// - the blocks below the fold arrive as the reader reaches them (html.rv-on, .rv-wait, .rv-in);
// - the 400 dots of the proof stage fly in on a canvas before the real grid shows;
// - the particle field drifts under the page;
// - the avatar stage and the plates tilt towards the pointer, which also carries a light;
// - the loops are started again once the web fonts are in, so none runs on stale sizes.
// Pausing or asking for less motion stops all of that at once and shows the finished page.
export default function MotionIsland() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const html = document.documentElement
    const pause = document.getElementById('pause-motion')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const printing = window.matchMedia('print')
    const hover = window.matchMedia('(hover: hover)').matches
    // A voice call with the concierge (html[data-call], set by its panel) rests the page too, so
    // the field and the tilt leave the device to the audio.
    const still = () => reduced.matches || pause?.checked || html.hasAttribute('data-call')

    const observers = []
    const listeners = []
    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options)
      listeners.push(() => target.removeEventListener(type, handler, options))
    }
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
    const belowFold = (el) => el.getBoundingClientRect().top >= window.innerHeight

    // ---------------------------------------------------------------- the nav
    // Every section is watched, so a section without a link (the wall, the proof) clears the mark.
    const links = new Map(
      [...document.querySelectorAll('.nav .links a')].flatMap((a) => {
        const section = document.getElementById(a.getAttribute('href')?.split('#')[1] ?? '')
        return section ? [[section, a]] : []
      }),
    )
    // The row's one bar slides to the current link (chrome.css .navline): placed when the current
    // link changes and when the row is laid out again.
    const navline = document.querySelector('.nav .navline')
    const linksBox = document.querySelector('.nav .links')
    const placeNavline = () => {
      if (!navline || !linksBox) return
      const a = linksBox.querySelector('a[aria-current]')
      if (!a) {
        navline.style.setProperty('--on', '0')
        return
      }
      const r = a.getBoundingClientRect()
      const b = linksBox.getBoundingClientRect()
      navline.style.setProperty('--x', `${r.left - b.left}px`)
      navline.style.setProperty('--w', String(r.width))
      navline.style.setProperty('--on', '1')
    }
    on(window, 'resize', placeNavline, { passive: true })
    // The links change width as the web fonts land; the line follows them.
    document.fonts?.ready.then(placeNavline)
    if (document.fonts) on(document.fonts, 'loadingdone', placeNavline)
    const current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          for (const [section, a] of links) {
            if (section === entry.target) a.setAttribute('aria-current', 'location')
            else a.removeAttribute('aria-current')
          }
          placeNavline()
        }
      },
      { rootMargin: '-35% 0px -55% 0px' },
    )
    observers.push(current)
    for (const section of document.querySelectorAll('main > section')) current.observe(section)

    // ---------------------------------------------------------------- far scroll-driven parts
    // A scroll-driven animation whose subject is several screens away is serviced by Chrome on
    // the main thread, every frame, and every other loop's timing is updated with it. So the
    // lights, the brand card, the portrait and the cases let go of their animation while they
    // are more than a screen and a half away, and take it back on the way in (motion.css).
    const far = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entry.target.classList.toggle('far', !entry.isIntersecting)
      },
      { rootMargin: '150% 0px 150% 0px' },
    )
    observers.push(far)
    for (const el of document.querySelectorAll('.light, .para-soft, .para-img, .case')) far.observe(el)

    // ---------------------------------------------------------------- the rail's pulse
    const railwrap = document.querySelector('.railwrap')
    const rail = railwrap?.querySelector('.rail')
    if (rail) {
      const setRail = () => railwrap.style.setProperty('--railw', `${rail.clientWidth}px`)
      setRail()
      on(window, 'resize', setRail, { passive: true })
    }

    // ---------------------------------------------------------------- the motion
    const startMotion = () => {
      const stops = []
      const listen = (target, type, handler, options) => {
        target.addEventListener(type, handler, options)
        stops.push(() => target.removeEventListener(type, handler, options))
      }
      const watch = (options, handle) => {
        const observer = onEnter(options, handle)
        stops.push(() => observer.disconnect())
        return observer
      }

      // Chrome hands a loop to the compositor with its percentages already worked out in
      // pixels, and keeps those pixels if the box changes size while the loop is still being
      // started. A web font landing just after the first paint is enough: the typed role's
      // caret then sits a few pixels off its text for good. Once the fonts have settled, every
      // loop is moved on by a millisecond, which makes the browser hand it over again.
      let fontsSettled = 0
      const resync = () => {
        for (const animation of document.getAnimations?.() ?? []) {
          const loops = animation.effect?.getComputedTiming().iterations === Infinity
          if (loops && animation.timeline === document.timeline && animation.currentTime !== null) animation.currentTime += 1
        }
      }
      const resyncSoon = () => {
        clearTimeout(fontsSettled)
        fontsSettled = setTimeout(resync, 200)
      }
      document.fonts?.ready.then(resyncSoon)
      document.fonts?.addEventListener('loadingdone', resyncSoon)
      stops.push(() => {
        document.fonts?.removeEventListener('loadingdone', resyncSoon)
        clearTimeout(fontsSettled)
      })

      // -------------------------------------------------------------- figures
      // Every digit sits in a slot as wide as its final glyph, so the digits change without
      // moving anything around them: a figure that reflows on each frame counts as layout
      // shift. The figure shows random digits first, then eases up to its value.
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
        const low = 10 ** (String(target).length - 1)
        const started = performance.now()
        const step = (now) => {
          if (!counting.has(el)) return
          const elapsed = now - started
          if (elapsed < SCRAMBLE_MS) show(el, low + Math.floor(Math.random() * low * 9))
          else {
            const progress = Math.min(1, (elapsed - SCRAMBLE_MS) / COUNT_MS)
            if (progress === 1) {
              finish(el)
              // The hero figure pulses a ring once it has landed (motion.css).
              el.closest('.hfig')?.classList.add('landed')
              return
            }
            show(el, Math.round(target * (1 - 2 ** (-10 * progress))))
          }
          requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }
      const seen = watch({ threshold: 0.6 }, (figures) => figures.forEach(count))

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
      // Nothing is touched until a visitor shows up: the first scroll, wheel, key, touch or
      // pointer move, or a page that opens already scrolled (a link to a section, a restored
      // position). Whatever reads the page without any of that (a crawler, a link preview, a
      // print) finds the real numbers. Only figures below the screen are ever set to zero.
      const approach = watch({ rootMargin: '0px 0px 100% 0px' }, arm)
      // One signal takes all six listeners away together, after the first of them fires.
      const firstSign = new AbortController()
      stops.push(() => firstSign.abort())
      let started = false
      const start = () => {
        firstSign.abort()
        if (started) return
        started = true
        document.querySelectorAll('[data-count]').forEach((el) => approach.observe(el))
      }
      for (const type of ['scroll', 'wheel', 'keydown', 'pointerdown', 'pointermove', 'touchstart']) window.addEventListener(type, start, { passive: true, signal: firstSign.signal })
      // The page as finished, at once (pause, print): the figures on their values and the dots'
      // flight over, the grid in its place.
      const settle = () => {
        ;[...counting.keys()].forEach(finish)
        if (assembling) {
          cancelAnimationFrame(assembling.raf)
          assembling.done()
        }
      }

      // -------------------------------------------------------------- the dots
      // The 400 dots fly in from across the stage and settle onto their grid, on one canvas,
      // once, at full size and brightness; as they land the grid fades in under them and the
      // canvas fades out. The grid's place is read from offsets, which the arrival's transform
      // does not move; they are summed up the offsetParent chain, because a transformed box
      // counts as an offsetParent.
      let assembling = null
      const offsetIn = (el, root) => {
        let x = 0
        let y = 0
        for (let node = el; node && node !== root; node = node.offsetParent) {
          x += node.offsetLeft
          y += node.offsetTop
        }
        return [x, y]
      }
      const assemble = (stage) => {
        const grid = stage.querySelector('.dotfield')
        if (!grid || assembling) return
        const canvas = document.createElement('canvas')
        canvas.className = 'assemble'
        stage.classList.add('assembling')
        stage.appendChild(canvas)
        const W = stage.offsetWidth
        const H = stage.offsetHeight
        const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1)
        canvas.width = W * dpr
        canvas.height = H * dpr
        canvas.style.width = `${W}px`
        canvas.style.height = `${H}px`
        const ctx = canvas.getContext('2d')
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        const cell = grid.offsetWidth / 20
        const [gx, gy] = offsetIn(grid, stage)
        const dots = []
        for (let r = 0; r < 20; r++) {
          for (let q = 0; q < 20; q++) {
            dots.push({
              tx: gx + (q + 0.5) * cell,
              ty: gy + (r + 0.5) * cell,
              sx: Math.random() * W * 1.4 - W * 0.2,
              sy: Math.random() * H * 1.6 - H * 0.3,
              delay: (Math.hypot(q - 9.5, r - 9.5) / 13.4) * 650 + Math.random() * 120,
              rad: Math.random() < 0.5 ? 2.4 : 2,
            })
          }
        }
        const done = () => {
          stage.classList.remove('assembling')
          requestAnimationFrame(() => {
            canvas.style.opacity = '0'
          })
          setTimeout(() => canvas.remove(), 520)
          assembling = null
        }
        let t0 = null
        const frame = (t) => {
          t0 ??= t
          const elapsed = t - t0
          let finished = true
          ctx.clearRect(0, 0, W, H)
          ctx.fillStyle = 'rgba(0,225,255,.86)'
          for (const dot of dots) {
            const p = Math.max(0, Math.min(1, (elapsed - dot.delay) / ASSEMBLE_MS))
            if (p < 1) finished = false
            const e = 1 - (1 - p) ** 4
            ctx.globalAlpha = 0.35 + 0.65 * e
            ctx.beginPath()
            ctx.arc(dot.sx + (dot.tx - dot.sx) * e, dot.sy + (dot.ty - dot.sy) * e, dot.rad, 0, 6.2832)
            ctx.fill()
          }
          if (finished) done()
          else assembling.raf = requestAnimationFrame(frame)
        }
        assembling = { raf: requestAnimationFrame(frame), done }
      }

      // -------------------------------------------------------------- arrivals
      // A block below the fold waits (.rv-wait) and plays in when it comes into view (.rv-in).
      // Once every one-shot animation inside it has played, the block lets go of the class, so
      // nothing stays on a moving layer. A block that takes keyboard focus first is shown at
      // once. The blocks are marked once the browser is idle, after hydration and first layout.
      const whenIdle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 50))
      const cancelIdle = window.cancelIdleCallback ?? clearTimeout
      // Headline words, so each can arrive on its own. Elements stay whole (an accent phrase
      // sets as one unit with or without the split, base.css) and text is split at its spaces.
      // Anything else goes: React leaves a comment between two text nodes, and wrapped as a
      // word that empty box could start a line and push the space after it into view.
      const splitWords = (el) => {
        let n = 0
        const word = (node) => {
          const span = document.createElement('span')
          span.className = 'wd'
          span.style.setProperty('--i', n++)
          span.append(node)
          return span
        }
        const parts = [...el.childNodes].flatMap((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) return [word(node)]
          if (node.nodeType !== Node.TEXT_NODE) return []
          return node.textContent.split(/(\s+)/).flatMap((part) => (!part ? [] : /^\s+$/.test(part) ? [' '] : [word(document.createTextNode(part))]))
        })
        el.replaceChildren(...parts)
        el.classList.add('split')
      }
      const released = (event) => {
        const block = event.currentTarget
        // Loops inside a block (the rail's flares, the proof stage's halo) never finish: they do not hold it.
        const live = block.getAnimations({ subtree: true }).some((a) => a.timeline === document.timeline && a.playState !== 'finished' && a.effect?.getComputedTiming().iterations !== Infinity)
        if (!live) block.classList.remove('rv-in')
      }
      const reveal = (block) => {
        if (!block.classList.replace('rv-wait', 'rv-in')) return
        for (const type of ['animationend', 'animationcancel', 'transitionend']) block.addEventListener(type, released)
        if (block.classList.contains('pstage')) assemble(block)
        if (block === rail) railwrap.classList.add('lit')
      }
      // A block waits for the reader (.rv-wait) when it is wholly below the fold. The wall, which
      // arrives with the hero, also waits when less than 12% of it shows and none of its marks is
      // both risen and on screen (a sliver of its band can show while every mark is still below
      // the fold): hiding them then changes nothing the reader sees. Marked .rv-armed, it leaves
      // the hero's arrival for good. Nothing the reader can already see, or has scrolled past,
      // ever goes back.
      // Risen means drawn: a part of the batch whose opacity has left zero.
      const rising = (animation) => Number(getComputedStyle(animation.effect.target, animation.effect.pseudoElement).opacity) > 0.01
      const toWait = (block) => {
        const r = block.getBoundingClientRect()
        if (belowFold(block)) return true
        if (r.bottom <= 0 || r.height === 0) return false
        const shown = (Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)) / r.height
        if (shown >= WAIT_SHARE) return false
        const batch = block.getAnimations({ subtree: true }).filter((animation) => BATCH.test(animation.animationName))
        const marks = batch.filter((animation) => !animation.effect.pseudoElement)
        return batch.length > 0 && !marks.some((animation) => rising(animation) && animation.effect.target.getBoundingClientRect().top < window.innerHeight)
      }
      let marked = false
      const arriving = watch({ rootMargin: '0px 0px -10% 0px', threshold: 0.12 }, (blocks) => blocks.forEach(reveal))
      const idleArrivals = whenIdle(
        () => {
          if (still()) return
          html.classList.add('rv-on')
          marked = true
          // A page that opens scrolled has a visitor: its figures below may count.
          if (window.scrollY > 0) start()
          for (const block of [...document.querySelectorAll('[data-rv]')].filter(toWait)) {
            block.querySelectorAll(':scope > .h2, :scope > .h2b').forEach(splitWords)
            block.classList.add('rv-wait', 'rv-armed')
            arriving.observe(block)
          }
          // The rail's pulse starts once the rail has arrived, or at once if it never waits.
          if (rail && !rail.classList.contains('rv-wait')) railwrap.classList.add('lit')
        },
        { timeout: 2000 },
      )
      stops.push(() => cancelIdle(idleArrivals))
      // Focus never lands on anything still hidden or fading in: a waiting block is shown at once,
      // and a block mid-arrival (reached a moment ago by the previous tab stop) finishes its
      // arrival. Only the arrival's own one-shot animations are finished: hover and press
      // transitions, and the loops, are left alone.
      listen(document, 'focusin', (event) => {
        // The hero's own arrival too: its buttons can take focus while they still fade in.
        const hero = event.target.closest?.('.hero')
        if (hero) {
          for (const animation of hero.getAnimations({ subtree: true })) if (BATCH.test(animation.animationName) && animation.playState === 'running') animation.finish()
          return
        }
        const block = event.target.closest?.('.rv-wait, .rv-in')
        if (!block) return
        if (block.classList.contains('rv-in')) {
          for (const animation of block.getAnimations({ subtree: true })) {
            if (animation instanceof CSSAnimation && animation.timeline === document.timeline && animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity) animation.finish()
          }
          return
        }
        arriving.unobserve(block)
        block.classList.remove('rv-wait')
      })

      // -------------------------------------------------------------- the field
      // Started once the browser is idle after load, so the first seconds stay the page's own.
      const canvas = document.querySelector('canvas.field')
      const stage = document.querySelector('.hero .stage')
      const viewport = () => [document.documentElement.clientWidth, document.documentElement.clientHeight]
      const vortex = () => {
        if (!stage) return null
        const r = stage.getBoundingClientRect()
        return r.bottom > 0 && r.top < window.innerHeight ? { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width * 0.95 } : null
      }
      const post = (message) => field?.worker.postMessage(message)
      const runField = () => {
        if (!canvas || still() || document.hidden) return
        if (!field) {
          if (!('transferControlToOffscreen' in canvas) || typeof Worker === 'undefined') return
          const worker = new Worker(new URL('./field.worker.js', import.meta.url))
          const offscreen = canvas.transferControlToOffscreen()
          const [W, H] = viewport()
          worker.postMessage({ type: 'init', canvas: offscreen, W, H, dpr: Math.min(DPR_CAP, window.devicePixelRatio || 1), many: hover }, [offscreen])
          field = { worker, W, H }
        }
        post({ type: 'scroll', y: window.scrollY, vortex: vortex() })
        post({ type: 'run' })
      }
      const idleField = whenIdle(runField, { timeout: 2000 })
      stops.push(() => cancelIdle(idleField))
      listen(document, 'pointermove', (e) => post({ type: 'pointer', x: e.clientX, y: e.clientY }), { passive: true })
      listen(document, 'pointerleave', () => post({ type: 'pointer', x: -1e4, y: -1e4 }))
      listen(window, 'scroll', () => post({ type: 'scroll', y: window.scrollY, vortex: vortex() }), { passive: true })
      // A phone's address bar changes the height on every scroll; only a real change resizes.
      listen(window, 'resize', () => {
        if (!field) return
        const [W, H] = viewport()
        if (W === field.W && Math.abs(H - field.H) <= 160) return
        field.W = W
        field.H = H
        post({ type: 'size', W, H })
      }, { passive: true })
      listen(document, 'visibilitychange', () => (document.hidden ? post({ type: 'stop' }) : runField()))

      // -------------------------------------------------------------- tilt and the light
      // Targets are set by events; a loop eases towards them and stops once everything rests.
      // The light starts in the middle of the screen and follows the pointer from its first move.
      const tilts = []
      let tiltRaf = 0
      // The parts a near pointer pulls (a few pixels, through a transition) and the chips that
      // drift away from it over the avatar and settle back.
      const magnets = [...document.querySelectorAll('.pill, .pause, .copybtn')]
      const chips = [...document.querySelectorAll('.hero .chip')]
      const cursor = hover ? document.querySelector('.cursor') : null
      let cx = window.innerWidth / 2
      let cy = window.innerHeight / 2
      let tx = cx
      let ty = cy
      let lastCursor = ''
      const placeCursor = () => {
        const value = `translate(${(cx - 320).toFixed(1)}px,${(cy - 320).toFixed(1)}px)`
        if (value === lastCursor) return false
        cursor.style.transform = value
        lastCursor = value
        return true
      }
      const showCursor = () => {
        if (!cursor) return
        placeCursor()
        cursor.classList.add('on')
      }
      const loop = () => {
        tiltRaf = 0
        if (still()) return
        let moving = false
        for (const o of tilts) {
          if (o.direct) continue
          o.rx += (o.tx - o.rx) * 0.11
          o.ry += (o.ty - o.ry) * 0.11
          const value = angle(o.rx, o.ry)
          if (value !== o.last) {
            o.el.style.rotate = value
            o.last = value
            moving = true
          }
          if (Math.hypot(o.tx - o.rx, o.ty - o.ry) > 0.02) moving = true
        }
        if (cursor) {
          cx += (tx - cx) * 0.13
          cy += (ty - cy) * 0.13
          if (placeCursor()) moving = true
        }
        if (moving) tiltRaf = requestAnimationFrame(loop)
      }
      const run = () => {
        if (!tiltRaf && !still()) tiltRaf = requestAnimationFrame(loop)
      }
      // The avatar stage and the plates take the angle straight from the pointer and let a
      // short CSS transition ease it (base.css), as in the approved design; the cases of the
      // deck, which also scale as they recede, and the light are eased by the loop.
      const angle = (x, y) => {
        const ang = Math.hypot(x, y)
        return ang < 0.03 ? '' : `${(x / ang).toFixed(3)} ${(y / ang).toFixed(3)} 0 ${ang.toFixed(2)}deg`
      }
      const aim = (o) => {
        if (!o.direct) return run()
        if (still()) return
        const value = angle(o.tx, o.ty)
        if (value !== o.last) {
          o.el.style.rotate = value
          o.last = value
        }
      }
      if (hover) {
        for (const el of document.querySelectorAll('.tilt')) {
          const o = { el, rx: 0, ry: 0, tx: 0, ty: 0, max: parseFloat(el.dataset.tilt) || 4, last: '', direct: !el.matches('.case') }
          tilts.push(o)
          listen(el, 'pointermove', (e) => {
            const r = el.getBoundingClientRect()
            o.tx = ((e.clientY - r.top) / r.height - 0.5) * -2 * o.max
            o.ty = ((e.clientX - r.left) / r.width - 0.5) * 2 * o.max
            aim(o)
          }, { passive: true })
          listen(el, 'pointerleave', () => {
            o.tx = 0
            o.ty = 0
            aim(o)
          })
        }
        listen(document, 'pointermove', (e) => {
          tx = e.clientX
          ty = e.clientY
          run()
        }, { passive: true })
        showCursor()

        // Magnetic pulls and the liquid light: a pill, the pause switch and the copy button
        // drift towards a near pointer (chrome.css eases the translate back) and carry its
        // position for their highlight. Every box is read before any style is written.
        listen(document, 'pointermove', (e) => {
          if (still()) return
          const boxes = magnets.map((el) => el.getBoundingClientRect())
          magnets.forEach((el, i) => {
            const r = boxes[i]
            const dx = e.clientX - (r.left + r.width / 2)
            const dy = e.clientY - (r.top + r.height / 2)
            const d = Math.hypot(dx, dy) || 1
            const reach = Math.max(r.width, r.height) * 0.9
            if (d < reach) {
              const f = (1 - d / reach) * 7
              el.style.translate = `${((dx / d) * f).toFixed(1)}px ${((dy / d) * f).toFixed(1)}px`
              el.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`)
              el.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`)
            } else if (el.style.translate) el.style.translate = ''
          })
        }, { passive: true })
        if (stage) {
          // Through transform: the chips' bob animates `translate`, which would win over a style.
          listen(stage, 'pointermove', (e) => {
            if (still()) return
            const boxes = chips.map((c) => c.getBoundingClientRect())
            chips.forEach((c, i) => {
              const r = boxes[i]
              const dx = r.left + r.width / 2 - e.clientX
              const dy = r.top + r.height / 2 - e.clientY
              const d = Math.hypot(dx, dy) || 1
              const push = d < 150 ? (1 - d / 150) * 22 : 0
              c.style.transform = push ? `translateZ(40px) translate(${((dx / d) * push).toFixed(1)}px, ${((dy / d) * push).toFixed(1)}px)` : ''
            })
          }, { passive: true })
          listen(stage, 'pointerleave', () => chips.forEach((c) => (c.style.transform = '')))
        }
      }

      // -------------------------------------------------------------- stopping and resuming
      // Stopping shows the finished page at once: figures on their values, nothing waiting
      // below the fold, the field, the tilt and the light at rest.
      const rest = () => {
        settle()
        html.classList.remove('rv-on')
        for (const el of document.querySelectorAll('.rv-wait, .rv-in')) el.classList.remove('rv-wait', 'rv-in')
        post({ type: 'stop' })
        cancelAnimationFrame(tiltRaf)
        tiltRaf = 0
        for (const o of tilts) {
          o.el.style.rotate = ''
          o.rx = o.ry = o.tx = o.ty = 0
          o.last = ''
        }
        cursor?.classList.remove('on')
        for (const el of magnets) el.style.translate = ''
        for (const c of chips) c.style.transform = ''
      }
      // Resuming plays no arrival again (nothing waits any more), but smooth scrolling and the
      // rail's pulse come back once the page has been marked.
      const resume = () => {
        if (marked) {
          html.classList.add('rv-on')
          railwrap?.classList.add('lit')
        }
        runField()
        showCursor()
      }
      const teardown = () => {
        stops.forEach((stop) => stop())
        rest()
      }
      return { rest, resume, settle, teardown }
    }

    // A page that opens still (paused, as a browser may restore the switch on the way back, or
    // with less motion asked for) is marked as arrived, and so is one that turns still later: the
    // hero's arrival (Hero.jsx) never plays, or plays again, when motion starts or resumes.
    let motion = null
    if (still()) html.classList.add('arrived')
    const begin = () => {
      if (!motion && !still()) motion = startMotion()
    }
    begin()
    const onPreference = () => {
      if (!still()) {
        if (motion) motion.resume()
        else begin()
        return
      }
      html.classList.add('arrived')
      motion?.rest()
    }
    const settleForPrint = (query) => {
      if (query.matches) motion?.settle()
    }
    const settleBeforePrint = () => motion?.settle()
    pause?.addEventListener('change', onPreference)
    reduced.addEventListener('change', onPreference)
    printing.addEventListener('change', settleForPrint)
    on(window, 'beforeprint', settleBeforePrint)
    // A call starting or ending counts as a change of preference (it fires only then).
    const call = new MutationObserver(onPreference)
    call.observe(html, { attributes: true, attributeFilter: ['data-call'] })
    observers.push(call)

    return () => {
      observers.forEach((observer) => observer.disconnect())
      listeners.forEach((off) => off())
      pause?.removeEventListener('change', onPreference)
      reduced.removeEventListener('change', onPreference)
      printing.removeEventListener('change', settleForPrint)
      motion?.teardown()
    }
  }, [])

  return null
}
