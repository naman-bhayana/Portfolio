import { SITE_URL, UPDATED } from '@/content/site'

// One page. lastModified comes from the content date, never from the build time,
// so search engines can trust it. Phase-2 /work pages join here only once they exist.
export default function sitemap() {
  return [{ url: SITE_URL, lastModified: UPDATED }]
}
