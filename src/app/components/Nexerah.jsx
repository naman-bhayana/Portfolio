import { NEXERAH } from '@/content/site'

// nexerah.com stays plain text until the domain answers 200; then it becomes a rel="me" link.
export default function Nexerah() {
  return (
    <section id="nexerah" aria-labelledby="nexerah-heading" className="section border-t border-line">
      <div className="container-page grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12" data-reveal>
        <div className="lg:col-span-7">
          <p className="eyebrow">{NEXERAH.eyebrow}</p>
          <h2 id="nexerah-heading" className="mt-4 text-balance text-h2 font-semibold">
            {NEXERAH.heading}
          </h2>
          <p className="mt-6 max-w-prose text-lead text-muted">{NEXERAH.body}</p>
        </div>
        <div className="lg:col-span-5">
          <div className="status-panel">
            <p className="font-semibold">{NEXERAH.status}</p>
            <p className="mt-2 text-muted">{NEXERAH.availability}</p>
            <p className="meta mt-4">{NEXERAH.updated}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <a href={NEXERAH.cta.href} className="btn btn-secondary">
                {NEXERAH.cta.label}
              </a>
              <span className="text-sm text-muted">{NEXERAH.domainNote}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
