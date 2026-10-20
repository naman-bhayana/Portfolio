// Regenerates every brand asset from the avatar master and the bundled fonts.
// Run from the repo root with `npm run assets`. Output is deterministic and every hard
// constraint (sizes, byte budgets, OG text geometry, icon safe zones) throws when broken.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'
import opentype from 'opentype.js'
import { PERSON, HERO, MANIFEST } from '../../src/content/site.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const at = (p) => path.join(ROOT, p)
const MASTER = at('scripts/assets/src/avatar-master.png')

// The site's tokens (src/styles/base.css).
const COLOR = {
  bg: MANIFEST.color, // #05070B
  text: '#EEF3F8',
  cyan: '#00E1FF',
  blue: '#1A7DFF',
  grid: 'rgba(120,160,210,.05)',
}
const GRADIENT = [
  [0, '#00E5FF'],
  [0.55, '#1A8CFF'],
  [1, '#4F5BFF'],
]

// ---------------------------------------------------------------- fonts

const FONT_FILES = { 400: 'Poppins-Regular.ttf', 600: 'Poppins-SemiBold.ttf', 700: 'Poppins-Bold.ttf' }
const FONT_DATA = Object.fromEntries(
  Object.entries(FONT_FILES).map(([w, f]) => [w, fs.readFileSync(at(`scripts/assets/fonts/${f}`))]),
)
const SATORI_FONTS = Object.entries(FONT_DATA).map(([weight, data]) => ({
  name: 'Poppins',
  data,
  weight: Number(weight),
  style: 'normal',
}))
const parseFont = (buf) => opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const OT_FONTS = Object.fromEntries(Object.entries(FONT_DATA).map(([w, buf]) => [w, parseFont(buf)]))
// The accent face. It is drawn as outlines, so satori never needs it.
const SERIF = parseFont(fs.readFileSync(at('scripts/assets/fonts/InstrumentSerif-Italic.ttf')))

// ---------------------------------------------------------------- helpers

const results = []

function check(ok, message) {
  if (!ok) throw new Error(`Asset constraint failed: ${message}`)
}

async function write(rel, buffer) {
  fs.mkdirSync(path.dirname(at(rel)), { recursive: true })
  fs.writeFileSync(at(rel), buffer)
  let dims = '-'
  if (rel.endsWith('.png')) {
    const { width, height } = await sharp(buffer).metadata()
    dims = `${width}x${height}`
  }
  results.push({ file: rel, dims, bytes: buffer.length })
}

const svgToPng = (svg, width) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } })
    .render()
    .asPng()

const dataUri = (png) => `data:image/png;base64,${png.toString('base64')}`

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))

const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

// ---------------------------------------------------------------- avatar

// Tight box around every pixel with alpha > 8.
async function alphaBox(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  check(x1 >= 0, 'avatar master has no opaque pixels')
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}

// The subject cut to its alpha box, scaled to the given height.
const subjectAt = (box, height) =>
  sharp(MASTER).extract(box).resize({ height }).png().toBuffer({ resolveWithObject: true })

