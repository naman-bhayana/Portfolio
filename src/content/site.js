// Every visible and machine-read string on the site lives here, so the page, metadata,
// structured data, llms.txt, sitemap, OG card and footer cannot drift apart.
//
// Characters matter: apostrophes are typographic (’), separators a middle dot (·), and no
// dash of any kind stands between words: ranges are written "30-40%" or "2023 to 2024".
// Spelling is British. Figures come from live products and client work: add a number here
// only when it is already public.
// Pure data only: Node scripts (OG card, QA checks) import this file too.

export const SITE_URL = 'https://www.namanbhayana.com'

// Date of the last content change. Bump on every edit: it feeds ProfilePage.dateModified,
// the sitemap's lastmod and the footer year.
export const UPDATED = '2026-10-15'

const [updatedYear] = UPDATED.split('-').map(Number)

export const PERSON = {
  name: 'Naman Bhayana',
  firstName: 'Naman',
  lastName: 'Bhayana',
  initials: 'NB',
  // The one address on the site: the studio's.
  email: 'naman@nexerah.com',
  linkedin: 'https://www.linkedin.com/in/namanbhayana007/',
  github: 'https://github.com/naman-bhayana',
  x: 'https://x.com/bhayana_naman',
  instagram: 'https://www.instagram.com/naman_bhayana/',
}

// The studio's site. The page links it. Its Organization node joins the structured data only
// once NEXERAH_LIVE is true: flip it when https://nexerah.com/ answers 200 (verify-site checks).
export const NEXERAH_URL = 'https://nexerah.com/'
export const NEXERAH_LIVE = false

// A pre-filled subject makes inbound mail countable without any analytics script; the body
// prompts for the four things a first reply needs.
const MAIL_BODY = ['What you’re building:', 'Where it’s stuck:', 'Timeline:', 'How you found me:'].join('\n')
export const MAILTO = `mailto:${PERSON.email}?subject=${encodeURIComponent('Enquiry via namanbhayana.com')}&body=${encodeURIComponent(MAIL_BODY)}`

// Résumé lives on Google Drive; /resume redirects there (next.config.js). Use the Drive *file*
// link and update the file with Drive's "Manage versions" so this URL never changes.
// While it is empty there is no /resume redirect and every Resume link is left out.
export const RESUME_DRIVE_URL = ''
export const RESUME_PATH = '/resume'

export const HEAD = {
  title: 'Naman Bhayana | Head of AI Engineering, ideasIQ · Founder, Nexerah',
  description:
    'Head of AI Engineering at ideasIQ and founder of Nexerah. I take AI products from a working demo to a product people use: agents, retrieval and model governance. Delhi NCR.',
}

export const OG_IMAGE = {
  url: '/og/naman-bhayana-og.png',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'Naman Bhayana, Head of AI Engineering at ideasIQ and founder of Nexerah',
}
export const SHARE = {
  title: 'Naman Bhayana · Enterprise AI, demo to deployed',
  ogDescription: 'Head of AI Engineering at ideasIQ and founder of Nexerah. Agents, retrieval and model governance, built for enterprises and shipped.',
  twitterDescription: 'Head of AI Engineering at ideasIQ. Founder of Nexerah.',
}

export const NAV = [
  { label: 'Work', href: '/#work' },
  { label: 'Stack', href: '/#stack' },
  { label: 'Studio', href: '/#nexerah' },
  { label: 'About', href: '/#about' },
  { label: 'Contact', href: '/#contact' },
]
export const HEADER_CTA = { label: 'Get in touch', href: '/#contact' }

// Label of the pause switch in the header (WCAG 2.2.2).
export const MOTION = { pause: 'Pause animations' }

// The two roles. Joined, they are the line the footer and the share card print and the
// Person description in JSON-LD.
const ROLES = ['Head of AI Engineering, ideasIQ', 'Founder, Nexerah']

