import { FOOTER } from '@/content/site'

export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="container-page flex flex-col gap-4 py-10 text-sm text-muted lg:flex-row lg:items-center lg:justify-between">
        <p>{FOOTER.line}</p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {FOOTER.links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  rel={link.me ? 'me' : undefined}
                  className="inline-flex min-h-6 items-center py-1 hover:text-fg hover:underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
