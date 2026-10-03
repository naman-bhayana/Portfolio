import { Fragment } from 'react'
import { SELECTED_WORK } from '@/content/site'
import ArrowIcon from './ArrowIcon'

export default function SelectedWork() {
  const { heading, subline, items } = SELECTED_WORK
  return (
    <section id="work" aria-labelledby="work-heading" className="section border-t border-line">
      <div className="container-page">
        <div className="max-w-prose" data-reveal>
          <h2 id="work-heading" className="text-balance text-h2 font-semibold">
            {heading}
          </h2>
          <p className="mt-3 text-lead text-muted">{subline}</p>
        </div>
        <ul role="list" className="mt-12 border-t border-line">
          {items.map((item) => (
            <li
              key={item.id}
              id={`work-${item.id}`}
              className="grid gap-5 border-b border-line py-8 lg:grid-cols-12 lg:gap-12 lg:py-10"
              data-reveal
            >
              <div className="lg:col-span-4">
                <h3 className="text-h3 font-semibold">{item.name}</h3>
                <p className="meta mt-2">
                  {/* Lines may break between segments, never inside one (e.g. "Oct 2025 – Apr 2026"). */}
                  {item.meta.map((segment, i) => (
                    <Fragment key={segment}>
                      {i > 0 && ' · '}
                      <span className="whitespace-nowrap">{segment}</span>
                    </Fragment>
                  ))}
                </p>
                {item.link && (
                  <p className="mt-3 text-[0.9375rem]">
                    <a href={item.link.href}>
                      {item.link.label}
                      <ArrowIcon />
                    </a>
                  </p>
                )}
              </div>
              <div className="lg:col-span-8">
                <p className="max-w-prose font-semibold">{item.summary}</p>
                <ul role="list" className="mt-4 max-w-prose space-y-3 text-muted">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className="bullet">
                      {bullet}
                    </li>
                  ))}
                </ul>
                {item.note && <p className="mt-4 text-sm text-muted">{item.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
