import { Instrument_Serif, JetBrains_Mono, Poppins } from 'next/font/google'

// Self-hosted by next/font; each face becomes a CSS variable that base.css reads.
// The first screen is set in Poppins 400, 600 and 700 and the serif, so those are preloaded.
const poppins = Poppins({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
})

// Poppins 800 only sets the big figures further down the page. It joins the same family
// without a preload, so it is not fetched ahead of the avatar.
const poppinsHeavy = Poppins({
  weight: '800',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-poppins-heavy',
})

const serif = Instrument_Serif({
  weight: '400',
  style: 'italic',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
})

// Labels and the typed role line. The role line starts typing after 1.5 s, so no preload.
// No metric-matched fallback either: that would be Arial, and the role line types one
// character per step, so until the font arrives it needs the system monospace from base.css.
const mono = JetBrains_Mono({
  weight: '500',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  variable: '--font-mono',
})

export const fontVariables = `${poppins.variable} ${poppinsHeavy.variable} ${serif.variable} ${mono.variable}`