export const HERO = {
  eyebrow: ROLES.join(' · '),
  greeting: 'Hi, I’m',
  // What the h1 reads as: the greeting plus the name.
  heading: 'Hi, I’m Naman Bhayana',
  // Typed one after another in a monospace face: keep them ASCII and under 34 characters.
  roles: [...ROLES, 'Enterprise AI, demo to deployed', 'Agents, retrieval, governance'],
  rolesSummary:
    'Head of AI Engineering at ideasIQ. Founder of Nexerah. Enterprise AI products, from demo to deployed: agents, retrieval and model governance.',
  lede: 'Most AI products stall somewhere between the demo and the launch. That stretch is my job.',
  primaryCta: { label: 'See the work', href: '#work' },
  secondaryCta: { label: 'Get in touch', href: '#contact' },
  chips: { runtime: 'In-house agent runtime', voice: 'Voice AI, live' },
}

export const AVATAR = {
  src: '/images/naman-bhayana-avatar.png',
  width: 1024,
  height: 1024,
  alt: 'Illustrated avatar of Naman Bhayana wearing headphones, working on a laptop',
}

// The client wall: the hero's closing band. Marks only; the descriptor shows on hover and is
// always there for a screen reader. Files are each mark's optical box (public/logos), so
// centring the file centres the mark; the heights that give them equal weight are in wall.css.
export const WALL = {
  label: 'Built and shipped with',
  marks: [
    { id: 'ideasiq', name: 'ideasIQ', desc: 'Enterprise AI', file: '/logos/ideasiq.svg', width: 1306, height: 327 },
    { id: 'investbeans', name: 'InvestBeans', desc: 'Market analytics', file: '/logos/investbeans.png', width: 1509, height: 271 },
    { id: 'artize', name: 'Artize Dental', desc: 'Cosmetic dentistry', file: '/logos/artize.png', width: 2252, height: 314 },
    { id: 'docpad', name: 'DocPad', desc: 'Hospital records', file: '/logos/docpad.png', width: 1041, height: 250 },
    { id: 'prozone', name: 'Prozone', desc: 'Emissions testing', file: '/logos/prozone.png', width: 1493, height: 204 },
    { id: 'myleadsiq', name: 'myLeadsIQ', desc: 'Sales intelligence', file: '/logos/myleadsiq.png', width: 1643, height: 336 },
    { id: 'sigmabites', name: 'SigmaBites', desc: 'Fresh dog food', file: '/logos/sigmabites.png', width: 2079, height: 240 },
    { id: 'sterlingnaturals', name: 'Sterling Naturals', desc: 'Personal care', file: '/logos/sterlingnaturals.png', width: 608, height: 228 },
    { id: 'newgramophone', name: 'New Gramophone House', desc: 'Music retail', file: '/logos/newgramophone.png', width: 1772, height: 367 },
    { id: 'techlive', name: 'Techlive Solutions', desc: 'Recruitment', file: '/logos/techlive.png', width: 828, height: 375 },
    { id: 'wandernest', name: 'WanderNest', desc: 'Travel marketplace', file: '/logos/wandernest.png', width: 1417, height: 290 },
    { id: 'plinko', name: 'Plinko', desc: 'Real-time game', file: '/logos/plinko.png', width: 1068, height: 211 },
    { id: 'allianzexports', name: 'Allianz Exports', desc: 'Trading systems', file: '/logos/allianzexports.png', width: 2108, height: 304 },
  ],
}

// The scrolling strip under the wall, and the name screen readers are given for the list.
export const CAPABILITIES_LABEL = 'What I work on'
export const CAPABILITIES = [
  'AI agents',
  'Agent runtimes',
  'Voice AI',
  'Retrieval systems',
  'Fine-tuning',
  'Small language models',
  'Model governance',
  'Evidence guards',
  'Multi-tenant SaaS',
  'Go-to-market',
]

