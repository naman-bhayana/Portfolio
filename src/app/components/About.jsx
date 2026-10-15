import { ABOUT, TIMELINE } from '@/content/site'
import { optimised, srcSet } from '@/lib/images'
import { spaced } from '@/lib/spaced'

export default function About() {
  const { portrait } = ABOUT
  return (
    <section className="scene about" id="about" aria-labelledby="about-heading">
      <div className="light light-about para" aria-hidden="true" />
      <div className="wrap">
        <div className="aboutgrid">
          <figure className="portrait" data-rv="one">
            <div className="pframe">
              {/* eslint-disable-next-line @next/next/no-img-element -- optimised URLs built in lib/images */}
              <img
                className="pimg para-img"
                src={optimised(portrait.src, 768)}
                srcSet={srcSet(portrait.src)}
                sizes="(max-width: 600px) 240px, 400px"
                width={portrait.width}
                height={portrait.height}
                alt={portrait.alt}
                loading="lazy"
                decoding="async"
              />
            </div>
            <figcaption className="pcap">
              <strong>{ABOUT.caption.name}</strong> · {ABOUT.caption.line}
            </figcaption>
          </figure>
          <div className="abouttext" data-rv="seq">
            <h2 id="about-heading" className="h2b">
              {ABOUT.quote.lead} <span className="emw">{ABOUT.quote.rest}</span>
            </h2>
            {/* A line, not a paragraph: set this large, a <p> reads to an accessibility checker as a heading in disguise. */}
            <div className="person">{ABOUT.person}</div>
            <p className="body">
              {ABOUT.bio.map((part) =>
                typeof part === 'string' ? (
                  part
                ) : (
                  <a key={part.href} className="inl" href={part.href}>
                    {part.text}
                  </a>
                ),
              )}
            </p>
            <p className="facts">{spaced(ABOUT.facts.map((fact) => <span key={fact}>{fact}</span>))}</p>
            <p className="disclosure">{ABOUT.disclosure}</p>
          </div>
          <div className="log" data-rv="seq">
            <p className="eyebrow">{TIMELINE.label}</p>
            <ol className="ledger" role="list">
              {TIMELINE.events.map((event) => (
                <li key={event.when}>
                  <span className="lyear">{event.when}</span> <span className="lwho">{event.who}</span>{' '}
                  <span className="lwhat">{event.what}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}
