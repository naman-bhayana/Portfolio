import { HEAD, MOTION, PERSON, SITE_URL, SKIP_LINK } from '@/content/site'
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import { fontVariables } from './fonts'
// Order matters: responsive.css overrides the section files, and motion.css comes last.
import '@/styles/base.css'
import '@/styles/chrome.css'
import '@/styles/hero.css'
import '@/styles/proof.css'
import '@/styles/work.css'
import '@/styles/stack.css'
import '@/styles/about.css'
import '@/styles/nexerah.css'
import '@/styles/contact.css'
import '@/styles/responsive.css'
import '@/styles/motion.css'

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
          <SiteHeader />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  )
}
