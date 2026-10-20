import { FOOTER } from '@/content/site'
import { spaced } from '@/lib/spaced'

export default function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap footin">
        <p className="footline">
          <span>{FOOTER.line}</span> <span>{FOOTER.roles}</span>
        </p>
        <nav className="footl" aria-label="Elsewhere">
          {spaced(
            FOOTER.links.map((link) => (
              <a key={link.label} href={link.href} rel={link.me ? 'me' : undefined}>
                {link.label}
              </a>
            )),
          )}
        </nav>
      </div>
    </footer>
  )
}
