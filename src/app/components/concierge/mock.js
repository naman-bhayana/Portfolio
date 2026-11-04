// A scripted conversation in place of ElevenLabs, for the browser checks only: session.js uses it
// on 127.0.0.1 or localhost when localStorage['cg-mock'] is '1' and nowhere else. It speaks the
// client's language (the same callbacks and client tools; the page follows its replies as it
// follows the real agent's), so the panel cannot tell the difference.
// The lines are the approved preview's.
import { CONCIERGE as C, PERSON } from '@/content/site'

const ASK = 'Shall I pass Naman a short brief? He replies within one business day.'
const ENGAGEMENT = 'It starts with a two-week Sprint: interviews, a working prototype on your data, a running-cost model and a fixed quote. Then design, build and launch, with a written update every week. What are you working on?'
// What the visitor says in a voice run, where nobody types.
const OPENING = 'We run three online stores. Orders and stock are updated by hand every day.'
const DONE = 'No, that’s all. Thanks.'
const TRACKS = {
  automation: {
    steps: [
      {
        say: 'That’s Naman’s automation work. Three e-commerce operations now run with 30 to 40% less manual work. Is it mostly orders, stock or reporting?',
        reply: 'Orders and stock, across all three stores.',
      },
      {
        say: `Then it would start with a two-week Sprint: a map of the manual work, a working prototype on your data and a fixed quote. ${ASK}`,
        reply: 'Yes, please.',
      },
    ],
    brief: { building: 'Three online stores on one back office', stuck: 'Orders and stock are updated by hand every day', timeline: 'This quarter' },
  },
  ai: {
    steps: [
      {
        say: 'The gap between a demo and production is exactly Naman’s work. At ideasIQ every model sits behind one governed gateway, with evals on every change. What does your assistant need to handle that it can’t today?',
        reply: 'Real orders and refunds, without making things up.',
      },
      {
        say: `That’s as much an evals and guardrails problem as a model one. The two-week Sprint tests it on your own data first. ${ASK}`,
        reply: 'Yes, please.',
      },
    ],
    brief: { building: 'A customer support assistant', stuck: 'Works in demos, but isn’t trusted with real customers yet', timeline: 'Next two months' },
  },
  growth: {
    steps: [
      {
        say: 'After launch is where Naman’s growth engine starts: search, answer engines, paid and outbound, run as one programme. Who do you sell to?',
        reply: 'Mid-size logistics companies in the UK.',
      },
      {
        say: `That’s specific enough to work with. The two-week Sprint would map where those buyers look and what makes them act. ${ASK}`,
        reply: 'Yes, please.',
      },
    ],
    brief: { building: 'A product for logistics companies', stuck: 'Launched, but not enough qualified leads', timeline: 'This quarter' },
  },
}
const SAY = {
  price: 'Pricing is set up front. The Sprint has a fixed fee. Every quote after it comes in writing before anything starts. Want me to add the question to a brief for Naman?',
  job: `For anything other than a project, a short email to ${PERSON.email} is the best route. Naman reads everything.`,
  inject: 'I keep my instructions to myself. Happy to say how I’m built, though: ElevenLabs for voice and transcription, an interface Naman designed and a short brief he wrote.',
  human: 'No, I’m an AI concierge. Naman reads every brief himself and replies within one business day.',
  offtopic: 'That’s outside what I can help with here. I can tell you whether Naman can help with what you’re building, though.',
  unknown: 'Got it. Is that closest to building an AI product, automating manual work or growing after launch?',
  briefIntro: 'Here’s your brief. Check the details and send it when you’re ready.',
  briefWaiting: 'Your brief is just above. Send it when you’re ready or tell me what to change.',
  later: `No problem. You can write to ${PERSON.email} whenever you’re ready.`,
  sent: 'Sent. Naman reads every brief and replies within one business day. Anything else I can help with?',
  bye: 'Thanks for stopping by. Good luck with the build.',
}
// The example contact the card is filled with (no email in voice: the visitor types it).
const EXAMPLE = { name: 'Riya Mehta', company: 'Example Retail', email: 'riya@example.com' }
const CHIPS = Object.fromEntries(C.chips.map((chip) => [chip.label, chip.id]))