async function buildAvatar(box) {
  const SIZE = 1024
  const { data: subject, info } = await subjectAt(box, SIZE)
  const left = Math.floor((SIZE - info.width) / 2)
  const canvas = sharp(subject).extend({
    left,
    right: SIZE - info.width - left,
    top: 0,
    bottom: SIZE - info.height, // 0: the subject fills the height, bottom edge flush
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  // Truecolour first (sharp's `effort` would force a palette), palette only if too heavy.
  let png = await canvas.clone().png({ compressionLevel: 9 }).toBuffer()
  if (png.length > 400 * 1024) {
    png = await canvas.clone().png({ palette: true, colors: 256, dither: 1.0, effort: 10, compressionLevel: 9 }).toBuffer()
  }
  const meta = await sharp(png).metadata()
  check(meta.width === SIZE && meta.height === SIZE, `avatar is ${meta.width}x${meta.height}, not 1024x1024`)
  check(meta.hasAlpha, 'avatar lost its alpha channel')
  check(png.length <= 400 * 1024, `avatar is ${png.length} bytes, over 400 KB`)
  await write('public/images/naman-bhayana-avatar.png', png)
}

// ---------------------------------------------------------------- OG card

const OG = { width: 1200, height: 630 }
const TEXT_ZONE = { x0: 290, x1: 720 } // inside the centred 630 square crop (x 285-915)
const NAME_ZONE = { x0: 285, x1: 915 }
const SAFE = { x0: 50, x1: 1150, y0: 35, y1: 595 }
const TEXT_LEFT = 292
const AVATAR = { left: 738, height: 540, bleed: 22 } // bleed: px hidden below the bottom edge
const GLOW_FADE = { x0: 740, x1: 860 } // glow is zero left of x0, full right of x1

const [roleA, roleB] = HERO.eyebrow.split(' · ')

// The card reads like the hero: the greeting and the surname in the serif italic with the
// brand gradient, the first name in Poppins, then the two roles and one line of proof. The
// roles break at their ' · ' separator to fit the square-crop zone, at 27 px, the largest
// size that fits. Baselines are relative to the first line; the block is then centred.
const OG_LINES = [
  { text: HERO.greeting, serif: true, size: 46, baseline: 0 },
  { text: PERSON.firstName, weight: 700, size: 88, color: COLOR.text, baseline: 88, name: true },
  { text: PERSON.lastName, serif: true, size: 112, baseline: 184, name: true },
  { text: roleA, weight: 600, size: 27, color: COLOR.text, baseline: 250 },
  { text: roleB, weight: 600, size: 27, color: COLOR.text, baseline: 287 },
  { text: HERO.roles[2], weight: 600, size: 24, color: COLOR.cyan, baseline: 338 },
]

// opentype.js cannot run this font's ccmp lookups, so serif lines are set glyph by glyph with
// pair kerning, which is all a greeting and a surname need.
function serifRun(text, x, baseline, size) {
  const scale = size / SERIF.unitsPerEm
  const glyphs = [...text].map((char) => SERIF.charToGlyph(char))
  const path = new opentype.Path()
  let pen = x
  glyphs.forEach((glyph, i) => {
    check(glyph.index > 0, `the serif face has no glyph for "${[...text][i]}"`)
    path.extend(glyph.getPath(pen, baseline, size))
    pen += glyph.advanceWidth * scale
    if (glyphs[i + 1]) pen += SERIF.getKerningValue(glyph, glyphs[i + 1]) * scale
  })
  return { advance: pen - x, path }
}

// Line geometry from opentype.js (kerned advances and ink bounds), before anything renders.
function layoutOgText() {
  const lines = OG_LINES.map((line) => {
    if (line.serif) {
      // An italic capital leans out to the left of its origin: start the line so that its
      // ink, not its origin, sits on the text edge.
      const lean = TEXT_LEFT - serifRun(line.text, TEXT_LEFT, line.baseline, line.size).path.getBoundingBox().x1
      const { advance, path } = serifRun(line.text, TEXT_LEFT + lean + 2, line.baseline, line.size)
      return { ...line, advance: advance + lean + 2, ink: path.getBoundingBox(), outline: path.toPathData(2) }
    }
    const font = OT_FONTS[line.weight]
    const advance = font.getAdvanceWidth(line.text, line.size, { kerning: true })
    const ink = font.getPath(line.text, TEXT_LEFT, line.baseline, line.size, { kerning: true }).getBoundingBox()
    return { ...line, font, advance, ink }
  })
  // Centre the ink block slightly above the card's middle.
  const top = Math.min(...lines.map((l) => l.ink.y1))
  const bottom = Math.max(...lines.map((l) => l.ink.y2))
  const shift = Math.round(OG.height / 2 - 8 - (top + bottom) / 2)
  return lines.map((l) => {
    const baseline = l.baseline + shift
    const box = {
      x0: Math.min(TEXT_LEFT, l.ink.x1),
      x1: Math.max(TEXT_LEFT + l.advance, l.ink.x2),
      y0: l.ink.y1 + shift,
      y1: l.ink.y2 + shift,
    }
    return { ...l, baseline, box, shift }
  })
}

// The serif lines as outlines, each filled with the brand gradient across its own width
// (100deg, as --grad in base.css: left to right, tipped ten degrees down).
function gradientTextSvg(lines) {
  const serif = lines.filter((l) => l.serif)
  const tilt = Math.tan((10 * Math.PI) / 180)
  const defs = serif.map(
    (l, i) =>
      `<linearGradient id="g${i}" gradientUnits="userSpaceOnUse" x1="${l.box.x0.toFixed(1)}" y1="${l.box.y0.toFixed(1)}" ` +
      `x2="${l.box.x1.toFixed(1)}" y2="${(l.box.y0 + (l.box.x1 - l.box.x0) * tilt).toFixed(1)}">` +
      `${GRADIENT.map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`).join('')}</linearGradient>`,
  )
  const paths = serif.map((l, i) => `<path fill="url(#g${i})" transform="translate(0 ${l.shift})" d="${l.outline}"/>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${OG.width} ${OG.height}"><defs>${defs.join('')}</defs>${paths.join('')}</svg>`
}

// The page's ground: the 72 px grid, and the hero's blue light in the top right corner.
function groundSvg() {
  const lines = []
  for (let x = 72; x < OG.width; x += 72) lines.push(`M${x} 0V${OG.height}`)
  for (let y = 72; y < OG.height; y += 72) lines.push(`M0 ${y}H${OG.width}`)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${OG.width} ${OG.height}">` +
    `<defs><radialGradient id="r" gradientUnits="userSpaceOnUse" cx="1010" cy="40" r="560" gradientTransform="translate(1010 40) scale(1 .62) translate(-1010 -40)">` +
    `<stop offset="0" stop-color="#008CFF" stop-opacity=".2"/><stop offset=".7" stop-color="#008CFF" stop-opacity="0"/></radialGradient></defs>` +
    `<path fill="url(#r)" d="M0 0H${OG.width}V${OG.height}H0Z"/><path fill="none" stroke="${COLOR.grid}" stroke-width="1" d="${lines.join('')}"/></svg>`
  )
}

