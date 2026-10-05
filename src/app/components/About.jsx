import { ABOUT, AVATAR, TIMELINE } from '@/content/site'
import { THUMB_WIDTH, optimised, srcSet } from '@/lib/images'

export default function About() {
  const { illustration } = ABOUT
  return (
    <section className="sec" id="about" aria-labelledby="about-heading">
      <div className="wrap">
        <div className="about">
          <figure className="frame rv">
            {/* eslint-disable-next-line @next/next/no-img-element -- optimised URLs built in lib/images */}
            <img
              src={optimised(illustration.src, 768)}
              srcSet={srcSet(illustration.src)}
              sizes="(max-width: 960px) 92vw, 520px"
              width={illustration.width}
              height={illustration.height}
              alt={illustration.alt}
              loading="lazy"
              decoding="async"
            />
            <figcaption className="badge">
              {/* eslint-disable-next-line @next/next/no-img-element -- optimised URLs built in lib/images */}
              <img src={optimised(AVATAR.src, THUMB_WIDTH)} width={44} height={44} alt="" loading="lazy" decoding="async" />
              <span>
                <strong>{ABOUT.badge.name}</strong> <small>{ABOUT.badge.line}</small>
              </span>
            </figcaption>
          </figure>
          <div className="rv s2">
            <h2 id="about-heading" className="kick">
              {ABOUT.kicker}
            </h2>
            <p className="quote">
              {ABOUT.quote.lead} <span>{ABOUT.quote.rest}</span>
            </p>
            <p className="bio">
              {ABOUT.bio.map((part) =>
                typeof part === 'string' ? (
                  part
                ) : (
                  <a key={part.href} href={part.href}>
                    {part.text}
                  </a>
                ),
              )}
            </p>
            <p className="bio">{ABOUT.markets}</p>
            <ul className="facts">
              {ABOUT.facts.map((fact) => (
                <li key={fact} className="fact">
                  {fact}
                </li>
              ))}
            </ul>
            <p className="note">{ABOUT.disclosure}</p>
          </div>
        </div>

        <h3 className="mono tlh rv">{TIMELINE.label}</h3>
        <ol className="tl rv">
          <li className="prog" aria-hidden="true" />
          {TIMELINE.events.map((event) => (
            <li key={event.name} className={event.next ? 'ev nextev' : 'ev'}>
              <span className="yr">{event.when}</span> <b>{event.name}</b> <span className="ds">{event.detail}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
