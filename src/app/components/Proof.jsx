import { PROOF } from '@/content/site'

const DOTS = 400 // one per model, as the caption says

// A figure as it is drawn. Numbers carry data-count: MotionIsland scrambles and counts them
// up, and the server HTML already holds the final value for everyone else. A unit ("+", "%",
// "-stage") is set in the serif; a plain hyphen stays in the figure's own face.
function Figure({ parts }) {
  return parts.map((part, i) =>
    typeof part === 'number' ? (
      <span key={i} data-count={part}>
        {part}
      </span>
    ) : part === '-' ? (
      part
    ) : (
      <small key={i} className="u">
        {part}
      </small>
    ),
  )
}

// The figure is in the HTML once, as text. To a screen reader it is one labelled graphic, so
// it reads the true value whatever the digits are doing while they count. It sits in a div:
// a paragraph set this large reads to an accessibility checker as a heading in disguise.
function Num({ item }) {
  return (
    <span className="numtxt" role="img" aria-label={item.say ?? item.value}>
      <Figure parts={item.parts} />
    </span>
  )
}

export default function Proof() {
  const [models] = PROOF.wall
  return (
    <section className="scene proof" id="proof" aria-labelledby="proof-heading">
      <div className="light light-proof para" aria-hidden="true" />
      <div className="wrap">
        <div className="head" data-rv="seq">
          <h2 id="proof-heading" className="h2">
            {PROOF.heading.lead}
            <span className="emc">{PROOF.heading.em}</span>
          </h2>
          <p className="sub">{PROOF.sub}</p>
        </div>
        {/* The stage: the one figure that gets a visual, a dot per model. MotionIsland flies
            the dots in from across the stage on a canvas; the grid of dots is the still state. */}
        <div className="pstage" data-rv="stage">
          <div className="hfig">
            <div className="phalo" aria-hidden="true" />
            <div className="num">
              <Num item={models} />
            </div>
            <p className="flab">{models.label}</p>
            <p className="src">{models.source}</p>
          </div>
          <figure className="fieldwrap">
            <div className="dotfield" aria-hidden="true">
              {Array.from({ length: DOTS }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <figcaption className="cap">{models.caption}</figcaption>
          </figure>
        </div>
        <ul className="figs" data-rv="seq" role="list">
          {PROOF.cells.map((cell) => (
            <li key={cell.id}>
              <div className="num2">
                <Num item={cell} />
              </div>
              {cell.bars && (
                <div className="bars" aria-hidden="true">
                  {Array.from({ length: cell.bars }, (_, i) => (
                    <i key={i} />
                  ))}
                </div>
              )}
              <p className="flab2">{cell.label}</p>
              <p className="src">{cell.source}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
