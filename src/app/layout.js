import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Naman Bhayana | Full-Stack Developer & AI/ML Engineer',
  description: 'Full-Stack Developer & AI/ML Engineer specializing in web development and artificial intelligence',
  keywords: ['Full-Stack Developer', 'AI Engineer', 'ML Engineer', 'Web Development', 'Portfolio'],
  authors: [{ name: 'Naman Bhayana' }],
  openGraph: {
    title: 'Naman Bhayana | Full-Stack Developer & AI/ML Engineer',
    description: 'Full-Stack Developer & AI/ML Engineer specializing in web development and artificial intelligence',
    type: 'website',
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
