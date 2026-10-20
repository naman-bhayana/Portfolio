import { BUILDS, LLMS_SUMMARY, NEXERAH_URL, PERSON, PROOF, RESUME_DRIVE_URL, SITE_URL, STUDIO, WORK } from '@/content/site'
import { andList } from '@/lib/and-list'

// Built once at build time from the same content module as the page, so it cannot drift.
// Format per llmstxt.org: H1, blockquote, free-form details, then H2 sections whose list
// items are all links. Builds without a public address appear only in the details.
export const dynamic = 'force-static'

// A figure names the product it comes from, so a model reading this file cannot credit it to
// the wrong one. The file describes him in the third person: a line the page says as "I" has
// an `llms` version in site.js, and verify-site fails if any first person is left here.
const figure = (item) => `- ${item.value} ${(item.llms ?? item.label).replace(/\.$/, '')}${item.source ? ` (${item.source})` : ''}.`

// The flagship and the cases have a line each; an index row that groups builds names them all
// in one line, so no build is credited with what a sibling did.
const build = (item) => `- ${item.name} (${item.tags.join(' · ')}): ${item.llms ?? item.summary ?? [item.role, item.mech].filter(Boolean).join(' ')}`
const row = (item) => `- ${andList(item.builds.map((b) => b.name))} (${item.sector}): ${item.summary}`

export function GET() {
  const figures = [...PROOF.wall, ...PROOF.cells].map(figure)
  const builds = [build(WORK.flagship), ...WORK.cards.map(build), ...WORK.index.map(row)]
  const linked = BUILDS.flatMap((item) => {
    const link = item.link ?? item.links?.[0]
    return link ? [`- [${item.name}](${link.href})`] : []
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