function checkOgGeometry(lines, avatarBox) {
  for (const { text, box, name } of lines) {
    const where = `"${text}" spans x ${box.x0.toFixed(1)}-${box.x1.toFixed(1)}, y ${box.y0.toFixed(1)}-${box.y1.toFixed(1)}`
    check(box.x0 >= TEXT_ZONE.x0 && box.x1 <= TEXT_ZONE.x1, `${where}; text must stay within x ${TEXT_ZONE.x0}-${TEXT_ZONE.x1}`)
    check(
      box.x0 >= SAFE.x0 && box.x1 <= SAFE.x1 && box.y0 >= SAFE.y0 && box.y1 <= SAFE.y1,
      `${where}; outside the safe area x ${SAFE.x0}-${SAFE.x1}, y ${SAFE.y0}-${SAFE.y1}`,
    )
    if (name) check(box.x0 >= NAME_ZONE.x0 && box.x1 <= NAME_ZONE.x1, `${where}; the name must stay within x ${NAME_ZONE.x0}-${NAME_ZONE.x1}`)
    check(!overlaps(box, avatarBox), `${where}; overlaps the avatar box x ${avatarBox.x0}-${avatarBox.x1}, y ${avatarBox.y0}-${avatarBox.y1}`)
  }
}

// Cyan-to-blue halo that follows the avatar silhouette, faded to nothing towards the text.
async function buildGlow(alphaCanvas, avatarBox) {
  const blur = async (sigma) => (await sharp(alphaCanvas, { raw: { ...OG, channels: 1 } }).blur(sigma).toColourspace('b-w').raw().toBuffer())
  const [rim, haze] = await Promise.all([blur(24), blur(60)])
  const [c0, c1] = [hex(COLOR.cyan), hex(COLOR.blue)]
  const out = Buffer.alloc(OG.width * OG.height * 4)
  const span = avatarBox.x1 - avatarBox.x0 + (avatarBox.y1 - avatarBox.y0)
  for (let y = 0; y < OG.height; y++) {
    for (let x = 0; x < OG.width; x++) {
      const i = y * OG.width + x
      const fade = Math.min(1, Math.max(0, (x - GLOW_FADE.x0) / (GLOW_FADE.x1 - GLOW_FADE.x0)))
      const t = Math.min(1, Math.max(0, (x - avatarBox.x0 + y - avatarBox.y0) / span)) // cyan top-left, blue bottom-right
      for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(c0[c] + (c1[c] - c0[c]) * t)
      out[i * 4 + 3] = Math.round(Math.min(255, rim[i] * 0.3 + haze[i] * 0.42) * fade)
    }
  }
  return { raw: out, png: await sharp(out, { raw: { ...OG, channels: 4 } }).png().toBuffer() }
}

