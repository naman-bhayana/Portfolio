import { LLMS_SUMMARY, PERSON, RESUME_DRIVE_URL, SELECTED_WORK, SITE_URL } from '@/content/site'

// Built once at build time from the same content module as the page, so it cannot drift.
// Format per llmstxt.org: H1, blockquote, free-form details, then H2 sections whose list
// items are all links. myLeadsIQ has no public page, so it appears only in the details.
export const dynamic = 'force-static'

export function GET() {
  const work = SELECTED_WORK.items.map((item) => `- ${item.name} (${item.meta.join(' · ')}): ${item.summary}`)
  const lines = [
    `# ${PERSON.name}`,
    '',
    `> ${LLMS_SUMMARY}`,
    '',
    SELECTED_WORK.subline,
    '',
    ...work,
    '',
    '## About',
    '',
    `- [About](${SITE_URL}/#about)`,
    '',
    '## Work',
    '',
    `- [Selected work](${SITE_URL}/#work)`,
    '- [ideasIQ](https://ideasiq.ai/)',
    '- [InvestBeans](https://investbeans.com/)',
    '',
    '## Contact',
    '',
    ...(RESUME_DRIVE_URL ? [`- [Resume](${SITE_URL}/resume)`] : []),
    `- [Email](mailto:${PERSON.email})`,
    '',
  ]
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
