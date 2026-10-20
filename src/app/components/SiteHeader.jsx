import { HEADER_CTA, MOTION, NAV, PERSON } from '@/content/site'
import { spaced } from '@/lib/spaced'
import Icon from './Icon'

// Sticky header: plain anchor links, no menu button and no JavaScript.
export default function SiteHeader() {
  return (
    <header className="nav">
      <div className="wrap navin">
        {/* A one-page site gains nothing from client-side routing; next/link would add ~4 KB. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/">
          <span className="mark" aria-hidden="true" data-t={PERSON.initials} />
          <span>{PERSON.name}</span>
        </a>
        <nav className="links" aria-label="Primary">
          {spaced(
            NAV.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            )),
          )}
        </nav>
        <div className="navend">
          {/* Click target for the pause checkbox in layout.js, which carries the accessible name. */}
          <label className="pause" htmlFor="pause-motion" title={MOTION.pause}>
            <Icon name="pause" className="when-playing" />
            <Icon name="play" className="when-paused" />
          </label>
          <a className="pill pill-primary navcta" href={HEADER_CTA.href}>
            {HEADER_CTA.label}
          </a>
        </div>
      </div>
    </header>
  )
}