// Proof. `parts` is the figure as it is drawn: numbers count up, strings stay put. `value` is
// the same figure as plain text (llms.txt, QA, and the name a screen reader is given for it);
// `say` replaces that name where the plain text would be read out badly. The one figure in
// `wall` has the stage; the four in `cells` follow it. These are the only figures on the page.
// `llms`, here and in WORK, is a first-person line turned into the third person for llms.txt,
// where "I" would be nobody: that file describes him, the page speaks as him.
export const PROOF = {
  heading: { lead: 'What’s running ', em: 'today.' },
  sub: 'Figures from live products and client work. Nothing here is a projection.',
  wall: [
    {
      id: 'models',
      source: 'ideasIQ · model gateway',
      value: '400+',
      parts: [400, '+'],
      label: 'models behind one gateway I architected. Every organisation gets its own access tier and policy is set once for all of them.',
      llms: 'models behind one gateway he architected. Every organisation gets its own access tier and policy is set once for all of them.',
      caption: 'Each dot is a model.',
    },
  ],
  cells: [
    {
      id: 'signals',
      source: 'myLeadsIQ · private beta',
      value: '200+',
      parts: [200, '+'],
      label: 'buying signals read every day, unattended.',
      bars: 11,
    },
    {
      id: 'manual',
      source: 'E-commerce clients',
      value: '30-40%',
      say: '30 to 40%',
      parts: [30, '-', 40, '%'],
      label: 'less manual work across three e-commerce operations.',
    },
    {
      id: 'agent',
      source: 'ideasIQ',
      value: '14-stage',
      parts: [14, '-stage'],
      label: 'research agent on an in-house runtime. It challenges its own findings before it ranks them.',
    },
    {
      id: 'sources',
      source: 'myLeadsIQ',
      value: '11',
      parts: [11],
      label: 'live signal sources behind one outbound agent.',
    },
  ],
}

// Sixteen builds: the flagship, five cases, ten index rows in six groups. Page order follows
// this order. A build gets a link only when the address is live and is really its own.
// Wordmarks come from the wall's files; card images are 1.91:1.
const mark = (id) => WALL.marks.find((m) => m.id === id)

