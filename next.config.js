const { RESUME_DRIVE_URL } = require('./src/content/site.js')
const { IMAGE_QUALITY, IMAGE_WIDTHS, LOGO_WIDTHS } = require('./src/lib/images.js')

// The concierge (NEXT_PUBLIC_CONCIERGE=on at build time) needs the microphone on this origin and
// connects to ElevenLabs; its audio worklets are self-hosted, so script-src gains no blob:.
// Without the flag every header stays exactly as it was.
const CONCIERGE = process.env.NEXT_PUBLIC_CONCIERGE === 'on'

// Report-only first. A static page cannot carry a per-request nonce, so inline scripts are
// allowed; promote this to Content-Security-Policy after a clean week in production.
// No upgrade-insecure-requests: browsers reject it in report-only mode with a console error.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  CONCIERGE
    ? "connect-src 'self' https://api.elevenlabs.io wss://api.elevenlabs.io https://livekit.rtc.elevenlabs.io wss://livekit.rtc.elevenlabs.io"
    : "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Clipboard stays allowed: the contact section copies the email address.
  {
    key: 'Permissions-Policy',
    value: CONCIERGE ? 'camera=(), microphone=(self), geolocation=()' : 'camera=(), microphone=(), geolocation=()',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Production builds only: next dev needs eval for fast refresh.
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy }]
    : []),
]

// The brand files are replaced by renaming, never in place (README): a year in the browser.
// The optimiser (/_next/image) caches its own copies for the larger of this and minimumCacheTTL.
const YEAR = 'public, max-age=31536000, immutable'
const cacheHeaders = ['/images/:path*', '/logos/:path*', '/work/:path*', '/og/:path*'].map((source) => ({
  source,
  headers: [{ key: 'Cache-Control', value: YEAR }],
}))

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // `next dev` would otherwise write AGENTS.md and CLAUDE.md into this public repo.
  agentRules: false,
  // Always defined, so a build without the concierge drops its code instead of carrying it unused.
  env: { NEXT_PUBLIC_CONCIERGE: CONCIERGE ? 'on' : 'off' },
  images: {
    formats: ['image/avif', 'image/webp'],
    // The optimiser serves the widths the page asks for (src/lib/images.js) and nothing else.
    deviceSizes: IMAGE_WIDTHS,
    imageSizes: LOGO_WIDTHS,
    qualities: [IMAGE_QUALITY],
    minimumCacheTTL: 31536000,
    localPatterns: [
      { pathname: '/images/**', search: '' },
      { pathname: '/work/**', search: '' },
      { pathname: '/logos/**', search: '' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }, ...cacheHeaders]
  },
  async redirects() {
    if (!RESUME_DRIVE_URL) return []
    // Temporary on purpose: the Drive link may change; /resume is the stable address.
    return [{ source: '/resume', destination: RESUME_DRIVE_URL, permanent: false }]
  },
}

module.exports = nextConfig
