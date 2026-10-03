import { Fragment } from 'react'
import { ABOUT } from '@/content/site'

export default function About() {
  return (
    <section id="about" aria-labelledby="about-heading" className="section">
      <div className="container-page grid gap-8 lg:grid-cols-12 lg:gap-12" data-reveal>
        <div className="lg:col-span-4">
          <h2 id="about-heading" className="text-h2 font-semibold">
            {ABOUT.heading}
          </h2>
        </div>
        <div className="lg:col-span-8">
          <p className="max-w-prose text-lead">
            {ABOUT.paragraph.map((part, i) =>
              typeof part === 'string' ? (
                <Fragment key={i}>{part}</Fragment>
              ) : (
                <a key={i} href={part.href}>
                  {part.text}
                </a>
              ),
            )}
          </p>
          <p className="mt-6 max-w-prose text-sm text-muted">{ABOUT.disclosure}</p>
        </div>
      </div>
    </section>
  )
}
