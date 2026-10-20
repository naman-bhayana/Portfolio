import { STUDIO } from '@/content/site'

// The studio: what it builds, how an engagement runs, and the terms. Prices live on
// nexerah.com; the page says they are set up front and links there.
export default function Studio() {
  return (
    <section className="scene studio" id="nexerah" aria-labelledby="studio-heading">
      <div className="light light-studio para" aria-hidden="true" />
      <div className="wrap">
        <div className="studiohead" data-rv="seq">
          <h2 id="studio-heading" className="h2b h2studio">
            {STUDIO.heading.lead}
            <span className="emc">{STUDIO.heading.em}</span>
          </h2>
          <p className="body">{STUDIO.body}</p>
          <p className="studiolink">
            <a className="ext" href={STUDIO.link.href}>
              {STUDIO.link.label}
            </a>
          </p>
        </div>
        <ul className="practices" data-rv="seq" role="list">
          {STUDIO.practices.map((practice) => (
            <li key={practice.name} className="practice spotcard tilt" data-tilt="3">
              <h3>{practice.name}</h3>
              <p>{practice.copy}</p>
              <p className="src">{practice.seen}</p>
            </li>
          ))}
        </ul>
        <div className="method" data-rv="seq">
          <h3 className="h3">{STUDIO.methodHeading}</h3>
          <ol className="steps" role="list">
            {STUDIO.steps.map((step) => (
              <li key={step.name}>
                <span className="stepname">{step.name}</span> <span className="stepwhen">{step.when}</span>{' '}
                <span className="stepwhat">{step.what}</span>
              </li>
            ))}
          </ol>
          <p className="send">
            {STUDIO.priced}{' '}
            <a className="inl" href={STUDIO.pricedLink.href}>
              {STUDIO.pricedLink.label}
            </a>
          </p>
        </div>
        <dl className="terms" data-rv="seq">
          {STUDIO.terms.map((term) => (
            <div key={term.name}>
              <dt>{term.name}</dt>
              <dd>{term.copy}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
