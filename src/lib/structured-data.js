import { AVATAR, ENTITY, HERO, PERSON, SITE_URL, UPDATED } from '@/content/site'

const HOME = `${SITE_URL}/`
const ID = {
  person: `${SITE_URL}/#person`,
  profilePage: `${SITE_URL}/#profilepage`,
  website: `${SITE_URL}/#website`,
}

// Person + ProfilePage + WebSite. Every value is backed by visible text on the page.
// Nexerah gets no Organization node until nexerah.com answers 200.
export function buildGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': ID.person,
        name: PERSON.name,
        url: HOME,
        image: `${SITE_URL}${AVATAR.src}`,
        description: HERO.eyebrow,
        jobTitle: ENTITY.jobTitle,
        worksFor: {
          '@type': 'Organization',
          '@id': ENTITY.employer.id,
          name: ENTITY.employer.name,
          url: ENTITY.employer.url,
        },
        email: `mailto:${PERSON.email}`,
        sameAs: [PERSON.linkedin, PERSON.github, PERSON.x, PERSON.instagram, ENTITY.employerProfile],
        alumniOf: { '@type': 'CollegeOrUniversity', name: ENTITY.alumniOf },
        address: { '@type': 'PostalAddress', addressLocality: ENTITY.locality, addressCountry: ENTITY.country },
        knowsAbout: ENTITY.knowsAbout,
      },
      {
        '@type': 'ProfilePage',
        '@id': ID.profilePage,
        url: HOME,
        name: ENTITY.profilePageName,
        mainEntity: { '@id': ID.person },
        isPartOf: { '@id': ID.website },
        dateModified: `${UPDATED}T00:00:00+05:30`,
      },
      {
        '@type': 'WebSite',
        '@id': ID.website,
        url: HOME,
        name: PERSON.name,
        inLanguage: 'en',
        publisher: { '@id': ID.person },
      },
    ],
  }
}

// Escape "<" so the JSON can never close the surrounding <script> element.
export function serializeGraph() {
  return JSON.stringify(buildGraph()).replace(/</g, '\\u003c')
}
