import { PROOF } from '@/content/site'

// Static numbers, number first in the DOM so the reading order matches what is seen.
// Never wrapped in the scroll reveal and never animated (spec §3.6).
export default function ProofStrip() {
  return (
    <div id="proof" className="border-y border-line">
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
    </div>
  )
}
