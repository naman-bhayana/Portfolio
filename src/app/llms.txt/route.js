import { BUILDS, LLMS_SUMMARY, NEXERAH_URL, PERSON, PROOF, RESUME_DRIVE_URL, SITE_URL, STUDIO } from '@/content/site'

// Built once at build time from the same content module as the page, so it cannot drift.
// Format per llmstxt.org: H1, blockquote, free-form details, then H2 sections whose list
// items are all links. Builds without a public address appear only in the details.
export const dynamic = 'force-static'

const kind = (build) => (build.tags ?? [build.category]).join(' · ')

// A figure names the product it comes from, so a model reading this file cannot credit it to
// the wrong one.
const figure = (item) => `- ${item.value} ${item.label.replace(/\.$/, '')}${item.source ? ` (${item.source})` : ''}.`

export function GET() {
  const figures = [...PROOF.wall, ...PROOF.cells].map(figure)
  const builds = BUILDS.map((build) => `- ${build.name} (${kind(build)}): ${build.summary}`)
  const linked = BUILDS.flatMap((build) => {
    const link = build.link ?? build.links?.[0]
    return link ? [`- [${build.name}](${link.href})`] : []
  })
  const lines = [
    `# ${PERSON.name}`,
    '',
    `> ${LLMS_SUMMARY}`,
    '',
    ...figures,
    '',
    ...builds,
    '',
    '## About',
    '',
    `- [About](${SITE_URL}/#about)`,
    '',
    '## Work',
    '',
    `- [Work](${SITE_URL}/#work)`,
    ...linked,
    '',
    '## Studio',
    '',
    `- [${STUDIO.name}](${NEXERAH_URL})`,
    '',
    '## Contact',
    '',
    ...(RESUME_DRIVE_URL ? [`- [Resume](${SITE_URL}/resume)`] : []),
    `- [Email](mailto:${PERSON.email})`,
    `- [LinkedIn](${PERSON.linkedin})`,
    `- [GitHub](${PERSON.github})`,
    '',
  ]
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
