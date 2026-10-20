import { CONCIERGE, HEAD, MOTION, PERSON, SITE_URL, SKIP_LINK } from '@/content/site'
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import { fontVariables } from './fonts'
// Order matters: responsive.css overrides the section files, and motion.css comes last. The
// imports above load first; the requires below follow them in the order written, so the
// concierge's styles, when they are in the build at all, sit between the sections and the
// overrides.
import '@/styles/base.css'
import '@/styles/chrome.css'
import '@/styles/hero.css'
import '@/styles/wall.css'
import '@/styles/proof.css'
import '@/styles/work.css'
import '@/styles/infra.css'
import '@/styles/studio.css'
import '@/styles/about.css'
import '@/styles/contact.css'

// The concierge, only in a build made with NEXT_PUBLIC_CONCIERGE=on. next.config.js always
// defines the flag ('on' or 'off'), so the bundler settles each condition and a build without
// the concierge carries none of its code or styles. The condition is written out each time:
// the bundler settles the expression, not a variable holding it.
if (process.env.NEXT_PUBLIC_CONCIERGE === 'on') require('@/styles/concierge.css')
require('@/styles/responsive.css')
require('@/styles/motion.css')
const Concierge = process.env.NEXT_PUBLIC_CONCIERGE === 'on' ? require('./components/Concierge').default : null

// Site-wide fields only. The canonical URL, robots, Open Graph, Twitter and JSON-LD belong to
// the page that they describe (src/app/page.js), so other routes such as the 404 never
// inherit them.
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: HEAD.title,
  description: HEAD.description,
  authors: [{ name: PERSON.name, url: SITE_URL }],
}

export const viewport = {
  themeColor: '#05070B',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <a href="#main" className="skip-link">
          {SKIP_LINK}
        </a>
        {/* Pause switch (WCAG 2.2.2). A real checkbox, so it works without JavaScript; it sits
            before .nb because motion.css reaches the page through a sibling selector. */}
        <input id="pause-motion" className="sr" type="checkbox" role="switch" aria-label={MOTION.pause} />
        <div className="nb">
          {/* The ground under every section: a particle field MotionIsland draws, two slow
              lights, a film grain and the reading-progress line. All decoration, all fixed,
              and all outside <main>, so nothing that reads the page meets them. */}
          <canvas className="field" aria-hidden="true" />
          <div className="ambient" aria-hidden="true">
            <i className="orb orb-a" />
            <i className="orb orb-b" />
          </div>
          <div className="grain" aria-hidden="true" />
          <div className="progress" aria-hidden="true" />
          <SiteHeader />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
          {Concierge && <Concierge text={{ launcher: CONCIERGE.launcher, peek: CONCIERGE.peek, chips: CONCIERGE.chips }} />}
          {/* The pointer light, moved by MotionIsland on devices with a mouse. */}
          <div className="cursor" aria-hidden="true" />
        </div>
      </body>
    </html>
  )
}
