import { CONCIERGE, CONTACT, MAILTO, PERSON, RESUME_DRIVE_URL, RESUME_PATH } from '@/content/site'
import CopyEmail from './CopyEmail'

// The concierge's inline entry, only in a build made with NEXT_PUBLIC_CONCIERGE=on (see layout.js).
const ConciergeEntry = process.env.NEXT_PUBLIC_CONCIERGE === 'on' ? require('./ConciergeEntry').default : null

// No form: the address itself is the call to action, with a mailto and a copy button.
export default function Contact() {
  return (
    <section className="scene contact" id="contact" aria-labelledby="contact-heading">
      <div className="light light-contact para" aria-hidden="true" />
      <div className="wrap contactin" data-rv="seq">
        <h2 id="contact-heading" className="h2c">
          {CONTACT.heading.lead}
          <span className="grad">{CONTACT.heading.em}</span>
        </h2>
        <p className="cbody">{CONTACT.body}</p>
        <p className="cextra">{CONTACT.extra}</p>
        <div className="addr">
          <a id="contact-email" href={MAILTO}>
            {PERSON.email}
          </a>{' '}
          <CopyEmail email={PERSON.email} targetId="contact-email" labels={CONTACT.copy} className="copybtn" />
        </div>
        <p className="cacts">
          <a className="pill pill-primary" href={MAILTO}>
            {CONTACT.write}
          </a>
          {RESUME_DRIVE_URL && (
            <>
              {' '}
              <a className="pill pill-ghost" href={RESUME_PATH}>
                {CONTACT.resumeLabel}
              </a>
            </>
          )}
        </p>
        {ConciergeEntry && <ConciergeEntry text={CONCIERGE.entry} chips={CONCIERGE.chips} />}
        <p className="micro">{CONTACT.microline}</p>
      </div>
    </section>
  )
}