export const WORK = {
  heading: { lead: 'Shipped, not ', em: 'pitched.' },
  sub: 'Enterprise platform work at ideasIQ and client builds for founders and enterprise teams. Most of the code is private; I’m glad to walk through any architecture on a call.',
  flagship: {
    id: 'ideasiq',
    name: 'ideasIQ',
    tags: ['Flagship', 'Enterprise AI', 'Enterprise SaaS', 'Multi-tenant', 'Head of AI Engineering'],
    link: { href: 'https://ideasiq.ai/', label: 'ideasiq.ai' },
    summary:
      'I lead the engineering team at ideasIQ and own the AI architecture behind a platform that takes an organisation’s ideas from raw submission to scored, strategy-ready deliverables.',
    llms: 'He leads the engineering team at ideasIQ and owns the AI architecture behind a platform that takes an organisation’s ideas from raw submission to scored, strategy-ready deliverables.',
    modules: [
      'Agent runtime, built in-house',
      'Multi-agent research pipeline',
      'Model governance gateway with per-organisation access tiers',
      'Semantic graph backbone for matching and recommendations',
      'Deliverables engine: decks, video and live websites',
      'Knowledge Assistant over a company’s own documents',
      'Voice agent that qualifies visitors and books meetings',
      'Autonomous outbound engine',
      'SEO and AEO growth programme',
    ],
    team: { label: 'Listed on the ideasIQ team page', href: 'https://ideasiq.ai/about#who-we-are' },
    image: {
      src: '/work/ideasiq.webp',
      width: 800,
      height: 418,
      alt: 'The ideasIQ brand card: the IQ monogram on yellow beside the wordmark and the line Every idea. Heard.',
    },
    stages: {
      count: 14,
      text: 'The research agent maps a market, tests what it finds and ranks what’s worth pursuing.',
    },
  },
  cards: [
    {
      id: 'myleadsiq',
      name: 'myLeadsIQ',
      mark: mark('myleadsiq'),
      tags: ['Enterprise SaaS', 'Sales intelligence', 'Private beta'],
      mech: 'Lead discovery on live buying signals, with evidence guards that downgrade any claim the model can’t cite.',
      image: {
        src: '/work/myleadsiq.webp',
        width: 800,
        height: 418,
        alt: 'The myLeadsIQ brand card: Signals, not lists, beside a radar of buying signals',
      },
      links: [],
    },
    {
      id: 'investbeans',
      name: 'InvestBeans',
      mark: mark('investbeans'),
      tags: ['Fintech', 'Market analytics', 'Live'],
      role: 'Subscription market analytics.',
      mech: 'I led engineering on the data pipelines, the indicators behind its decision tools and billing.',
      llms: 'Subscription market analytics. He led engineering on the data pipelines, the indicators behind its decision tools and billing.',
      links: [{ label: 'investbeans.com', href: 'https://investbeans.com/' }],
    },
    {
      id: 'docpad',
      name: 'DocPad',
      mark: mark('docpad'),
      tags: ['Healthcare', 'Private client build'],
      role: 'Cloud hospital records.',
      mech: 'An EMR on SNOMED CT terminology, OCR on medical documents and API-first exchange across hospitals and labs.',
      links: [],
    },
    {
      id: 'prozone',
      name: 'Prozone',
      mark: mark('prozone'),
      tags: ['Industrial', 'Hardware integration'],
      role: 'A 2021 Electron app that emissions-testing centres run their gas analysers and smoke meters through.',
      mech: 'I brought it back into service: Node 20 and current serial drivers, the smoke meter’s 53-byte frame and reliable port resets.',
      llms: 'A 2021 Electron app that emissions-testing centres run their gas analysers and smoke meters through. He brought it back into service: Node 20 and current serial drivers, the smoke meter’s 53-byte frame and reliable port resets.',
      links: [],
    },
    {
      id: 'artize-dental',
      name: 'Artize Dental',
      mark: mark('artize'),
      tags: ['Healthcare', 'Client build'],
      mech: 'Brand site for a cosmetic dentistry clinic in Delhi, built end to end.',
      links: [{ label: 'artizeclinic.com', href: 'https://www.artizeclinic.com/' }],
    },
  ],
  indexLabel: 'All sixteen, on the record',
  index: [
    {
      builds: [
        { id: 'sigmabites', name: 'SigmaBites' },
        { id: 'sterling-naturals', name: 'Sterling Naturals' },
        { id: 'new-gramophone-house', name: 'New Gramophone House' },
      ],
      sector: 'E-commerce',
      summary:
        'Order, inventory and back-office automation for three e-commerce brands: a fresh dog-food label, a beauty and personal-care store and a music retailer.',
    },
    {
      builds: [{ id: 'techlive', name: 'Techlive Solutions' }],
      sector: 'Recruitment',
      summary: 'A hiring platform with real-time messaging and smarter job matching.',
    },
    {
      builds: [{ id: 'allianz-exports', name: 'Allianz Exports' }],
      sector: 'Markets',
      summary: 'Trading strategies on proprietary indicators in Python and Pine Script, tuned through backtesting.',
    },
    {
      builds: [{ id: 'wandernest', name: 'WanderNest' }],
      sector: 'Travel',
      summary: 'A vacation-rental marketplace with listings, search, booking, reviews and live maps.',
    },
    {
      builds: [{ id: 'plinko', name: 'Plinko' }],
      sector: 'Gaming',
      summary: 'A real-time physics game in the browser.',
    },
    {
      builds: [
        { id: 'alphagpt', name: 'AlphaGPT' },
        { id: 'jobzee', name: 'Jobzee' },
        { id: 'intellishop', name: 'Intellishop' },
      ],
      sector: 'University projects at Thapar',
      summary: 'A chat assistant with persistent memory, a job platform and a team-built retail inventory robot.',
    },
  ],
}

