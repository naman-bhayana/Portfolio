// Every visible and machine-read string on the site lives here, so the page, metadata,
// structured data, sitemap, OG card and footer cannot drift apart.
//
// Strings marked "spec §3" are final copy from the audit spec: change them only with the
// owner's approval. Characters matter: ’ is never used (the spec uses ASCII apostrophes),
// ranges use an en dash (–), asides use an em dash (—), separators a middle dot (·).
// Pure data only: Node scripts (OG card, QA checks) import this file too.

export const SITE_URL = 'https://www.namanbhayana.com'

// Date of the last content change. Bump on every edit: it feeds the visible "Updated" line,
// ProfilePage.dateModified, the sitemap's lastmod and the footer year.
export const UPDATED = '2026-10-03'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const [updatedYear, updatedMonth] = UPDATED.split('-').map(Number)
export const UPDATED_LABEL = `${MONTHS[updatedMonth - 1]} ${updatedYear}`

export const PERSON = {
  name: 'Naman Bhayana',
  firstName: 'Naman',
  lastName: 'Bhayana',
  email: 'naman.bhayana13@gmail.com',
  linkedin: 'https://www.linkedin.com/in/namanbhayana007/',
  github: 'https://github.com/naman-bhayana',
}

export const NEXERAH_EMAIL = 'naman@nexerah.com'

// Pre-filled subjects make inbound mail countable without any analytics script.
export const MAILTO = `mailto:${PERSON.email}?subject=${encodeURIComponent('Enquiry via namanbhayana.com')}`
export const NEXERAH_MAILTO = `mailto:${NEXERAH_EMAIL}?subject=${encodeURIComponent('Nexerah enquiry')}`

// Résumé lives on Google Drive; /resume redirects there (next.config.js). Use the Drive *file*
// link and update the file with Drive's "Manage versions" so this URL never changes.
// While it is empty there is no /resume redirect and every Resume link is left out.
export const RESUME_DRIVE_URL = ''
export const RESUME_PATH = '/resume'

// spec §3.1
export const HEAD = {
  title: 'Naman Bhayana | Head of AI Engineering · Founder, Nexerah',
  description:
    'Head of AI Engineering at ideasIQ, founder of Nexerah. I build AI products end to end — agent runtime, multi-tenant SaaS and go-to-market. Delhi NCR.',
}

// spec §4.1 (share cards)
export const OG_IMAGE = {
  url: '/og/naman-bhayana-og.png',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'Naman Bhayana — Head of AI Engineering at ideasIQ, founder of Nexerah',
}
export const SHARE = {
  title: 'Naman Bhayana — I build the whole stack',
  ogDescription: 'Head of AI Engineering at ideasIQ · Founder, Nexerah. Agents, voice AI and SaaS from idea to launch.',
  twitterDescription: 'Head of AI Engineering at ideasIQ · Founder, Nexerah.',
}

// spec §3.2
export const NAV = [
  { label: 'Work', href: '/#work' },
  { label: 'About', href: '/#about' },
  { label: 'Nexerah', href: '/#nexerah' },
  { label: 'Contact', href: '/#contact' },
]

// spec §3.3
export const HERO = {
  eyebrow: 'Head of AI Engineering, ideasIQ · Founder, Nexerah',
  heading: 'I build the whole stack.',
  subline:
    'Agent runtime, the multi-tenant SaaS around it, and the go-to-market that sells it — shipped for healthcare, fintech and e-commerce since 2023.',
  primaryCta: { label: 'See selected work', href: '#work' },
  secondaryCta: { label: 'Get in touch', href: '#contact' },
}

// Not in the spec; approved with the plan (D9).
export const AVATAR = {
  src: '/images/naman-bhayana-avatar.png',
  width: 1024,
  height: 1024,
  alt: 'Illustrated avatar of Naman Bhayana', // spec §4.4
}

