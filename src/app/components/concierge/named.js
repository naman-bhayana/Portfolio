// The page follows what the agent says. A reply that names a figure, a build, a practice, the
// Sprint, the terms or the email brings that part of the page up: one part a reply, the most
// specific it names (a figure before a build, a build before a practice). A reply that names
// more than one practice shows the studio, where all three are. The agent never decides this, so
// a turn is one reply, with nothing for the page to wait on (2026-10-20: a tool call after words
// made the platform ask the model again, and the second answer could repeat the first).
// Plain data and one function, with no imports, so a script can check replies against it.

// The keys are tools.js's TARGETS. The phrases are the knowledge base's, in the agent's words.
const NAMED = [
  ['figure_400_models', /\b400\s*(\+|plus)?\s*(AI\s+)?models\b/i],
  ['figure_200_signals', /\b200\s*(\+|plus)?\s*(buying\s+)?signals\b/i],
  ['figure_30_40_manual_work', /\b30\s*(to|-|–)\s*40\s*(%|per\s?cent)/i],
  ['figure_14_stage_agent', /\b(14|fourteen)[\s-]stage\b/i],
  ['figure_11_sources', /\b(11|eleven)\s+(live\s+)?signal\s+sources\b/i],
  ['myleadsiq', /\bmyLeadsIQ\b/i],
  ['ideasiq', /\bideasIQ\b/i],
  ['investbeans', /\bInvestBeans\b/i],
  ['docpad', /\bDocPad\b/i],
  ['prozone', /\bProzone\b/i],
  ['artize_dental', /\bArtize\b/i],
  ['more_builds', /\b(sixteen|16)\s+builds\b/i],
]
const PRACTICES = [
  ['practice_ai_products', /\bAI products?\b/i],
  ['practice_automation', /\bautomat(ion|e|es|ed|ing)\b/i],
  ['practice_growth', /\b(growth engine|grow(th|ing) after launch)\b/i],
]
const MENTIONED = [
  ['step_sprint', /\bSprint\b/],
  ['terms', /\b(master services agreement|statements? of work|mutual NDA|data processing agreement)\b/i],
  ['contact', /\bnaman(@| at )nexerah(\.| dot )com\b/i],
  ['node_evals', /\bevals on every change\b/i],
  ['node_model_gateway', /\bmodel gateway\b/i],
  ['studio', /\bNexerah\b/i],
]

// The part of the page a reply names, or null.
export function named(text) {
  const reply = String(text ?? '')
  const item = NAMED.find(([, pattern]) => pattern.test(reply))
  if (item) return item[0]
  const practices = PRACTICES.filter(([, pattern]) => pattern.test(reply))
  if (practices.length) return practices.length === 1 ? practices[0][0] : 'studio'
  return MENTIONED.find(([, pattern]) => pattern.test(reply))?.[0] ?? null
}
