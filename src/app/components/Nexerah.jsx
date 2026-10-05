import { NEXERAH } from '@/content/site'
import Icon from './Icon'

// nexerah.com is shown as plain text, never as a link, until the domain is live.
export default function Nexerah() {
  return (
    <section className="sec nxsec" id="nexerah" aria-labelledby="nexerah-heading">
      <div className="wrap">
        <div className="nx rv">
          <span className="nxmark" aria-hidden="true" data-t={NEXERAH.name} />
          <div>
            <p className="kick">{NEXERAH.kicker}</p>
            <h2 id="nexerah-heading" className="h2">
              {NEXERAH.heading.lead}
              <span className="em grad">{NEXERAH.heading.em}</span>
            </h2>
            <p className="lead">{NEXERAH.body}</p>
            <div className="nxcta">
              <a className="pill pill-primary" href={NEXERAH.cta.href}>
                {NEXERAH.cta.label} <Icon name="arrow" />
              </a>
              <span className="soon">{NEXERAH.domainNote}</span>
            </div>
          </div>
          <div className="nxlist">
            {NEXERAH.pillars.map((pillar) => (
              <div className="nxi" key={pillar.name}>
                <strong>{pillar.name}</strong> <span>{pillar.copy}</span>
              </div>
            ))}
            <div className="nxs">
              <span className="pulse" aria-hidden="true" />
              <span>
                <strong>{NEXERAH.status}</strong> {NEXERAH.availability}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