// Every build in page order (flagship, cases, index): llms.txt and QA read this. A case reads
// as its role line and its mechanism line; an index build as its group's line.
export const BUILDS = [
  WORK.flagship,
  ...WORK.cards.map((card) => ({ ...card, summary: [card.role, card.mech].filter(Boolean).join(' ') })),
  ...WORK.index.flatMap((row) => row.builds.map((build) => ({ ...build, category: row.sector, summary: row.summary, links: [] }))),
]

// The rail: what every build runs on, read left to right.
export const INFRA = {
  heading: { lead: 'Built like infrastructure, ', em: 'not a demo.' },
  sub: 'I build the whole stack. Every layer of it is the one I run in production at ideasIQ: tiered access for every organisation on it, evals on every change, your cloud and your keys.',
  nodes: [
    { name: 'Your data', copy: 'Documents, CRM, orders, tickets, calls. Read where it lives.' },
    { name: 'Ingest and retrieval', copy: 'Chunking, embeddings and a semantic graph for matching.' },
    { name: 'Agent runtime', copy: 'In-house. Typed tool contracts, step limits, checkpoints.' },
    { name: 'Evals and guardrails', copy: 'Run on every change. A claim the model cannot cite is downgraded.' },
    { name: 'Model gateway', copy: '400+ models, tiered access, routed by eval score and cost.' },
    { name: 'Observability', copy: 'Traces, budgets per tenant, a kill switch.' },
    { name: 'Deliverables', copy: 'Decks, video, live sites, voice, outbound.' },
    { name: 'Your cloud', copy: 'Your accounts, your keys. Assigned to you on payment.' },
  ],
  everyLabel: 'Every build',
  every: ['Typed tool contracts', 'Evals on every change', 'A running-cost model', 'Your cloud, your keys', 'A written update every week'],
  toolboxLabel: 'Toolbox',
  toolbox: ['Python', 'TypeScript', 'Next.js', 'React', 'Node.js', 'FastAPI', 'PostgreSQL', 'MongoDB', 'Redis', 'AWS', 'Docker', 'LangChain', 'MCP'],
}

// The studio. Prices stay on nexerah.com; this page says they are set up front and links.
export const STUDIO = {
  name: 'Nexerah',
  heading: { lead: 'Nexerah builds the production AI an enterprise runs on, then gets it ', em: 'used.' },
  body: 'Nexerah is my studio: founder-led, in Delhi NCR, with clients worldwide. One founder on every call, specialists per project and the paperwork of a company you can buy from.',
  link: { label: 'nexerah.com', href: NEXERAH_URL },
  practices: [
    {
      name: 'AI products and agents',
      copy: 'Agents, copilots and AI platforms that hold up against real users, real data and real bills, with a person stepping in exactly where one should.',
      seen: 'Seen in ideasIQ · myLeadsIQ',
    },
    {
      name: 'Automation',
      copy: 'The manual work in your operations, handed to software that does not take weekends off. Map the process, cut the steps that should not exist, automate what is left.',
      seen: 'Seen in DocPad · three e-commerce operations',
    },
    {
      name: 'Growth engine',
      copy: 'Launch is the start. Then it gets found, cited and bought: search, answer engines, paid and outbound, run as one programme against numbers you can see every week.',
      seen: 'Seen in ideasIQ · myLeadsIQ',
    },
  ],
  methodHeading: 'Two weeks to certainty. Then we build.',
  steps: [
    { name: 'Sprint', when: '2 weeks', what: 'Interviews, a map of the repetitive work, a working prototype on your data, a running-cost model and a fixed quote.' },
    { name: 'Design', when: '1 to 2 weeks', what: 'Map the workflow, remove the steps that should not exist, simplify. Product, brand and architecture drawn together.' },
    { name: 'Build', when: '6 to 10 weeks', what: 'Working software in your repos as we build, evals on every change, a written update every week.' },
    { name: 'Launch', when: '1 week', what: 'Product, site, analytics and first campaigns go live together.' },
    { name: 'Grow', when: 'Monthly', what: 'Search, answer engines, paid and outbound, run against numbers you can see.' },
  ],
  priced: 'Priced up front: the Sprint fee is published and every quote after it comes in writing before anything starts.',
  pricedLink: { label: 'Engagements on nexerah.com', href: NEXERAH_URL },
  terms: [
    { name: 'Contracts', copy: 'A master services agreement, statements of work, a mutual NDA and a data processing agreement, ready to sign.' },
    { name: 'Ownership', copy: 'Code, designs, accounts and intellectual property are assigned to you on payment. Nothing is held back.' },
    { name: 'Data', copy: 'Built in your cloud, under your keys. Your data never trains a model you have not approved.' },
    { name: 'Reply', copy: 'Every brief is answered by me within one business day, with questions or a time to talk.' },
  ],
}

