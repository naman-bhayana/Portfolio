// The particle field: a slow flow of particles under the whole page, bending round the pointer,
// orbiting the avatar and drifting with the scroll. It runs here, in a worker, on the canvas
// MotionIsland hands over, so it can keep drifting for as long as the page is open without
// costing the main thread anything (see MotionIsland.jsx for why that matters).
//
// Messages: init { canvas, W, H, dpr, many }, size { W, H }, pointer { x, y },
// scroll { y, vortex }, run, stop.

const STEP = 1000 / 60 // one physics step, whatever the screen's refresh rate
const nextFrame = self.requestAnimationFrame ? (cb) => self.requestAnimationFrame(cb) : (cb) => setTimeout(() => cb(performance.now()), STEP)
const cancelFrame = self.cancelAnimationFrame ? (handle) => self.cancelAnimationFrame(handle) : (handle) => clearTimeout(handle)

let canvas = null
let ctx = null
let W = 0
let H = 0
let dpr = 1
let many = true
let ps = []
let px = -1e4
let py = -1e4
let t = 0
let y = 0
let lastY = 0
let sv = 0
let vortex = null
let running = false
let handle = 0
let last = 0
let acc = 0

const spawn = (anywhere) => {
  const edge = Math.random()
  return {
    x: anywhere ? Math.random() * W : edge < 0.5 ? Math.random() * W : edge < 0.75 ? -8 : W + 8,
    y: anywhere ? Math.random() * H : edge < 0.5 ? (Math.random() < 0.5 ? -8 : H + 8) : Math.random() * H,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r: 0.7 + Math.random() * 1.5,
    a: 0.22 + Math.random() * 0.5,
    c: Math.random() < 0.72 ? '0,225,255' : '26,140,255',
    life: 300 + Math.random() * 900,
  }
}

// More particles on a large screen, fewer on a phone, never fewer than sixty.
const size = (w, h) => {
  W = w
  H = h
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const n = Math.round(Math.min(many ? 220 : 80, Math.max(60, (W * H) / 15000)))
  ps = Array.from({ length: n }, () => spawn(true))
  ctx.fillStyle = '#05070B'
  ctx.fillRect(0, 0, W, H)
}

// One step of the flow: a field of angles that slowly turns, a pull towards the scroll, a
// swirl round the avatar and a push away from the pointer.
const advance = () => {
  t += 0.0035
  sv += (Math.max(-36, Math.min(36, y - lastY)) - sv) * 0.12
  lastY = y
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]
    const ang = Math.sin(p.x * 0.0021 + t) * 1.4 + Math.cos(p.y * 0.0017 - t * 1.2) * 1.4
    p.vx += Math.cos(ang) * 0.045
    p.vy += Math.sin(ang) * 0.045 - sv * 0.0014
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
    const mx = p.x - px
    const my = p.y - py
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
    if (p.x < -16 || p.x > W + 16 || p.y < -16 || p.y > H + 16 || p.life < 0) ps[i] = spawn(false)
  }
}

// The last frame fades under a dark wash, so each particle leaves a short trail.
const draw = () => {
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = 'rgba(5,7,11,.17)'
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'lighter'
  for (const p of ps) {
    ctx.beginPath()
    ctx.fillStyle = `rgba(${p.c},${p.a})`
    ctx.arc(p.x, p.y, p.r, 0, 6.2832)
    ctx.fill()
  }
}

// Physics in fixed steps, drawing once per frame that moved: the flow keeps the same speed at
// 30, 60 or 120 frames a second.
const frame = (now) => {
  handle = 0
  if (!running) return
  handle = nextFrame(frame)
  acc += last ? Math.min(now - last, 100) : STEP
  last = now
  let steps = 0
  while (acc >= STEP && steps < 4) {
    advance()
    acc -= STEP
    steps++
  }
  if (steps) draw()
}

self.onmessage = ({ data }) => {
  switch (data.type) {
    case 'init':
      canvas = data.canvas
      ctx = canvas.getContext('2d')
      dpr = data.dpr
      many = data.many
      size(data.W, data.H)
      break
    case 'size':
      if (ctx) size(data.W, data.H)
      break
    case 'pointer':
      px = data.x
      py = data.y
      break
    case 'scroll':
      y = data.y
      vortex = data.vortex
      break
    case 'run':
      if (ctx && !running) {
        running = true
        last = 0
        acc = 0
        handle = nextFrame(frame)
      }
      break
    case 'stop':
      running = false
      if (handle) cancelFrame(handle)
      handle = 0
      break
  }
}
