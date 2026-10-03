import { OG_IMAGE, PERSON, SHARE } from '@/content/site'
import { serializeGraph } from '@/lib/structured-data'
import About from './components/About'
import Contact from './components/Contact'
import Hero from './components/Hero'
import Nexerah from './components/Nexerah'
import ProofStrip from './components/ProofStrip'
import Reveal from './components/Reveal'
import SelectedWork from './components/SelectedWork'
import WhatIBuild from './components/WhatIBuild'

// Page-specific metadata lives here so other routes never inherit this canonical or card.
export const metadata = {
  alternates: { canonical: '/' },
  openGraph: {
    type: 'profile',
    url: '/',
    siteName: PERSON.name,
    locale: 'en_US',
    title: SHARE.title,
    description: SHARE.ogDescription,
    firstName: PERSON.firstName,
    lastName: PERSON.lastName,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: SHARE.title,
    description: SHARE.twitterDescription,
    images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
  },
}

export default function Home() {
  return (
    <>
      <Hero />
      <WhatIBuild />
      <SelectedWork />
      <ProofStrip />
      <About />
      <Nexerah />
      <Contact />
      <Reveal />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeGraph() }} />
    </>
  )
}
