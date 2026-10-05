import { CONTACT, MAILTO, NEXERAH_EMAIL, NEXERAH_MAILTO, PERSON, RESUME_DRIVE_URL, RESUME_PATH } from '@/content/site'
import { spaced } from '@/lib/spaced'
import CopyEmail from './CopyEmail'
import Icon from './Icon'

// No form: the address itself is the call to action, with a mailto and a copy button.
export default function Contact() {
  return (
    <section className="contact" id="contact" aria-labelledby="contact-heading">
      <div className="wrap rv">
        <p className="kick">{CONTACT.kicker}</p>
        <h2 id="contact-heading" className="h2">
          {CONTACT.heading.lead}
          <span className="em grad">{CONTACT.heading.em}</span>
        </h2>
        <p className="cbody2">{CONTACT.body}</p>
        <a id="contact-email" className="mail grad" href={MAILTO}>
          {PERSON.email}
        </a>
        <div className="cacts">
          <a className="pill pill-primary" href={MAILTO}>
            {CONTACT.write} <Icon name="arrow" />
          </a>
          <CopyEmail email={PERSON.email} targetId="contact-email" labels={CONTACT.copy} />{' '}
          {spaced(
            CONTACT.links.map((link) => (
              <a key={link.href} className="pill pill-ghost" href={link.href} rel={link.me ? 'me' : undefined}>
                {link.label}
              </a>
            )),
          )}
          {RESUME_DRIVE_URL && (
            <>
              {' '}
              <a className="pill pill-ghost" href={RESUME_PATH}>
                {CONTACT.resumeLabel}
              </a>
            </>
          )}
        </div>
        <p className="cmeta">
          {CONTACT.nexerahLabel} <a href={NEXERAH_MAILTO}>{NEXERAH_EMAIL}</a> · {CONTACT.microline}
        </p>
      </div>
    </section>
  )
}