// Bio segments let the first "ideasIQ" link to ideasiq.ai.
export const ABOUT = {
  quote: { lead: 'Thapar gave me the engineering.', rest: 'Shipping taught me the rest.' },
  person: 'The person on the call is the person who builds.',
  bio: [
    'I lead AI engineering at ',
    { text: 'ideasIQ', href: 'https://ideasiq.ai/' },
    ' and run Nexerah, my studio. I’ve shipped sixteen products across enterprise AI, fintech, healthcare, e-commerce and industrial hardware. I’d rather be judged on what’s live than on what I say here.',
  ],
  facts: ['Thapar Institute of Engineering and Technology', 'Delhi NCR', 'US, EU and AU hours'],
  disclosure: 'Client work runs through Nexerah; I work with ideasIQ in my day role; nothing here is sponsored.',
  portrait: {
    src: '/images/naman-bhayana-portrait.webp',
    width: 1000,
    height: 1250,
    alt: 'Naman Bhayana, smiling, in a navy sweater',
  },
  caption: { name: 'Naman Bhayana', line: 'Head of AI Engineering, ideasIQ' },
}

// The page's only dates.
export const TIMELINE = {
  label: 'Ship log · 2023 to now',
  events: [
    { when: '2023 to 2024', who: 'Allianz Exports, Techlive Solutions', what: 'Trading strategies in Python, then a recruitment platform' },
    { when: '2025 to 2026', who: 'InvestBeans, DocPad', what: 'Market analytics, then cloud hospital records' },
    { when: '2026 to now', who: 'ideasIQ, myLeadsIQ', what: 'Head of AI Engineering; fine-tuning and small language models' },
  ],
}

export const CONTACT = {
  heading: { lead: 'Bring me the ', em: 'hard one.' },
  body: 'I take on a small number of engagements each quarter. I read everything and reply within one business day.',
  extra: 'A few lines on what you’re building and where it’s stuck is enough.',
  write: 'Write to me',
  resumeLabel: 'Resume',
  microline: 'NDA before we talk, if you want one. Delhi NCR · US, EU and AU hours.',
  copy: { button: 'Copy', copied: 'Copied', hint: 'email address', done: 'Email address copied', fallback: 'Press Ctrl+C or Cmd+C to copy' },
}