function checkGlowClear(glowRaw, lines) {
  for (const { text, box } of lines) {
    for (let y = Math.floor(box.y0); y < Math.ceil(box.y1); y++) {
      for (let x = Math.floor(box.x0); x < Math.ceil(box.x1); x++) {
        check(glowRaw[(y * OG.width + x) * 4 + 3] === 0, `glow reaches behind "${text}" at ${x},${y}`)
      }
    }
  }
}

async function buildOgCard(box) {
  // Avatar: scaled subject, cropped where it leaves the bottom (and laptop corner the right) edge.
  const { data: subject, info } = await subjectAt(box, AVATAR.height)
  const top = OG.height + AVATAR.bleed - info.height
  const width = Math.min(info.width, OG.width - AVATAR.left)
  const height = OG.height - top
  const visible = await sharp(subject).extract({ left: 0, top: 0, width, height }).toBuffer()
  const avatarBox = { x0: AVATAR.left, x1: AVATAR.left + width, y0: top, y1: OG.height }

  const lines = layoutOgText()
  checkOgGeometry(lines, avatarBox)

  // Two steps: sharp always runs composite last, after any extractChannel in the same pipeline.
  const placed = await sharp({ create: { ...OG, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: visible, left: AVATAR.left, top }])
    .png()
    .toBuffer()
  const alphaCanvas = await sharp(placed).extractChannel('alpha').raw().toBuffer()
  const glow = await buildGlow(alphaCanvas, avatarBox)
  checkGlowClear(glow.raw, lines)

  // Each Poppins line is placed so its baseline lands where opentype.js measured it: with
  // lineHeight 1 the font's ascender/descender box is centred on the line box.
  const textNodes = lines.filter((l) => !l.serif).map((l) => {
    const { ascender, descender, unitsPerEm } = l.font
    const baselineOffset = ((1 - (ascender - descender) / unitsPerEm) / 2 + ascender / unitsPerEm) * l.size
    return {
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          left: TEXT_LEFT,
          top: l.baseline - baselineOffset,
          fontSize: l.size,
          fontWeight: l.weight,
          lineHeight: 1,
          color: l.color,
          whiteSpace: 'nowrap',
        },
        children: l.text,
      },
    }
  })
  const image = (src, left, top, width, height) => ({
    type: 'img',
    props: { src, width, height, style: { position: 'absolute', left, top } },
  })
  const tree = {
    type: 'div',
    props: {
      style: { display: 'flex', position: 'relative', width: OG.width, height: OG.height, backgroundColor: COLOR.bg, fontFamily: 'Poppins' },
      children: [
        image(dataUri(svgToPng(groundSvg(), OG.width)), 0, 0, OG.width, OG.height),
        image(dataUri(glow.png), 0, 0, OG.width, OG.height),
        image(dataUri(visible), AVATAR.left, top, width, height),
        image(dataUri(svgToPng(gradientTextSvg(lines), OG.width)), 0, 0, OG.width, OG.height),
        ...textNodes,
      ],
    },
  }
  const svg = await satori(tree, { ...OG, fonts: SATORI_FONTS })
  const rendered = svgToPng(svg, OG.width)

  // 256 colours lands near 90 KB. sharp only honours 256/16/4/2 palette sizes, so if this ever
  // grows past budget, soften the glow rather than dropping to 16 colours.
  const png = await sharp(rendered).png({ palette: true, colors: 256, dither: 1.0, effort: 10, compressionLevel: 9 }).toBuffer()
  const meta = await sharp(png).metadata()
  check(meta.format === 'png' && meta.width === OG.width && meta.height === OG.height, `OG card is ${meta.width}x${meta.height}`)
  check(png.length <= 300 * 1024, `OG card is ${png.length} bytes, over 300 KB`)
  await write('public/og/naman-bhayana-og.png', png)
}

// ---------------------------------------------------------------- icons

