import { BUILDS, LLMS_SUMMARY, PERSON, PROOF, RESUME_DRIVE_URL, SITE_URL, WORK } from '@/content/site'

// Built once at build time from the same content module as the page, so it cannot drift.
// Format per llmstxt.org: H1, blockquote, free-form details, then H2 sections whose list
// items are all links. Builds without a public address appear only in the details.
export const dynamic = 'force-static'

const kind = (build) => [...(build.tags ?? [build.category]), build.result].filter(Boolean).join(' · ')

// A figure names the product it comes from, so a model reading this file cannot credit it to
// the wrong one; the count of domains is followed by the domains.
function figure(item) {
  const list = item.id === 'domains' ? `: ${PROOF.domains.join(', ')}` : ''
  const source = item.source ? ` (${item.source})` : ''
  return `- ${item.value} ${item.label.replace(/\.$/, '')}${list}${source}.`
}

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
    WORK.sub,
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
