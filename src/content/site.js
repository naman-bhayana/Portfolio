// Every visible and machine-read string on the site lives here, so the page, metadata,
// structured data, llms.txt, sitemap, OG card and footer cannot drift apart.
//
// Characters matter: apostrophes are typographic (’), ranges use an en dash (–), separators a
// middle dot (·). Spelling is British. Figures come from live products and client work: add a
// number here only when it is already public.
// Pure data only: Node scripts (OG card, QA checks) import this file too.

export const SITE_URL = 'https://www.namanbhayana.com'

// Date of the last content change. Bump on every edit: it feeds ProfilePage.dateModified,
// the sitemap's lastmod and the footer year.
export const UPDATED = '2026-10-05'

const [updatedYear] = UPDATED.split('-').map(Number)

export const PERSON = {
  name: 'Naman Bhayana',
  firstName: 'Naman',
  lastName: 'Bhayana',
  initials: 'NB',
  email: 'naman.bhayana13@gmail.com',
  linkedin: 'https://www.linkedin.com/in/namanbhayana007/',
  github: 'https://github.com/naman-bhayana',
  x: 'https://x.com/bhayana_naman',
  instagram: 'https://www.instagram.com/naman_bhayana/',
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

export const HEAD = {
  title: 'Naman Bhayana | Head of AI Engineering · Founder, Nexerah',
  description:
    'Head of AI Engineering at ideasIQ, founder of Nexerah. I build AI products end to end — agent runtime, multi-tenant SaaS and go-to-market. Delhi NCR.',
}

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

export const NAV = [
  { label: 'Work', href: '/#work' },
  { label: 'Stack', href: '/#stack' },
  { label: 'About', href: '/#about' },
  { label: 'Nexerah', href: '/#nexerah' },
  { label: 'Contact', href: '/#contact' },
]
export const HEADER_CTA = { label: 'Get in touch', href: '/#contact' }

// Label of the pause switch in the header (WCAG 2.2.2).
export const MOTION = { pause: 'Pause animations' }

// The two roles. The status pill shows them side by side; joined, they are the line the
// share card prints and the Person description in JSON-LD.
const ROLES = ['Head of AI Engineering, ideasIQ', 'Founder, Nexerah']

export const HERO = {
  status: ROLES,
  eyebrow: ROLES.join(' · '),
  greeting: 'Hi, I’m',
  // What the h1 reads as: the greeting plus the name.
  heading: 'Hi, I’m Naman Bhayana',
  // Typed one after another in a monospace face: keep them ASCII and under 34 characters.
  roles: ['Head of AI Engineering, ideasIQ', 'Founder, Nexerah', '16 products built since 2023', 'From zero to launch'],
  rolesSummary: 'Head of AI Engineering at ideasIQ. Founder of Nexerah. 16 products built since 2023, from zero to launch.',
  lede: 'Most AI products stall somewhere between the demo and the launch. That stretch is my job: the product around the model, the data under it and the growth that gets it used.',
  primaryCta: { label: 'See the work', href: '#work' },
  secondaryCta: { label: 'Get in touch', href: '#contact' },
  trustLabel: 'Built and shipped with',
  trust: ['ideasIQ', 'InvestBeans', 'DocPad', 'SigmaBites', 'Prozone'],
  chips: {
    models: { value: '400+', label: 'models governed' },
    agent: { tag: 'AGENT', label: '14-stage research' },
    voice: 'Voice AI, live',
    launch: { from: '0', to: '1', label: 'Startups to launch' },
  },
}

export const AVATAR = {
  src: '/images/naman-bhayana-avatar.png',
  width: 1024,
  height: 1024,
  alt: 'Illustrated avatar of Naman Bhayana wearing headphones, working on a laptop',
}

// The scrolling strip under the hero, and the name screen readers are given for the list.
export const CAPABILITIES_LABEL = 'What I work on'
export const CAPABILITIES = [
  'AI agents',
  'Voice AI',
  'Retrieval systems',
  'Model governance',
  'Multi-tenant SaaS',
  'Fintech',
  'SEO and AEO',
  'Paid acquisition',
  'Social growth',
  'Outbound engines',
  'Product design',
  'Operations',
]

// Proof wall. `parts` is the figure as it is drawn: numbers count up, strings stay put.
// `value` is the same figure as plain text (llms.txt, QA, and the name a screen reader is
// given for it); `say` replaces that name where the plain text would be read out badly.
export const PROOF = {
  kicker: '01 / Proof',
  heading: { lead: 'What’s running ', em: 'today.' },
  sub: 'Figures from live products and client work. Nothing here is a projection.',
  wall: [
    {
      id: 'models',
      source: 'ideasIQ · model gateway',
      value: '400+',
      parts: [400, '+'],
      label: 'AI models governed through one gateway, with tiered access for every organisation.',
      caption: 'Each dot is a model.',
    },
    {
      id: 'signals',
      source: 'myLeadsIQ · private beta',
      value: '200+',
      parts: [200, '+'],
      label: 'buying signals read across live sources, every day.',
    },
    {
      id: 'manual',
      source: 'E-commerce clients',
      value: '30–40%',
      say: '30 to 40%',
      parts: [30, '–', 40, '%'],
      label: 'less manual work across three e-commerce operations.',
      before: 'Before',
      after: 'After',
    },
  ],
  cells: [
    { id: 'builds', value: '16', parts: [16], label: 'products built since 2023' },
    { id: 'domains', value: '10', parts: [10], label: 'domains shipped into' },
    { id: 'agent', source: 'ideasIQ', value: '14-stage', parts: [14, '-stage'], label: 'research agent on an in-house runtime' },
    { id: 'sources', source: 'myLeadsIQ', value: '11', parts: [11], label: 'live signal sources, one outbound agent' },
  ],
  domains: [
    'Enterprise AI',
    'Sales intelligence',
    'Fintech',
    'Healthcare',
    'Automotive',
    'E-commerce',
    'Recruitment',
    'Travel',
    'Gaming',
    'Robotics',
  ],
}

const GITHUB = (repo) => `${PERSON.github}/${repo}`
const site = (href, name) => ({ label: 'Site', hint: `of ${name}`, href })
const live = (href, hint) => ({ label: 'Live', hint, href })
const code = (repo, name = repo) => ({ label: 'Code', hint: `for ${name} on GitHub`, href: GITHUB(repo) })

const SAVED = '30–40% less manual work'

// Sixteen builds: the flagship, six cards, nine index rows. Numbering on the page follows this order.
// A build gets a link only when the address is live and is really its own (myLeadsIQ and DocPad have none).
// Card images are 1.91:1; `visual` names a drawn diagram for builds that have no card yet.
export const WORK = {
  kicker: '02 / Work',
  heading: { lead: 'Sixteen builds, from enterprise AI to a ', em: 'retail robot.' },
  sub: 'Platform work at ideasIQ, client engagements since 2023 and a few I built to see if I could. Most production code is private; I’ll walk through the architecture on a call.',
  flagship: {
    id: 'ideasiq',
    name: 'ideasIQ',
    tags: ['Flagship', 'Enterprise AI', 'Head of AI Engineering', '2026 – present'],
    link: { href: 'https://ideasiq.ai/', label: 'ideasiq.ai' },
    summary: 'I own the AI architecture behind a platform that takes an organisation’s ideas from raw submission to scored, strategy-ready deliverables.',
    modules: [
      'Agent runtime, built in-house',
      '14-stage research agent that challenges its own findings',
      'Model governance across a 400+ model gateway',
      'Semantic graph backbone for matching and recommendations',
      'Deliverables engine: decks, video and live websites',
      'Knowledge Assistant over a company’s own documents',
      'Voice agent that qualifies visitors and books meetings',
      'Autonomous outbound engine and the SDR team that runs it',
      'SEO and AEO growth programme',
    ],
    next: 'Next release: fine-tuned small language models',
    image: {
      src: '/work/ideasiq.webp',
      width: 800,
      height: 418,
      alt: 'ideasIQ brand card: Every idea. Heard. An AI-first idea operating system.',
    },
    stages: {
      count: 14,
      strong: '14 stages.',
      text: 'The research agent maps a market, tests what it finds and ranks what’s worth pursuing.',
    },
  },
  cards: [
    {
      id: 'myleadsiq',
      name: 'myLeadsIQ',
      tags: ['Private beta', 'Sales intelligence'],
      highlight: true,
      summary: 'Lead discovery that runs unattended across 11 live signal sources, with evidence guards that downgrade any claim the model can’t cite.',
      image: {
        src: '/work/myleadsiq.webp',
        width: 800,
        height: 418,
        alt: 'myLeadsIQ brand card: Signals, not lists. Signal-based lead intelligence.',
      },
      note: 'In private beta',
      links: [],
    },
    {
      id: 'investbeans',
      name: 'InvestBeans',
      tags: ['Fintech', 'Oct 2025 – Apr 2026'],
      summary: 'Subscription market analytics. I led engineering on the data pipelines, the indicators behind its decision tools, the dashboards and billing.',
      visual: 'chart',
      links: [{ label: 'investbeans.com', hint: '', href: 'https://investbeans.com/' }],
    },
    {
      id: 'docpad',
      name: 'DocPad',
      tags: ['Healthcare', 'Feb – Mar 2026'],
      summary: 'Cloud hospital records: an EMR on SNOMED CT terminology, OCR on medical documents and API-first exchange across hospitals and labs.',
      visual: 'doc',
      note: 'Private client build',
      links: [],
    },
    {
      id: 'prozone',
      name: 'Prozone',
      tags: ['Hardware · Automotive', 'Desktop app'],
      summary: 'A Windows app for emissions-testing centres. It reads gas analysers and smoke meters over serial and serves live readings through a local API.',
      visual: 'gas',
      links: [code('Prozone')],
    },
    {
      id: 'wandernest',
      name: 'WanderNest',
      tags: ['Client build', 'Travel marketplace'],
      summary: 'A vacation-rental marketplace. Hosts list villas and farmhouses; guests search, book and review, with live maps on every listing.',
      image: {
        src: '/work/wandernest.webp',
        width: 1200,
        height: 628,
        alt: 'WanderNest title card: a cabin by a mountain road at dusk, under a shooting star',
      },
      links: [live('https://wandernest-j69y.onrender.com/', 'site of WanderNest'), code('WanderNest')],
    },
    {
      id: 'plinko',
      name: 'Plinko',
      tags: ['Client build', 'Gaming'],
      summary: 'A real-time Plinko game. Balls fall through a peg pyramid with live physics and land on multipliers from 0.5× to 16×.',
      image: {
        src: '/work/plinko.webp',
        width: 1200,
        height: 628,
        alt: 'Plinko title card: a neon peg pyramid, web-based game',
      },
      links: [live('https://plinko-frontend-hvak.onrender.com/', 'game of Plinko'), code('Plinko')],
    },
  ],
  indexLabel: 'More builds',
  index: [
    {
      id: 'artize-dental',
      name: 'Artize Dental',
      category: 'Healthcare',
      summary: 'A web platform for a dental clinic brand, built end to end.',
      links: [],
    },
    {
      id: 'sigmabites',
      name: 'SigmaBites',
      category: 'E-commerce',
      result: SAVED,
      summary: 'Order and inventory automation for a fresh dog-food brand.',
      links: [site('https://sigmabites.com/', 'SigmaBites')],
    },
    {
      id: 'sterling-naturals',
      name: 'Sterling Naturals',
      category: 'E-commerce',
      result: SAVED,
      summary: 'Backend workflows for a beauty and personal-care store.',
      links: [site('https://sterlingnaturals.in/', 'Sterling Naturals')],
    },
    {
      id: 'new-gramophone-house',
      name: 'New Gramophone House',
      category: 'E-commerce',
      result: SAVED,
      summary: 'Storefront build and operations automation.',
      links: [site('https://newgramophonehouse.com/', 'New Gramophone House')],
    },
    {
      id: 'techlive',
      name: 'Techlive Solutions',
      category: 'Recruitment · 2024',
      summary: 'A hiring platform with real-time messaging and smarter job matching.',
      links: [],
    },
    {
      id: 'allianz-exports',
      name: 'Allianz Exports',
      category: 'Markets · 2023',
      summary: 'Trading strategies on proprietary indicators in Python and Pine Script, tuned through backtesting.',
      links: [],
    },
    {
      id: 'alphagpt',
      name: 'AlphaGPT',
      category: 'AI assistant',
      summary: 'A conversational assistant with persistent multi-thread memory and streaming replies.',
      links: [live('https://alpha-gpt-eight.vercel.app/', 'demo of AlphaGPT'), code('AlphaGPT')],
    },
    {
      id: 'jobzee',
      name: 'Jobzee',
      category: 'Recruitment',
      summary: 'A job consultancy platform connecting job seekers and employers.',
      links: [code('Jobzee')],
    },
    {
      id: 'intellishop',
      name: 'Intellishop',
      category: 'Robotics · Retail',
      summary: 'A retail automation robot: computer vision and microcontrollers handling inventory.',
      links: [code('Intellishop')],
    },
  ],
}

// Every build in page order (flagship, cards, index): llms.txt and QA read this.
export const BUILDS = [WORK.flagship, ...WORK.cards, ...WORK.index]

// Layers are listed top to bottom, as the plates are stacked.
export const STACK = {
  kicker: '03 / What I build',
  heading: { lead: 'I build the ', em: 'whole stack.' },
  sub: 'Four layers, one owner. Nothing gets lost in a handoff.',
  layers: [
    {
      name: 'Go-to-market',
      copy: 'SEO and AEO, paid acquisition, autonomous outbound and analytics. The layer that turns a launch into revenue.',
    },
    {
      name: 'Product',
      copy: 'Multi-tenant SaaS, billing and subscriptions, dashboards and API-first platforms. Built to hold at the tenant boundary.',
    },
    {
      name: 'AI systems',
      copy: 'Agent runtimes, multi-agent research pipelines, retrieval, model governance and voice agents.',
    },
    {
      name: 'Data and finance',
      copy: 'Market-data pipelines, trading strategies, analytics and the decision tools built on them.',
    },
  ],
  toolboxLabel: 'Toolbox',
  toolbox: [
    'Python',
    'TypeScript',
    'Java',
    'Next.js',
    'React',
    'Node.js',
    'FastAPI',
    'Spring',
    'PostgreSQL',
    'MongoDB',
    'Redis',
    'Kafka',
    'AWS',
    'Docker',
    'Kubernetes',
    'LangChain',
    'MCP',
    'RAG',
    'Vector search',
    'Fine-tuning',
    'Voice AI',
    'Computer vision',
  ],
}

// Bio segments let the first "ideasIQ" link to ideasiq.ai.
export const ABOUT = {
  kicker: '04 / About',
  quote: { lead: 'Thapar gave me the engineering.', rest: 'Shipping taught me the rest.' },
  bio: [
    'I lead AI engineering at ',
    { text: 'ideasIQ', href: 'https://ideasiq.ai/' },
    ' and I’m building Nexerah, my own studio. Since 2023 I’ve shipped for founders and enterprises in fintech, healthcare, e-commerce and recruitment. I’d rather be judged on what’s live than on what I say here.',
  ],
  markets:
    'Markets are the standing side interest: algorithmic trading in 2023, a fintech analytics build in 2025–26, trading systems under Nexerah next.',
  facts: ['Thapar Institute of Engineering and Technology', 'Based in Delhi NCR', 'US, EU and AU hours'],
  disclosure: 'Client work runs through Nexerah; I work with ideasIQ in my day role; nothing here is sponsored.',
  illustration: {
    src: '/images/naman-at-work.webp',
    width: 1024,
    height: 1024,
    alt: 'Isometric illustration of Naman at his desk at night, lit by a monitor and a tablet',
  },
  badge: { name: 'Naman Bhayana', line: 'Shipping since 2023' },
}

export const TIMELINE = {
  label: 'Ship log · 2023 to now',
  events: [
    { when: '2023', name: 'Allianz Exports', detail: 'Algorithmic trading strategies in Python and Pine Script' },
    { when: '2024', name: 'Techlive Solutions', detail: 'Full-stack recruitment platform' },
    { when: 'Oct 2025 – Apr 2026', name: 'InvestBeans', detail: 'Subscription market analytics, live' },
    { when: 'Feb – Mar 2026', name: 'DocPad', detail: 'Cloud hospital-records platform' },
    { when: '2026 – present', name: 'ideasIQ · myLeadsIQ', detail: 'Head of AI Engineering; myLeadsIQ in private beta' },
    {
      when: 'Next',
      name: 'Nexerah · ideasIQ',
      detail: 'Studio launch in 2026; fine-tuned small language models in the next ideasIQ release',
      next: true,
    },
  ],
}

// nexerah.com stays unlinked text until the domain answers 200.
export const NEXERAH = {
  kicker: '05 / Founder · Nexerah',
  name: 'Nexerah',
  heading: { lead: 'Nexerah builds AI products, then gets them ', em: 'used.' },
  body: 'A premium studio for businesses that want AI doing real work, not sitting in a demo. It’s the end-to-end practice I’ve run for clients since 2023, now under its own name.',
  pillars: [
    { name: 'Build', copy: 'The automations, the software and the trading systems.' },
    { name: 'Grow', copy: 'Search, paid, social and outbound, run as one programme.' },
    { name: 'One team', copy: 'From scope to shipped to sold.' },
  ],
  status: 'Launching 2026.',
  availability: 'Build and advisory engagements, a few at a time.',
  cta: { label: 'Talk to Nexerah', href: NEXERAH_MAILTO },
  domainNote: 'nexerah.com · coming soon',
}

export const CONTACT = {
  kicker: '06 / Contact',
  heading: { lead: 'Tell me what you’re ', em: 'building.' },
  body: 'I take on a small number of engagements each quarter. I read everything and reply to anything serious.',
  write: 'Write to me',
  links: [
    { label: 'LinkedIn', href: PERSON.linkedin, me: true },
    { label: 'GitHub', href: PERSON.github, me: true },
  ],
  nexerahLabel: 'Nexerah enquiries:',
  resumeLabel: 'Resume',
  microline: 'Delhi NCR · US, EU and AU hours',
  copy: { button: 'Copy email', done: 'Email address copied', fallback: 'Press Ctrl+C or Cmd+C to copy' },
}

export const FOOTER = {
  line: `© ${updatedYear} Naman Bhayana · Head of AI Engineering, ideasIQ · Founder, Nexerah · Delhi NCR`,
  links: [
    { label: 'Email', href: MAILTO },
    { label: 'LinkedIn', href: PERSON.linkedin, me: true },
    { label: 'GitHub', href: PERSON.github, me: true },
    { label: 'X', href: PERSON.x, me: true },
    { label: 'Instagram', href: PERSON.instagram, me: true },
    ...(RESUME_DRIVE_URL ? [{ label: 'Resume', href: RESUME_PATH }] : []),
    { label: 'llms.txt', href: '/llms.txt' },
  ],
}

export const SKIP_LINK = 'Skip to content'

export const NOT_FOUND = {
  title: 'Page not found',
  body: 'There is nothing at this address.',
  home: 'Go to the home page',
}

export const LLMS_SUMMARY =
  'Head of AI Engineering at ideasIQ, founder of Nexerah. I build AI products end to end — agent runtime, multi-tenant SaaS and go-to-market. Delhi NCR; US, EU and AU hours.'

// Structured data. Every value is backed by visible text on the page.
export const ENTITY = {
  jobTitle: 'Head of AI Engineering',
  employer: { id: 'https://ideasiq.ai/#organization', name: 'ideasIQ', url: 'https://ideasiq.ai' },
  employerProfile: 'https://ideasiq.ai/about#naman-bhayana',
  alumniOf: 'Thapar Institute of Engineering and Technology',
  locality: 'Delhi',
  country: 'IN',
  knowsAbout: [
    'AI agents',
    'LLM orchestration and model governance',
    'Voice AI',
    'Multi-tenant SaaS',
    'Retrieval-augmented generation',
    'Go-to-market automation',
    'Search and answer engine optimisation',
    'Algorithmic trading',
  ],
  profilePageName: 'Naman Bhayana — Head of AI Engineering',
}

export const MANIFEST = {
  name: 'Naman Bhayana',
  shortName: 'Naman Bhayana',
  description: HEAD.description,
  color: '#05070B',
}
