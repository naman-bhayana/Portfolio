import { Fragment } from 'react'
import { CONTACT, MAILTO, NEXERAH_EMAIL, NEXERAH_MAILTO, PERSON, RESUME_DRIVE_URL, RESUME_PATH } from '@/content/site'
import CopyEmail from './CopyEmail'

const [emailLocal, emailDomain] = PERSON.email.split('@')

export default function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-heading" className="section border-t border-line">
      {/* grid-cols-1 = minmax(0, 1fr): long unbroken links can never widen the column. */}
      <div className="container-page grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12" data-reveal>
        <div className="lg:col-span-5">
          <h2 id="contact-heading" className="text-balance text-h2 font-semibold">
            {CONTACT.heading}
          </h2>
          <p className="mt-4 max-w-prose text-lead text-muted">{CONTACT.body}</p>
        </div>
        <div className="lg:col-span-7">
          <p className="text-email font-semibold [overflow-wrap:anywhere]">
            {/* The <wbr> hints would add spaces to the computed accessible name, so the
                name is set to the visible text explicitly. */}
            <a id="contact-email" href={MAILTO} aria-label={PERSON.email}>
              {/* On narrow screens the address wraps after the @, not mid-word. */}
              {emailLocal}@<wbr />
              {emailDomain}
            </a>
          </p>
          <CopyEmail email={PERSON.email} targetId="contact-email" labels={CONTACT.copy} />
          <ul role="list" className="mt-8 space-y-2 [overflow-wrap:anywhere]">
            {CONTACT.links.map((link) => (
              <li key={link.href}>
                <a href={link.href} rel={link.me ? 'me' : undefined} className="link" aria-label={link.label}>
                  {/* Narrow screens wrap after a "/", never inside the handle. */}
                  {link.label.split('/').map((part, i) => (
                    <Fragment key={i}>
                      {i > 0 && (
                        <>
                          /<wbr />
                        </>
                      )}
                      {part}
                    </Fragment>
                  ))}
                </a>
              </li>
            ))}
            <li>
              {CONTACT.nexerahLabel}{' '}
              <a href={NEXERAH_MAILTO} className="link">
                {NEXERAH_EMAIL}
              </a>
            </li>
            {RESUME_DRIVE_URL && (
              <li>
                <a href={RESUME_PATH} className="link">
                  {CONTACT.resumeLabel}
                </a>
              </li>
            )}
          </ul>
          <p className="meta mt-8">{CONTACT.microline}</p>
        </div>
      </div>
    </section>
  )
}
