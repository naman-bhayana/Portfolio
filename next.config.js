const { RESUME_DRIVE_URL } = require('./src/content/site.js')
const { IMAGE_QUALITY, IMAGE_WIDTHS, LOGO_WIDTHS } = require('./src/lib/images.js')

// Report-only first. A static page cannot carry a per-request nonce, so inline scripts are
// allowed; promote this to Content-Security-Policy after a clean week in production.
// No upgrade-insecure-requests: browsers reject it in report-only mode with a console error.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
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
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Production builds only: next dev needs eval for fast refresh.
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy }]
    : []),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // `next dev` would otherwise write AGENTS.md and CLAUDE.md into this public repo.
  agentRules: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    // The optimiser serves the widths the page asks for (src/lib/images.js) and nothing else.
    deviceSizes: IMAGE_WIDTHS,
    imageSizes: LOGO_WIDTHS,
    qualities: [IMAGE_QUALITY],
    localPatterns: [
      { pathname: '/images/**', search: '' },
      { pathname: '/work/**', search: '' },
      { pathname: '/logos/**', search: '' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  async redirects() {
    if (!RESUME_DRIVE_URL) return []
    // Temporary on purpose: the Drive link may change; /resume is the stable address.
    return [{ source: '/resume', destination: RESUME_DRIVE_URL, permanent: false }]
  },
}

module.exports = nextConfig