// "NB" outlines from satori, scaled into icon space by hand so the monogram is centred
// on its ink box (satori would centre the font's line box, which sits the caps low).
async function monogramOutline(weight) {
  const size = 400
  const svg = await satori(
    { type: 'div', props: { style: { display: 'flex', fontFamily: 'Poppins', fontSize: size, fontWeight: weight, color: COLOR.text }, children: 'NB' } },
    { width: size * 2, height: size * 2, fonts: SATORI_FONTS },
  )
  const d = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]).join('')
  check(d.length > 0, 'satori produced no monogram outline')
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number)
  const xs = nums.filter((_, i) => i % 2 === 0)
  const ys = nums.filter((_, i) => i % 2 === 1)
  return { d, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

const roundedRect = (x, y, w, h, r) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
  `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`

// One icon on a 512 grid. width: monogram ink width as a share of the side; radius: corner
// radius share (0 for opaque full-bleed squares); accent: thin gradient rule under the glyphs.
function iconSvg(glyph, { width, radius, accent }) {
  const S = 512
  const scale = (width * S) / (glyph.x1 - glyph.x0)
  const gw = (glyph.x1 - glyph.x0) * scale
  const gh = (glyph.y1 - glyph.y0) * scale
  const rule = accent ? { h: S * 0.035, gap: S * 0.06 } : null
  const blockH = gh + (rule ? rule.gap + rule.h : 0)
  const gx = (S - gw) / 2
  const gy = (S - blockH) / 2
  const r = (n) => Math.round(n * 100) / 100
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">`,
    rule
      ? `<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${COLOR.cyan}"/><stop offset="1" stop-color="${COLOR.blue}"/></linearGradient></defs>`
      : '',
    `<path fill="${COLOR.bg}" d="${radius ? roundedRect(0, 0, S, S, r(S * radius)) : `M0 0H${S}V${S}H0Z`}"/>`,
    `<path fill="${COLOR.text}" transform="translate(${r(gx - glyph.x0 * scale)} ${r(gy - glyph.y0 * scale)}) scale(${Number(scale.toFixed(6))})" d="${glyph.d}"/>`,
    rule ? `<path fill="url(#a)" d="${roundedRect(r(gx), r(gy + gh + rule.gap), r(gw), r(rule.h), r(rule.h / 2))}"/>` : '',
    '</svg>',
  ]
  return { svg: parts.join(''), box: { x0: gx, x1: gx + gw, y0: gy, y1: gy + blockH } }
}

async function opaque(png) {
  return (await sharp(png).stats()).isOpaque
}

async function buildIcons() {
  const semibold = await monogramOutline(600)
  const bold = await monogramOutline(700)

  const app = iconSvg(semibold, { width: 0.7, radius: 0.22, accent: true })
  check(!/<text/.test(app.svg), 'icon.svg must not contain <text>')
  await write('src/app/icon.svg', Buffer.from(app.svg))

  const apple = svgToPng(iconSvg(semibold, { width: 0.56, radius: 0, accent: true }).svg, 180)
  check(await opaque(apple), 'apple-icon.png must be fully opaque')
  await write('src/app/apple-icon.png', apple)

  // Maskable: the monogram's ink box must fit the centred circle of radius 0.4 x size.
  const maskable = iconSvg(semibold, { width: 0.5, radius: 0, accent: true })
  const { x0, x1, y0, y1 } = maskable.box
  const reach = Math.max(...[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => Math.hypot(x - 256, y - 256)))
  check(reach <= 0.4 * 512, `maskable monogram reaches ${(reach / 512).toFixed(3)} x size from the centre, over 0.4`)
  for (const size of [192, 512]) {
    const png = svgToPng(maskable.svg, size)
    check(await opaque(png), `icon-${size}.png must be fully opaque`)
    await write(`public/icons/icon-${size}.png`, png)
  }

  // favicon.ico: heavier glyph and no rule at 16 px, where a hairline only smudges.
  // 48 px goes first: Next.js reads the link's `sizes` from the first frame, and Google
  // prefers favicons in multiples of 48 px.
  const frames = [
    svgToPng(app.svg, 48),
    svgToPng(iconSvg(semibold, { width: 0.7, radius: 0.2, accent: false }).svg, 32),
    svgToPng(iconSvg(bold, { width: 0.84, radius: 0.18, accent: false }).svg, 16),
  ]
  const ico = await pngToIco(frames)
  check(ico.readUInt16LE(4) === 3, 'favicon.ico must hold three frames')
  check([0, 1, 2].every((i) => ico[6 + i * 16] === [48, 32, 16][i]), 'favicon.ico frames must be 48, 32 and 16 px')
  await write('src/app/favicon.ico', ico)
}

// ---------------------------------------------------------------- run

const box = await alphaBox(MASTER)
await buildAvatar(box)
await buildOgCard(box)
await buildIcons()

const pad = (s, n) => String(s).padEnd(n)
console.log(`\n${pad('file', 42)}${pad('dimensions', 12)}bytes`)
for (const r of results) console.log(`${pad(r.file, 42)}${pad(r.dims, 12)}${r.bytes}`)
