import { OG_IMAGE, PERSON, SHARE, SITE_URL } from '@/content/site'
import { serializeGraph } from '@/lib/structured-data'
import About from './components/About'
import ClientWall from './components/ClientWall'
import Contact from './components/Contact'
import Hero from './components/Hero'
import Infra from './components/Infra'
import Marquee from './components/Marquee'
import MotionIsland from './components/MotionIsland'
import Proof from './components/Proof'
import Studio from './components/Studio'
import Work from './components/Work'

// Page-specific metadata lives here so other routes never inherit this canonical or card. The
// home page's address is the bare origin everywhere: Next prints the canonical that way, and
// og:url and the JSON-LD's url fields (structured-data.js) say the same.
export const metadata = {
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
  openGraph: {
    type: 'profile',
    url: SITE_URL,
    siteName: PERSON.name,
    locale: 'en_GB',
    title: SHARE.title,
    description: SHARE.ogDescription,
    firstName: PERSON.firstName,
    lastName: PERSON.lastName,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    creator: PERSON.xHandle,
    title: SHARE.title,
    description: SHARE.twitterDescription,
    images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
  },
}

export default function Home() {
  return (
    <>
      <Hero />
      <ClientWall />
      <Marquee />
      <Proof />
      <Work />
      <Infra />
      <Studio />
      <About />
      <Contact />
      <MotionIsland />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeGraph() }} />
    </>
  )
}
