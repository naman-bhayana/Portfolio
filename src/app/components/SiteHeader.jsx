import { NAV, PERSON } from '@/content/site'

// Static header: four plain anchor links, no menu button and no JavaScript.
export default function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="container-page flex flex-wrap items-center justify-between gap-x-8 py-2 sm:py-3">
        {/* A one-page site gains nothing from client-side routing; next/link would add ~4 KB. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="inline-flex min-h-11 items-center text-[1.0625rem] font-semibold tracking-[-0.01em] text-fg">
          {PERSON.name}
        </a>
        <nav aria-label="Primary" className="w-full sm:w-auto">
          <ul className="flex items-center justify-between sm:justify-end sm:gap-x-8">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="nav-link">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
