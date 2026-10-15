'use client'

import { useEffect } from 'react'

const SCRAMBLE_MS = 400 // a figure shows random digits for this long before it counts
const COUNT_MS = 1200
const BLANK = ' ' // holds an empty digit slot open
const ASSEMBLE_MS = 1500 // one dot's flight into the grid
// The particle field sleeps after this long without input, and wakes on the next scroll, touch,
// key or pointer move. A frame loop that never rests keeps the main thread updating every CSS
// loop on the page each frame, on top of its own drawing: a page at rest must not do that.
const FIELD_IDLE_MS = 8000
const DPR_CAP = 1.5

// The motion that needs a script, on top of the CSS. The page is complete without any of it:
// 1. the proof figures scramble, then count up (the server HTML already holds the final values);
// 2. the blocks below the fold arrive as the reader reaches them (html.rv-on, .rv-wait, .rv-in);
// 3. the 400 dots of the proof stage fly in on a canvas before the real grid shows;
// 4. a particle field drifts under the page, bending round the pointer and the avatar;
// 5. the avatar stage and the plates tilt towards the pointer, which also carries a light;
// 6. the loops are started again once the web fonts are in, so none runs on stale sizes;
// 7. the nav shows the section on screen, and the rail's pulse learns the rail's width.
// None of it runs when the visitor has asked for less motion or has paused it, and the field
// and the tilt stop on their own once the visitor rests, so the main thread does too.
export default function MotionIsland() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const html = document.documentElement
    const pause = document.getElementById('pause-motion')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const printing = window.matchMedia('print')
    const hover = window.matchMedia('(hover: hover)').matches
    const still = () => reduced.matches || pause?.checked
    if (still()) return

    // Chrome hands a loop to the compositor with its percentages already worked out in pixels,
    // and keeps those pixels if the box changes size while the loop is still being started. A
    // web font landing just after the first paint is enough: the typed role's caret then sits
    // a few pixels off its text for good. Once the fonts have settled, every loop is moved on
    // by a millisecond, which makes the browser hand it over again with today's sizes.
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

    const belowFold = (el) => el.getBoundingClientRect().top > window.innerHeight
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

    // ---------------------------------------------------------------- figures
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
          if (progress === 1) return finish(el)
          show(el, Math.round(target * (1 - 2 ** (-10 * progress))))
        }
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
    on(window, 'scroll', start, { once: true, passive: true })
    const settle = () => [...counting.keys()].forEach(finish)

    // ---------------------------------------------------------------- the dots
    // The 400 dots fly in from across the stage and settle into their grid, on one canvas,
    // once. The grid's place is read from its offsets, which the arrival's transform does not
    // move; they are summed up the offsetParent chain, because a block in the middle of that
    // arrival is itself transformed, and a transformed box counts as an offsetParent.
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
        setTimeout(() => canvas.remove(), 260)
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

    // ---------------------------------------------------------------- arrivals
    // A block below the fold waits (.rv-wait) and plays in when it comes into view (.rv-in).
    // Once every one-shot animation inside it has played, the block lets go of the class, so
    // nothing stays on a moving layer. A block that takes keyboard focus first is shown at once.
    html.classList.add('rv-on')
    // Headline words, so each can arrive on its own.
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
        if (node.nodeType !== Node.TEXT_NODE) return [word(node)]
        return node.textContent.split(/(\s+)/).flatMap((part) => (!part ? [] : /^\s+$/.test(part) ? [' '] : [word(document.createTextNode(part))]))
      })
      el.replaceChildren(...parts)
      el.classList.add('split')
    }
    const released = (event) => {
      const block = event.currentTarget
      const live = block.getAnimations({ subtree: true }).some((a) => a.timeline === document.timeline && a.playState !== 'finished')
      if (!live) block.classList.remove('rv-in')
    }
    const reveal = (block) => {
      if (!block.classList.replace('rv-wait', 'rv-in')) return
      for (const type of ['animationend', 'animationcancel', 'transitionend']) block.addEventListener(type, released)
      if (block.classList.contains('pstage')) assemble(block)
    }
    const arriving = onEnter({ rootMargin: '0px 0px -10% 0px', threshold: 0.12 }, (blocks) => blocks.forEach(reveal))
    for (const block of [...document.querySelectorAll('[data-rv]')].filter(belowFold)) {
      block.querySelectorAll(':scope > .h2, :scope > .h2b, :scope > .h2c').forEach(splitWords)
      block.classList.add('rv-wait')
      arriving.observe(block)
    }
    const revealFocused = (event) => {
      const block = event.target.closest?.('.rv-wait')
      if (!block) return
      arriving.unobserve(block)
      block.classList.remove('rv-wait')
    }
    on(document, 'focusin', revealFocused)

    // ---------------------------------------------------------------- the field
    // Particles on a slow flow, bending round the pointer, orbiting the avatar and drifting
    // with the scroll. It draws on its own canvas and touches no style or layout. On a phone
    // it runs lighter and at half rate; everywhere it sleeps once the visitor has rested.
    const field = document.querySelector('canvas.field')
    const stage = document.querySelector('.hero .stage')
    const F = { W: 0, H: 0, ps: [], n: 0, px: -1e4, py: -1e4, t: 0, y: 0, lastY: 0, sv: 0, vortex: null, raf: 0, last: 0, idle: performance.now(), ctx: null }
    const FRAME_MS = hover ? 0 : 1000 / 30
    // Where the page is and where the avatar stands: read when the page scrolls or resizes,
    // never in a frame. Read every frame, either would force a style pass on a page at rest.
    const locate = () => {
      F.y = window.scrollY
      if (!stage) return
      const r = stage.getBoundingClientRect()
      F.vortex = r.bottom > 0 && r.top < F.H ? { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width * 0.95 } : null
    }
    const spawn = (anywhere) => {
      const edge = Math.random()
      return {
        x: anywhere ? Math.random() * F.W : edge < 0.5 ? Math.random() * F.W : edge < 0.75 ? -8 : F.W + 8,
        y: anywhere ? Math.random() * F.H : edge < 0.5 ? (Math.random() < 0.5 ? -8 : F.H + 8) : Math.random() * F.H,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 0.7 + Math.random() * 1.5,
        a: 0.22 + Math.random() * 0.5,
        c: Math.random() < 0.72 ? '0,225,255' : '26,140,255',
        life: 300 + Math.random() * 900,
      }
    }
    const sizeField = () => {
      const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1)
      F.W = window.innerWidth
      F.H = window.innerHeight
      field.width = F.W * dpr
      field.height = F.H * dpr
      F.ctx = field.getContext('2d')
      F.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      F.n = Math.round(Math.min(hover ? 220 : 80, Math.max(60, (F.W * F.H) / 15000)))
      F.ps = Array.from({ length: F.n }, () => spawn(true))
      F.ctx.fillStyle = '#05070B'
      F.ctx.fillRect(0, 0, F.W, F.H)
      locate()
      F.lastY = F.y
    }
    const step = (now) => {
      F.raf = 0
      if (still() || document.hidden || now - F.idle > FIELD_IDLE_MS) return
      F.raf = requestAnimationFrame(step)
      if (now - F.last < FRAME_MS) return
      F.last = now
      const { ctx, W, H } = F
      F.t += 0.0035
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(5,7,11,.17)'
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      F.sv += (Math.max(-36, Math.min(36, F.y - F.lastY)) - F.sv) * 0.12
      F.lastY = F.y
      const { vortex } = F
      for (let i = 0; i < F.n; i++) {
        const p = F.ps[i]
        const ang = Math.sin(p.x * 0.0021 + F.t) * 1.4 + Math.cos(p.y * 0.0017 - F.t * 1.2) * 1.4
        p.vx += Math.cos(ang) * 0.045
        p.vy += Math.sin(ang) * 0.045 - F.sv * 0.0014
        if (vortex) {
          const dx = p.x - vortex.x
          const dy = p.y - vortex.y
          const d = Math.hypot(dx, dy) || 1
          if (d < vortex.R && d > 40) {
            const f = (1 - d / vortex.R) * 0.22
            p.vx += (-dy / d) * f - (dx / d) * f * 0.25
            p.vy += (dx / d) * f - (dy / d) * f * 0.25
          }
        }
        const mx = p.x - F.px
        const my = p.y - F.py
        const m2 = mx * mx + my * my
        if (m2 < 36100) {
          const md = Math.sqrt(m2) || 1
          const mf = ((190 - md) / 190) * 0.75
          p.vx += (mx / md) * mf
          p.vy += (my / md) * mf
        }
        p.vx *= 0.955
        p.vy *= 0.955
        p.x += p.vx
        p.y += p.vy
        p.life--
        if (p.x < -16 || p.x > W + 16 || p.y < -16 || p.y > H + 16 || p.life < 0) {
          F.ps[i] = spawn(false)
          continue
        }
        ctx.beginPath()
        ctx.fillStyle = `rgba(${p.c},${p.a})`
        ctx.arc(p.x, p.y, p.r, 0, 6.2832)
        ctx.fill()
      }
    }
    const wake = () => {
      F.idle = performance.now()
      if (field && !F.raf && !still() && !document.hidden) F.raf = requestAnimationFrame(step)
    }
    if (field) {
      sizeField()
      wake()
      // A phone's address bar changes the height on every scroll; only a real change resizes.
      on(window, 'resize', () => {
        if (window.innerWidth !== F.W || Math.abs(window.innerHeight - F.H) > 160) sizeField()
        wake()
      }, { passive: true })
      on(document, 'visibilitychange', wake)
      on(document, 'pointermove', (e) => {
        F.px = e.clientX
        F.py = e.clientY
        wake()
      }, { passive: true })
      on(document, 'pointerleave', () => {
        F.px = -1e4
        F.py = -1e4
      })
      on(window, 'scroll', () => {
        locate()
        wake()
      }, { passive: true })
      for (const type of ['touchstart', 'keydown']) on(window, type, wake, { passive: true })
    }

    // ---------------------------------------------------------------- tilt and the light
    // Targets are set by events; a loop eases towards them and stops once everything rests.
    const tilts = []
    let tiltRaf = 0
    if (hover) {
      const cursor = document.querySelector('.cursor')
      cursor?.classList.add('on')
      let cx = window.innerWidth / 2
      let cy = window.innerHeight / 2
      let tx = cx
      let ty = cy
      let lastCursor = ''
      const loop = () => {
        tiltRaf = 0
        if (still()) return
        let moving = false
        for (const o of tilts) {
          o.rx += (o.tx - o.rx) * 0.11
          o.ry += (o.ty - o.ry) * 0.11
          const ang = Math.hypot(o.rx, o.ry)
          const value = ang < 0.03 ? '' : `${(o.rx / ang).toFixed(3)} ${(o.ry / ang).toFixed(3)} 0 ${ang.toFixed(2)}deg`
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
          const value = `translate(${(cx - 320).toFixed(1)}px,${(cy - 320).toFixed(1)}px)`
          if (value !== lastCursor) {
            cursor.style.transform = value
            lastCursor = value
            moving = true
          }
        }
        if (moving) tiltRaf = requestAnimationFrame(loop)
      }
      const run = () => {
        if (!tiltRaf && !still()) tiltRaf = requestAnimationFrame(loop)
      }
      for (const el of document.querySelectorAll('.tilt')) {
        const o = { el, rx: 0, ry: 0, tx: 0, ty: 0, max: parseFloat(el.dataset.tilt) || 4, last: '' }
        tilts.push(o)
        on(el, 'pointermove', (e) => {
          const r = el.getBoundingClientRect()
          o.tx = ((e.clientY - r.top) / r.height - 0.5) * -2 * o.max
          o.ty = ((e.clientX - r.left) / r.width - 0.5) * 2 * o.max
          run()
        }, { passive: true })
        on(el, 'pointerleave', () => {
          o.tx = 0
          o.ty = 0
          run()
        })
      }
      on(document, 'pointermove', (e) => {
        tx = e.clientX
        ty = e.clientY
        run()
      }, { passive: true })
    }

    // ---------------------------------------------------------------- the rail's pulse
    const railwrap = document.querySelector('.railwrap')
    const rail = railwrap?.querySelector('.rail')
    if (rail) {
      const setRail = () => railwrap.style.setProperty('--railw', `${rail.clientWidth - 140}px`)
      setRail()
      on(window, 'resize', setRail, { passive: true })
    }

    // ---------------------------------------------------------------- far scroll-driven parts
    // A scroll-driven animation whose subject is several screens away is serviced by Chrome
    // on the main thread, every frame, and every other loop's timing is updated with it. So
    // the lights, the brand card, the portrait and the cases are paused while they are more
    // than a screen and a half from the viewport (motion.css), and resumed on the way back.
    const far = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entry.target.classList.toggle('far', !entry.isIntersecting)
      },
      { rootMargin: '150% 0px 150% 0px' },
    )
    observers.push(far)
    for (const el of document.querySelectorAll('.light, .para-soft, .para-img, .case')) far.observe(el)

    // ---------------------------------------------------------------- the nav
    const hero = document.querySelector('.hero')
    const pairs = [...document.querySelectorAll('.nav .links a')].flatMap((a) => {
      const section = document.getElementById(a.getAttribute('href')?.split('#')[1] ?? '')
      return section ? [[section, a]] : []
    })
    const current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          for (const [section, a] of pairs) {
            if (section === entry.target) a.setAttribute('aria-current', 'location')
            else a.removeAttribute('aria-current')
          }
        }
      },
      { rootMargin: '-35% 0px -55% 0px' },
    )
    observers.push(current)
    pairs.forEach(([section]) => current.observe(section))
    if (hero) current.observe(hero)

    // ---------------------------------------------------------------- stopping
    // Pausing or asking the system for less motion shows the finished page at once: figures on
    // their values, nothing waiting below the fold, the field and the tilt at rest. Pausing
    // also marks the page as arrived, so that resuming the motion does not play the hero's
    // arrival a second time (see Hero.jsx). Printing puts the figures on their values.
    const rest = () => {
      settle()
      html.classList.remove('rv-on')
      for (const el of document.querySelectorAll('.rv-wait, .rv-in')) el.classList.remove('rv-wait', 'rv-in')
      if (assembling) {
        cancelAnimationFrame(assembling.raf)
        assembling.done()
      }
      cancelAnimationFrame(F.raf)
      F.raf = 0
      cancelAnimationFrame(tiltRaf)
      tiltRaf = 0
      for (const o of tilts) {
        o.el.style.rotate = ''
        o.rx = o.ry = o.tx = o.ty = 0
        o.last = ''
      }
    }
    const settleIfStill = () => {
      if (!still()) return wake()
      if (pause?.checked) html.classList.add('arrived')
      rest()
    }
    const settleForPrint = (query) => {
      if (query.matches) settle()
    }
    pause?.addEventListener('change', settleIfStill)
    reduced.addEventListener('change', settleIfStill)
    printing.addEventListener('change', settleForPrint)
    on(window, 'beforeprint', settle)

    return () => {
      observers.forEach((observer) => observer.disconnect())
      listeners.forEach((off) => off())
      document.fonts?.removeEventListener('loadingdone', resyncSoon)
      clearTimeout(fontsSettled)
      pause?.removeEventListener('change', settleIfStill)
      reduced.removeEventListener('change', settleIfStill)
      printing.removeEventListener('change', settleForPrint)
      rest()
    }
  }, [])

  return null
}
