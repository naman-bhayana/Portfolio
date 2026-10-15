import { INFRA } from '@/content/site'
import { spaced } from '@/lib/spaced'

// The rail: eight nodes on one line, read left to right, with a pulse travelling it (infra.css
// and MotionIsland). Below it, what every build ships with, and the toolbox.
export default function Infra() {
  return (
    <section className="scene infra" id="stack" aria-labelledby="infra-heading">
      <div className="light light-infra para" aria-hidden="true" />
      <div className="wrap">
        <div className="head" data-rv="seq">
          <h2 id="infra-heading" className="h2 shine">
            {INFRA.heading.lead}
            <span className="emc">{INFRA.heading.em}</span>
          </h2>
          <p className="sub">{INFRA.sub}</p>
        </div>
        <div className="railwrap">
          <i className="rpulse" aria-hidden="true" />
          <ol className="rail" data-rv="rail" role="list">
            {INFRA.nodes.map((node) => (
              <li key={node.name} className="node">
                <span className="rdot" aria-hidden="true" />
                <h3>{node.name}</h3>
                <p>{node.copy}</p>
              </li>
            ))}
          </ol>
        </div>
        <p className="every" data-rv="one">
          {spaced([
            <span key="label" className="eyebrow">
              {INFRA.everyLabel}
            </span>,
            ...INFRA.every.map((item) => <span key={item}>{item}</span>),
          ])}
        </p>
        <ul className="tools" data-rv="one" role="list" aria-label={INFRA.toolboxLabel}>
          {INFRA.toolbox.map((tool) => (
            <li key={tool}>{tool}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