// spec §3.4
export const WHAT_I_BUILD = {
  heading: 'What I build',
  subline: 'Four layers, one owner.',
  layers: [
    {
      name: 'Go-to-market',
      copy: 'SEO and AEO, paid acquisition and a daily outbound agent — I decide how the product gets found and sold.',
    },
    {
      name: 'Product',
      copy: 'Multi-tenant SaaS, billing and dashboards — the product around the model, designed to hold at the tenant boundary.',
    },
    {
      name: 'AI runtime',
      copy: 'Metering, routing and evidence guards — the layer that decides which model runs, what it may claim, what it costs.',
    },
    {
      name: 'Data & finance',
      copy: 'Retrieval, pipelines and modelling — grounded answers over company documents and market data that decisions can rest on.',
    },
  ],
}

// spec §3.5. Meta lines follow the approved casing table (D10): the spec prints them in capitals.
export const SELECTED_WORK = {
  heading: 'Selected work',
  subline: 'Platform work at ideasIQ, and client engagements since 2023.',
  items: [
    {
      id: 'ideasiq',
      name: 'ideasIQ',
      meta: ['Enterprise AI', 'Head of AI Engineering', '2026 – present'],
      link: { href: 'https://ideasiq.ai/', label: 'ideasiq.ai' },
      summary:
        'Enterprise AI innovation platform. I own the agent architecture, model and cost governance, and the outbound engine.',
      bullets: [
        'Designed and run the in-house agent runtime, including a 14-stage research agent.',
        'Govern model access across a 400+ model gateway, with per-call cost provenance and per-org spend ceilings.',
        'Shipped the tool-calling voice agent on ideasiq.ai, a Knowledge Assistant that answers over company documents, and an AI deliverables engine spanning five providers.',
      ],
      note: 'Next release: fine-tuned small language models.',
    },
    {
      id: 'myleadsiq',
      name: 'myLeadsIQ',
      meta: ['Sales intelligence', 'AI & Product Lead', '2026', 'Private beta'],
      link: null,
      summary: 'Multi-tenant lead-intelligence SaaS — autonomous prospecting with governance built in.',
      bullets: [
        "Productised the lead-discovery engine behind ideasIQ's outbound: unattended daily runs over 11 live sources, two-stage model routing, reviewer-trained calibration.",
        'Designed the multi-tenant core: test-enforced isolation, daily spend governance and evidence guards that downgrade any claim the model cannot cite.',
      ],
    },
    {
      id: 'investbeans',
      name: 'InvestBeans',
      meta: ['Fintech', 'Full-stack engineering', 'Oct 2025 – Apr 2026'],
      link: { href: 'https://investbeans.com/', label: 'investbeans.com' },
      summary: 'Subscription market-analytics SaaS.',
      bullets: [
        'Led engineering: market-data pipelines, the indicators behind its decision tools, dashboards and subscription billing.',
        'Engagement complete; product live.',
      ],
    },
    {
      id: 'docpad',
      name: 'DocPad',
      meta: ['Healthcare', 'Product engineering', 'Feb – Mar 2026'],
      link: null,
      summary: 'Cloud hospital-records platform.',
      bullets: [
        'Built core clinical-records workflows: electronic medical records, standards-based clinical terminology, OCR on medical documents.',
        'API-first design for data exchange across hospitals and labs.',
      ],
    },
  ],
}

// spec §3.6, in reading order. Static text: never animated.
export const PROOF = [
  { value: '400+', label: 'models governed through one gateway' },
  { value: '5', label: 'AI providers behind one deliverables engine' },
  { value: '14-stage', label: 'research agent on the in-house runtime' },
  { value: '3', label: 'industries shipped for — healthcare, fintech, e-commerce' },
  { value: '11', label: 'live signal sources, one outbound agent' },
  { value: 'Since 2023', label: 'shipping for clients' },
]