// The concierge, shown only when NEXT_PUBLIC_CONCIERGE is 'on': an AI assistant that answers by
// voice or text, shows the part of the page it talks about and passes Naman a brief. The
// launcher and the Contact entry are drawn from `launcher`, `peek`, `chips` and `entry`; the
// panel loads on intent and reads the rest. `places` names the parts of the page the concierge
// can show and `areas` the parts get_page_context reports to the agent.
// The agent itself (prompt, knowledge, voice) is configured outside this repo.
export const CONCIERGE = {
  launcher: {
    label: 'Talk to my concierge, an AI assistant, by voice or text',
    name: 'Talk to my concierge',
    tag: 'AI · voice or text',
  },
  peek: { label: 'Quick questions', hide: 'Hide quick questions' },
  chips: [
    { id: 'help', label: 'How can Naman help me?' },
    { id: 'problem', label: 'Here’s my problem' },
    { id: 'engagement', label: 'How does an engagement work?' },
  ],
  entry: { lead: 'Not sure it’s a fit yet?', em: 'Talk it through with my AI concierge first.', talk: 'Talk instead' },
  title: 'Naman’s concierge',
  close: 'Close the concierge',
  hello: { lead: 'Tell me what you’re building.', em: 'I’ll tell you how Naman can help.' },
  talk: 'Talk',
  type: 'Type',
  // Shown on the start screen, in the microphone explainer, and at the top of every conversation
  // until the visitor's first turn.
  consent:
    'An AI assistant, not Naman. ElevenLabs transcribes the conversation and deletes it after 30 days. Naman gets a copy by email so he can reply. Please don’t share anything sensitive.',
  log: 'Conversation',
  input: { label: 'Message the concierge', placeholder: 'Write a message', send: 'Send' },
  // The mute button keeps its name; aria-pressed says whether it is on.
  controls: {
    toVoice: 'Switch to voice',
    toText: 'Switch to typing',
    mute: 'Mute the microphone',
    end: 'End the conversation',
  },
  status: {
    ready: 'AI assistant · ready',
    text: 'AI assistant · text',
    typing: 'Typing',
    connecting: 'Connecting',
    listening: 'Listening',
    speaking: 'Speaking',
    thinking: 'Thinking',
    muted: 'Muted',
    blocked: 'Microphone blocked',
    resting: 'Resting',
  },
  // The agent's first line, passed to it as {{greeting}}. A chip in text mode has none: the chip
  // is sent as the visitor's first message instead.
  greetings: {
    launcher: 'Hi, I’m Naman’s AI concierge. What are you working on?',
    help: 'Happy to. What does your company do and what would you fix first?',
    problem: 'Go ahead, I’m listening. What’s the problem and what does your team do?',
    resume: 'I’m listening. Go ahead.',
  },
  mic: {
    title: 'One permission first',
    text: 'Your browser will ask to use your microphone. Nothing is heard until you allow it. You can switch to typing at any time.',
    allow: 'Allow microphone',
  },
  blocked: {
    title: 'Microphone blocked',
    text: 'Your browser is blocking the microphone. Allow it from the icon in the address bar or keep going by typing.',
  },
  nomic: { title: 'No microphone found', text: 'Your browser can’t find a microphone. Connect one and try again. Typing works too.' },
  busy: { title: 'Microphone busy', text: 'Another app is using the microphone. Close it and try again. Typing works too.' },
  typeInstead: 'Type instead',
  retry: 'Try again',
  resting: {
    title: 'The concierge is resting',
    text: 'It’s taking a break right now. Write to Naman instead and he’ll reply within one business day.',
    copy: 'Copy the address',
    copied: 'Address copied',
  },
  brief: {
    heading: 'Your brief for Naman',
    name: 'Name',
    company: 'Company',
    email: 'Email',
    building: 'What you’re building',
    stuck: 'Where it’s stuck',
    timeline: 'Timeline',
    send: 'Send to Naman',
    later: 'Not now',
    note: `It goes to ${PERSON.email}, with your email as the reply address.`,
    noName: 'Add your name so Naman knows who to reply to.',
    noEmail: 'That email doesn’t look complete. Check it and send again.',
    sent: 'Brief sent to Naman',
    sentLine: 'He reads every brief and replies within one business day.',
  },
  ended: 'Conversation ended',
  callEnded: 'Call ended',
  again: 'Start again',
  // Shown in the conversation when the concierge scrolls the page: "On screen · The Sprint".
  shown: 'On screen',
  places: {
    top: 'The opening',
    proof: 'Live figures',
    figure_400_models: '400+ models behind one gateway',
    figure_200_signals: '200+ buying signals a day',
    figure_30_40_manual_work: '30 to 40% less manual work',
    figure_14_stage_agent: 'The 14-stage research agent',
    figure_11_sources: '11 live signal sources',
    work: 'The work',
    ideasiq: 'ideasIQ',
    myleadsiq: 'myLeadsIQ',
    investbeans: 'InvestBeans',
    docpad: 'DocPad',
    prozone: 'Prozone',
    artize_dental: 'Artize Dental',
    more_builds: 'All sixteen builds',
    stack: 'The stack',
    node_evals: 'Evals and guardrails',
    node_model_gateway: 'Model gateway',
    studio: 'Nexerah',
    practice_ai_products: 'AI products and agents',
    practice_automation: 'Automation',
    practice_growth: 'Growth engine',
    method: 'How an engagement runs',
    step_sprint: 'The Sprint',
    terms: 'The terms',
    about: 'About Naman',
    contact: 'Contact',
  },
  areas: {
    top: 'the opening',
    wall: 'the wall of clients',
    proof: 'the live figures',
    work: 'the work',
    stack: 'the stack',
    studio: 'the studio',
    about: 'about Naman',
    contact: 'contact',
  },
  // What the agent hears when the visitor answers the brief card (session.js writes the sent
  // one), and the context a new session gets when the visitor switches between typing and talking.
  notSent: '[Brief not sent] The visitor chose not to send it yet.',
  switched: 'The visitor switched between typing and talking. The conversation so far:',
  visitor: 'Visitor',
  agent: 'Concierge',
}

