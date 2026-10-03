import { PROOF, PROOF_HEADING } from '@/content/site'

// Static numbers, number first in the DOM so the reading order matches what is seen.
// Never wrapped in the scroll reveal and never animated (spec §3.6). The heading is for
// screen readers and for anything that splits the page by headings.
export default function ProofStrip() {
  return (
    <section id="proof" aria-labelledby="proof-heading" className="border-y border-line">
      <h2 id="proof-heading" className="sr-only">
        {PROOF_HEADING}
      </h2>
      <div className="container-page">
        <dl className="proof">
          {PROOF.map((item) => (
            <div key={item.value}>
              <dt className="text-stat font-semibold">{item.value}</dt>
              <dd className="mt-2 text-sm text-muted">{item.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