// spec §3.7. Segments let the first "ideasIQ" link to ideasiq.ai (voice rule 5).
export const ABOUT = {
  heading: 'About', // D9: the spec gives no heading; this is the nav label
  paragraph: [
    "I'm Head of AI Engineering at ",
    { text: 'ideasIQ', href: 'https://ideasiq.ai/' },
    ", where I own the agent architecture, model and cost governance, and the outbound engine behind an enterprise AI platform. I build AI products end to end — the runtime, the multi-tenant SaaS around it, and the go-to-market — and have shipped for clients in healthcare, fintech and e-commerce since 2023. Thapar gave me the engineering; taking products from idea to launch taught me the rest, and that record is what I'd rather be judged on. Markets are the standing side interest: an algo-trading internship in 2023, a fintech analytics build in 2025–26, trading systems under Nexerah next. I'm based in Delhi NCR and work US, EU and AU hours.",
  ],
  disclosure: 'Client work runs through Nexerah; I work with ideasIQ in my day role; nothing here is sponsored.',
}

// spec §3.8. nexerah.com stays unlinked text until the domain answers 200.
export const NEXERAH = {
  eyebrow: 'Founder · Nexerah',
  heading: 'Nexerah builds and grows AI products for businesses.',
  body: "Nexerah is a premium studio for businesses that want AI doing real work, not sitting in a demo. We build the automations, the software and the trading systems, then run the growth that gets them used — search, paid, social and outbound. One team, from scope to shipped to sold. It's the end-to-end practice I've run for clients since 2023, now under its own name, with the first engagements opening in 2026.",
  status: 'Launching 2026.',
  availability:
    'Through Nexerah I take on a small number of AI build and advisory engagements each quarter — US, EU and AU hours.',
  updated: `Updated ${UPDATED_LABEL}.`,
  cta: { label: 'Talk to Nexerah', href: NEXERAH_MAILTO },
  domainNote: 'nexerah.com — coming soon',
}

// spec §3.9
export const CONTACT = {
  heading: 'Start a conversation', // D10 casing
  body: "If you're building an AI product, hiring someone to lead one, or want Nexerah on a project, write to me — I read everything and reply to anything serious.",
  links: [
    { label: 'linkedin.com/in/namanbhayana007', href: PERSON.linkedin, me: true },
    { label: 'github.com/naman-bhayana', href: PERSON.github, me: true },
  ],
  nexerahLabel: 'Nexerah enquiries:',
  resumeLabel: 'Resume',
  microline: 'Delhi NCR · US, EU and AU hours',
  copy: { button: 'Copy email', done: 'Email address copied', fallback: 'Press Ctrl+C to copy' }, // D9
}

// spec §3.9
export const FOOTER = {
  line: `© ${updatedYear} Naman Bhayana · Head of AI Engineering, ideasIQ · Founder, Nexerah · Delhi NCR`,
  links: [
    { label: 'Email', href: MAILTO },
    { label: 'LinkedIn', href: PERSON.linkedin, me: true },
    { label: 'GitHub', href: PERSON.github, me: true },
    ...(RESUME_DRIVE_URL ? [{ label: 'Resume', href: RESUME_PATH }] : []),
    { label: 'llms.txt', href: '/llms.txt' },
  ],
}

export const SKIP_LINK = 'Skip to content' // D9

// spec §5 (llms.txt summary line)
export const LLMS_SUMMARY =
  'Head of AI Engineering at ideasIQ, founder of Nexerah. I build AI products end to end — agent runtime, multi-tenant SaaS and go-to-market. Delhi NCR; US, EU and AU hours.'

// spec §4.2 (structured data)
export const ENTITY = {
  jobTitle: 'Head of AI Engineering',
  employer: { id: 'https://ideasiq.ai/#organization', name: 'ideasIQ', url: 'https://ideasiq.ai' },
  employerProfile: 'https://ideasiq.ai/about#naman-bhayana',
  alumniOf: 'Thapar Institute of Engineering & Technology',
  locality: 'Delhi',
  country: 'IN',
  knowsAbout: [
    'AI agents',
    'LLM orchestration and model governance',
    'Voice AI',
    'Multi-tenant SaaS',
    'Retrieval-augmented generation',
    'Go-to-market automation',
  ],
  profilePageName: 'Naman Bhayana — Head of AI Engineering',
}

export const MANIFEST = {
  name: 'Naman Bhayana',
  shortName: 'Naman Bhayana',
  description: HEAD.description,
  color: '#0A0C10',
}
