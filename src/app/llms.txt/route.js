import { LLMS_SUMMARY, PERSON, RESUME_DRIVE_URL, SITE_URL } from '@/content/site'

// Built once at build time from the same content module as the page, so it cannot drift.
export const dynamic = 'force-static'

export function GET() {
  const lines = [
    `# ${PERSON.name}`,
    '',
    `> ${LLMS_SUMMARY}`,
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
