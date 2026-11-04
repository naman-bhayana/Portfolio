// The orb of the voice view, drawn on one canvas. Panel.jsx runs its frame loop only while a
// voice session is connected and motion runs; otherwise it is drawn once, at rest.
// `level` is 0 to 1; `mode` is 'speaking' (the agent), 'hearing' (the visitor) or 'idle'.

const BARS = [0.4, 0.9, 0.62, 0.32] // the launcher's four bars, at rest

// The level an orb eases towards, from the conversation's audio (each 0 to 1, mean of the voice
// band, so speech sits around 0.1 to 0.4).
export function orbTarget(mode, output, input, time) {
  if (mode === 'speaking') return 0.35 + 0.6 * Math.min(1, output * 2.4)
  if (mode === 'hearing') return 0.25 + 0.5 * Math.min(1, input * 2.6)
  return 0.1 + 0.04 * Math.sin(time * 1.6)
}

export function drawOrb(ctx, W, time, level, mode) {
  const c = W / 2
  const base = W * 0.3
  const L = level
  ctx.clearRect(0, 0, W, W)

  const glow = ctx.createRadialGradient(c, c, base * 0.2, c, c, base * 1.9)
  glow.addColorStop(0, `rgba(0, 190, 255, ${0.1 + L * 0.3})`)
  glow.addColorStop(1, 'rgba(0, 190, 255, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(c, c, base * 1.9, 0, Math.PI * 2)
  ctx.fill()

  const R = base * (1 + L * 0.1)
  const disc = ctx.createRadialGradient(c, c - base * 0.3, base * 0.1, c, c, R)
  disc.addColorStop(0, '#0E2C48')
  disc.addColorStop(1, '#05070B')
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(c, c, R, 0, Math.PI * 2)
  ctx.fill()

  if (mode === 'hearing') {
    ctx.fillStyle = `rgba(0, 225, 255, ${0.06 + L * 0.22})`
    ctx.beginPath()
    ctx.arc(c, c, base * (0.35 + L * 0.5), 0, Math.PI * 2)
    ctx.fill()
  }

  const edge = ctx.createLinearGradient(c - base, c - base, c + base, c + base)
  edge.addColorStop(0, '#00E5FF')
  edge.addColorStop(0.55, '#1A8CFF')
  edge.addColorStop(1, '#4F5BFF')
  ctx.strokeStyle = edge
  ctx.lineWidth = W * 0.012
  ctx.beginPath()
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2
    const wob = L * W * 0.022 * Math.sin(a * 6 + time * 4.2) * Math.sin(a * 3 - time * 2.6)
    const x = c + Math.cos(a) * (R + wob)
    const y = c + Math.sin(a) * (R + wob)
    if (i) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()

  if (mode === 'speaking') {
    for (let k = 0; k < 2; k++) {
      const p = (time * 0.8 + k * 0.5) % 1
      ctx.strokeStyle = `rgba(0, 225, 255, ${(1 - p) * 0.28 * L})`
      ctx.lineWidth = W * 0.006
      ctx.beginPath()
      ctx.arc(c, c, base * (1.08 + p * 0.6), 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // The launcher's four bars sit in the middle, so the orb and the launcher read as one object.
  const bw = W * 0.022
  const gap = W * 0.018
  const total = BARS.length * bw + (BARS.length - 1) * gap
  BARS.forEach((rest, i) => {
    const lift = mode === 'speaking' ? 0.55 + 0.45 * Math.abs(Math.sin(time * (6 + i * 1.7) + i)) : rest
    const bh = W * 0.12 * lift
    const x = c - total / 2 + i * (bw + gap)
    const g = ctx.createLinearGradient(x, c - bh / 2, x, c + bh / 2)
    g.addColorStop(0, '#00E5FF')
    g.addColorStop(1, '#2D9BFF')
    ctx.fillStyle = g
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(x, c - bh / 2, bw, bh, bw / 2)
    else ctx.rect(x, c - bh / 2, bw, bh)
    ctx.fill()
  })
}

// The orb at rest: reduced motion, the pause switch, or no session yet.
export const drawStill = (ctx, W) => drawOrb(ctx, W, 0, 0.18, 'idle')
