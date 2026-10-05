// Kicker, heading with one emphasised tail, and an optional aside. The section it opens
// points at `id` with aria-labelledby.
export default function SectionHead({ id, kicker, heading, sub }) {
  return (
    <div className="sh rv">
      <div>
        <p className="kick">{kicker}</p>
        <h2 id={id} className="h2">
          {heading.lead}
          <span className="em grad">{heading.em}</span>
        </h2>
      </div>
      {sub && <p className="sub">{sub}</p>}
    </div>
  )
}
