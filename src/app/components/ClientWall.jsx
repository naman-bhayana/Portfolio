import { WALL } from '@/content/site'
import { LOGO_WIDTHS, optimised, srcSet } from '@/lib/images'

// The hero's closing band: every client's mark, nothing else printed. The descriptor is text
// a screen reader always has and a pointer uncovers (wall.css). Each PNG is served resized
// through the optimiser; the one SVG is served as it is.
function Mark({ mark }) {
  const png = mark.file.endsWith('.png')
  return (
    // eslint-disable-next-line @next/next/no-img-element -- optimised URLs built in lib/images
    <img
      className={`lg lg-${mark.id}`}
      src={png ? optimised(mark.file, LOGO_WIDTHS[1]) : mark.file}
      srcSet={png ? srcSet(mark.file, LOGO_WIDTHS) : undefined}
      sizes={png ? '(max-width: 600px) 120px, 160px' : undefined}
      width={mark.width}
      height={mark.height}
      alt={mark.name}
      decoding="async"
    />
  )
}

export default function ClientWall() {
  return (
    <section className="wall" data-rv="wall" aria-labelledby="wall-heading">
      <div className="wrap">
        <ul className="wgrid" role="list">
          <li className="wlabel">
            <h2 id="wall-heading" className="eyebrow">
              {WALL.label}
            </h2>
          </li>
          {WALL.marks.map((mark) => (
            <li key={mark.id} className="wcell">
              <Mark mark={mark} />
              <span className="wdesc">{mark.desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
