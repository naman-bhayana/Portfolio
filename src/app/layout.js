import { Poppins } from 'next/font/google'
import { HEAD, PERSON, SITE_URL, SKIP_LINK } from '@/content/site'
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import './globals.css'

// Two weights only (400 body, 600 headings): two self-hosted woff2 files.
const poppins = Poppins({
  weight: ['400', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
})

// Site-wide fields only. The canonical URL, Open Graph, Twitter and JSON-LD belong to the
// page that they describe (src/app/page.js), so other routes never inherit them.
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: HEAD.title,
  description: HEAD.description,
  authors: [{ name: PERSON.name, url: SITE_URL }],
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
}

export const viewport = {
  themeColor: '#0A0C10',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>
        <a href="#main" className="skip-link">
          {SKIP_LINK}
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