function classify(text) {
  const s = text.toLowerCase()
  if (/\b(price|prices|pricing|cost|costs|how much|fee|fees|budget|rates?)\b/.test(s)) return 'price'
  if (/\b(job|jobs|role|roles|hire|hiring|recruit\w*|cv|resume|position|full[ -]?time|vacanc\w*)\b/.test(s)) return 'job'
  if (/(ignore|instructions|system prompt|your prompt|jailbreak|pretend you)/.test(s)) return 'inject'
  if (/\b(are you (naman|human|real|a bot|a person|ai)|is this naman|who are you)\b/.test(s)) return 'human'
  if (/\b(write me|code me|do my|homework|essay)\b|\b(write|code) (a|an|some|the) (script|function|program|app)\b/.test(s)) return 'offtopic'
  if (/\b(bye|goodbye|that'?s all|that’s all|no thanks|thanks|thank you|cheers)\b/.test(s)) return 'bye'
  if (/\b(orders?|stock|inventory|manual\w*|by hand|spreadsheets?|automat\w*|back office|invoic\w*|data entry|operations)\b/.test(s)) return 'automation'
  if (/\b(ai|agents?|bot|chatbot|assistant|copilot|llms?|models?|gpt|rag|demo|production|hallucinat\w*)\b/.test(s)) return 'ai'
  if (/\b(leads?|growth|traffic|seo|marketing|sales|pipeline|launch(ed)?|outbound|ads|customers)\b/.test(s)) return 'growth'
  return 'unknown'
}
const yes = (text) => /\b(yes|yeah|yep|sure|ok|okay|please|go ahead|do it|sounds good)\b/i.test(text)

export function startMock(options) {
  const { textOnly, clientTools = {}, dynamicVariables = {}, overrides } = options
  const voice = !textOnly
  const silent = overrides?.agent?.firstMessage === ''
  const emit = (name, payload) => options[name]?.(payload)
  let open = true
  let timers = []
  let eventId = 0
  let speaking = false
  let hearing = false
  let muted = false
  let volume = 1
  let phase = 'topic'
  let track = null
  let step = 0

  const later = (fn, ms) => {
    const timer = setTimeout(() => {
      timers = timers.filter((t) => t !== timer)
      if (open) fn()
    }, ms)
    timers.push(timer)
  }

  function finish(details) {
    if (!open) return
    open = false
    timers.forEach(clearTimeout)
    timers = []
    speaking = false
    hearing = false
    if (window.__cgMock?.conversation === conversation) delete window.__cgMock
    emit('onStatusChange', { status: 'disconnected' })
    emit('onDisconnect', details)
  }

  // An agent turn: its tool call, if it has one, then the reply streamed word by word, then (in
  // voice) the time it takes to say it.
  function agent(text, { tool, then } = {}) {
    const id = ++eventId
    const words = text.split(' ')
    later(
      () => {
        tool?.()
        emit('onAgentChatResponsePart', { type: 'start', text: '', event_id: id })
        words.forEach((word, i) => later(() => emit('onAgentChatResponsePart', { type: 'delta', text: (i ? ' ' : '') + word, event_id: id }), 30 + i * 24))
        later(
          () => {
            emit('onAgentChatResponsePart', { type: 'stop', text: '', event_id: id })
            emit('onMessage', { source: 'ai', role: 'agent', message: text, event_id: id })
            if (!voice) {
              then?.()
              return
            }
            speaking = true
            emit('onModeChange', { mode: 'speaking' })
            later(() => {
              speaking = false
              emit('onModeChange', { mode: 'listening' })
              then?.()
            }, words.length * 285 + 300)
          },
          70 + words.length * 24,
        )
      },
      voice ? 350 : 480 + Math.min(700, words.length * 16),
    )
  }

  // In a voice run the visitor's side is scripted too, unless they muted or switched to typing.
  function hear(text) {
    if (!voice || muted || volume === 0) return
    later(() => {
      hearing = true
      later(() => {
        hearing = false
        emit('onMessage', { source: 'user', role: 'user', message: text, event_id: ++eventId })
        route(text)
      }, 300 + text.split(' ').length * 230)
    }, 900)
  }

  function runStep() {
    const current = TRACKS[track]
    if (step >= current.steps.length) {
      phase = 'brief'
      agent(SAY.briefIntro, {
        tool: () => clientTools.fill_brief?.({ ...EXAMPLE, ...(voice ? { email: '' } : {}), ...current.brief }),
      })
      return
    }
    const { say, reply } = current.steps[step]
    phase = 'step'
    agent(say, { then: () => hear(reply) })
  }

  function route(text) {
    if (text.startsWith('[Brief sent]')) {
      phase = 'after'
      agent(SAY.sent, { then: () => hear(DONE) })
      return
    }
    if (text.startsWith('[Brief not sent]')) {
      phase = 'after'
      agent(SAY.later)
      return
    }
    const chip = CHIPS[text]
    if (chip === 'engagement') {
      agent(ENGAGEMENT, { then: () => hear(OPENING) })
      return
    }
    if (chip) {
      agent(C.greetings[chip], { then: () => hear(OPENING) })
      return
    }
    if (phase === 'step' && yes(text)) {
      step += 1
      runStep()
      return
    }
    const kind = classify(text)
    if (['price', 'job', 'inject', 'human', 'offtopic'].includes(kind)) {
      agent(SAY[kind])
      return
    }
    if (kind === 'bye' || (phase === 'after' && /\b(no|nope|nothing|all good)\b/i.test(text))) {
      agent(SAY.bye, { then: () => later(() => finish({ reason: 'agent' }), 400) })
      return
    }
    if (phase === 'topic' || phase === 'after') {
      if (TRACKS[kind]) {
        track = kind
        step = 0
        runStep()
        return
      }
      phase = 'topic'
      agent(SAY.unknown)
      return
    }
    if (phase === 'step') {
      step += 1
      runStep()
      return
    }
    agent(phase === 'brief' ? SAY.briefWaiting : SAY.unknown)
  }

  const conversation = {
    getId: () => 'mock',
    isOpen: () => open,
    sendUserMessage: (text) => open && route(String(text)),
    sendContextualUpdate: () => {},
    sendUserActivity: () => {},
    setMicMuted: (value) => {
      muted = !!value
    },
    setVolume: ({ volume: value }) => {
      volume = value
    },
    getInputVolume: () => (hearing && !muted ? 0.12 + 0.14 * Math.abs(Math.sin(performance.now() / 70)) : 0),
    getOutputVolume: () => (speaking && volume > 0 ? 0.14 + 0.16 * Math.abs(Math.sin(performance.now() / 95)) : 0),
    endSession: () => {
      finish({ reason: 'user' })
      return Promise.resolve()
    },
  }

  emit('onStatusChange', { status: 'connecting' })
  return new Promise((resolve) => {
    setTimeout(() => {
      emit('onStatusChange', { status: 'connected' })
      emit('onConnect', { conversationId: 'mock' })
      if (voice) emit('onModeChange', { mode: 'listening' })
      // For the browser checks: the panel's own client tools, to call as the agent would
      // (window.__cgMock.tools.fill_brief({ ... })), a way to make the agent say something
      // (window.__cgMock.say('DocPad keeps hospital records'), which the page follows), and the
      // variables the agent would have been given.
      window.__cgMock = { conversation, tools: clientTools, say: (text) => agent(String(text)), vars: { ...dynamicVariables } }
      resolve(conversation)
      if (!silent) agent(dynamicVariables.greeting || C.greetings.launcher, { then: () => hear(OPENING) })
    }, 450)
  })
}
