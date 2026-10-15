import { AVATAR, ENTITY, HERO, NEXERAH_LIVE, PERSON, SITE_URL, UPDATED } from '@/content/site'

const HOME = `${SITE_URL}/`
const ID = {
  person: `${SITE_URL}/#person`,
  profilePage: `${SITE_URL}/#profilepage`,
  website: `${SITE_URL}/#website`,
}

// Person + ProfilePage + WebSite. Every value is backed by visible text on the page.
// Nexerah's Organization node joins only once NEXERAH_LIVE is set in site.js, that is, once
// nexerah.com answers 200: a node for an address that does not resolve is worse than none.
export function buildGraph() {
  const studio = NEXERAH_LIVE
    ? {
        '@type': 'Organization',
        '@id': ENTITY.studio.id,
        name: ENTITY.studio.name,
        url: ENTITY.studio.url,
        founder: { '@id': ID.person },
      }
    : null
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
        ...(studio ? { affiliation: { '@id': studio['@id'] } } : {}),
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
      ...(studio ? [studio] : []),
    ],
  }
}

// Escape "<" so the JSON can never close the surrounding <script> element.
export function serializeGraph() {
  return JSON.stringify(buildGraph()).replace(/</g, '\\u003c')
}