export const FOOTER = {
  line: `© ${updatedYear} Naman Bhayana`,
  roles: HERO.eyebrow,
  links: [
    { label: 'nexerah.com', href: NEXERAH_URL },
    { label: 'Email', href: MAILTO },
    { label: 'LinkedIn', href: PERSON.linkedin, me: true },
    { label: 'GitHub', href: PERSON.github, me: true },
    { label: 'X', href: PERSON.x, me: true },
    { label: 'Instagram', href: PERSON.instagram, me: true },
    ...(RESUME_DRIVE_URL ? [{ label: 'Resume', href: RESUME_PATH }] : []),
  ],
}

export const SKIP_LINK = 'Skip to content'

export const NOT_FOUND = {
  title: 'Page not found',
  body: 'There is nothing at this address.',
  home: 'Go to the home page',
}

export const LLMS_SUMMARY =
  'Naman Bhayana is Head of AI Engineering at ideasIQ and the founder of Nexerah, an AI studio for enterprises. He takes AI products from a working demo to a product people use: agents, retrieval and model governance. Delhi NCR; US, EU and AU hours.'

// Structured data. Every value is backed by visible text on the page.
export const ENTITY = {
  jobTitle: 'Head of AI Engineering',
  employer: { id: 'https://ideasiq.ai/#organization', name: 'ideasIQ', url: 'https://ideasiq.ai' },
  employerProfile: 'https://ideasiq.ai/about#who-we-are',
  studio: { id: `${NEXERAH_URL}#organization`, name: 'Nexerah', url: NEXERAH_URL },
  alumniOf: 'Thapar Institute of Engineering and Technology',
  locality: 'Delhi',
  country: 'IN',
  knowsAbout: ['AI agents', 'Agent runtimes', 'Retrieval systems', 'Model governance', 'Voice AI', 'Multi-tenant SaaS', 'Go-to-market'],
  profilePageName: 'Naman Bhayana, Head of AI Engineering',
}

export const MANIFEST = {
  name: 'Naman Bhayana',
  shortName: 'Naman Bhayana',
  description: HEAD.description,
  color: '#05070B',
}
