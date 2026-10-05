import { PROOF } from '@/content/site'
import SectionHead from './SectionHead'

const BARS = 28 // signal bars in the second tile

// A figure as it is drawn. Numbers carry data-count: MotionIsland counts them up from zero,
// and the server HTML already holds the final value for everyone else.
function Figure({ parts }) {
  return parts.map((part, i) =>
    typeof part === 'number' ? (
      <span key={i} data-count={part}>
        {part}
      </span>
    ) : part === '–' ? (
      part
    ) : (
      <small key={i}>{part}</small>
    ),
  )
}

// The figure is in the HTML once, as text. To a screen reader it is one labelled graphic, so
// it reads the true value whatever the digits are doing while they count.
function Num({ item }) {
  return (
    <div className="num grad" role="img" aria-label={item.say ?? item.value}>
      <Figure parts={item.parts} />
    </div>
  )
}

export default function ProofWall() {
  const [models, signals, manual] = PROOF.wall
  return (
    <section className="sec" id="proof" aria-labelledby="proof-heading">
      <div className="wrap">
        <SectionHead id="proof-heading" kicker={PROOF.kicker} heading={PROOF.heading} sub={PROOF.sub} />
        <div className="wall">
          <div className="big b1 rv">
            <p className="src">{models.source}</p>
            <Num item={models} />
            <p className="lab">{models.label}</p>
            <div className="viz" aria-hidden="true">
              <div className="dots">
                <span className="on" />
              </div>
              <p className="cap">{models.caption}</p>
            </div>
          </div>
          <div className="big b2 rv s2">
            <p className="src">{signals.source}</p>
            <div>
              <Num item={signals} />
              <p className="lab">{signals.label}</p>
            </div>
            <div className="viz eq" aria-hidden="true">
              {Array.from({ length: BARS }, (_, i) => (
                <i key={i} />
              ))}
            </div>
          </div>
          <div className="big b3 rv s3">
            <p className="src">{manual.source}</p>
            <div>
              <Num item={manual} />
              <p className="lab">{manual.label}</p>
            </div>
            <div className="viz ba" aria-hidden="true">
              <div className="was" data-t={manual.before}>
                <span>
                  <i />
                </span>
              </div>
              <div className="now" data-t={manual.after}>
                <span>
                  <i />
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="row2 rv">
          {PROOF.cells.map((cell) => (
            <div className="cell" key={cell.value}>
              <b className="grad" role="img" aria-label={cell.value}>
                <Figure parts={cell.parts} />
              </b>{' '}
              <span className="ct">{cell.label}</span>
            </div>
          ))}
          <ul className="dom">
            {PROOF.domains.map((domain) => (
              <li key={domain}>{domain}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
