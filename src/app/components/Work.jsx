import { WORK } from '@/content/site'
import { andList } from '@/lib/and-list'
import { IMAGE_WIDTHS, LOGO_WIDTHS, optimised, srcSet } from '@/lib/images'
import { spaced } from '@/lib/spaced'
import Shot from './Shot'

const CARD_SIZES = '(max-width: 960px) 92vw, 380px'
const FLAGSHIP_SIZES = '(max-width: 960px) 86vw, 560px'
// A case's wordmark is drawn up to 290 px wide on a desktop and 230 px on a phone (heights in
// work.css times each mark's aspect), so a 3x phone needs about 690 px of it.
const WORDMARK_SIZES = '(max-width: 600px) 230px, 290px'
const WORDMARK_WIDTHS = [...LOGO_WIDTHS, ...IMAGE_WIDTHS.slice(0, 2)]

// A case is headed by its wordmark. The name is there as text for everything that reads the
// HTML; the image only draws it.
function Wordmark({ build }) {
  const { mark } = build
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- optimised URLs built in lib/images */}
      <img
        className={`wm wm-${mark.id}`}
        src={optimised(mark.file, LOGO_WIDTHS[1])}
        srcSet={srcSet(mark.file, WORDMARK_WIDTHS)}
        sizes={WORDMARK_SIZES}
        width={mark.width}
        height={mark.height}
        alt=""
        aria-hidden="true"
        decoding="async"
      />
      <span className="sr">{build.name}</span>
    </>
  )
}

// A row of the index that groups several builds is read as a list ("A, B and C") and drawn as
// names set apart. The drawn names are CSS (data-t), so the text holds each name once.
function IndexName({ builds }) {
  const names = builds.map((build) => build.name)
  if (names.length === 1) {
    return (
      <h4 className="ixname">
        <span>{names[0]}</span>
      </h4>
    )
  }
  return (
    <h4 className="ixname">
      <span className="sr">{andList(names)}</span>
      {names.map((name) => (
        <span key={name} aria-hidden="true" data-t={name} />
      ))}
    </h4>
  )
}

const Tags = ({ tags }) => <p className="tags">{spaced(tags.map((tag) => <span key={tag}>{tag}</span>))}</p>

// The flagship plate: the real brand card with one light sweep and the 14-segment stage bar,
// beside the text. It tilts a little towards the pointer (data-tilt, MotionIsland).
function Flagship({ build }) {
  return (
    <article className="flag spotcard tilt" data-tilt="2.5" data-rv="flag" id={build.id} aria-labelledby="flag-heading">
      <div className="flagart">
        <div className="card para-soft">
          <Shot image={build.image} sizes={FLAGSHIP_SIZES} />
        </div>
        <div className="stagebar">
          <div className="segs" aria-hidden="true">
            {Array.from({ length: build.stages.count }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <p className="cap">{build.stages.text}</p>
        </div>
      </div>
      <div className="flagtext">
        <div className="flagname">
          <h3 id="flag-heading" className="h3big">
            {build.name}
          </h3>{' '}
          <a className="ext" href={build.link.href}>
            {build.link.label}
          </a>
        </div>
        <p className="flagsum">{build.summary}</p>
        <ul className="mods" role="list">
          {build.modules.map((module) => (
            <li key={module}>{module}</li>
          ))}
          <li className="next">{build.next}</li>
        </ul>
        <Tags tags={build.tags} />
        <p className="quiet">
          <a href={build.team.href}>{build.team.label}</a>
        </p>
      </div>
    </article>
  )
}

// The deck: five cases, each sticky, each pinned a step lower than the one before, so the
// next slides over the last as the page scrolls (work.css).
function Case({ build }) {
  return (
    <article className="case spotcard tilt" data-tilt="2" data-rv="seq" id={build.id} aria-labelledby={`${build.id}-heading`}>
      <div className="casehead">
        <h3 id={`${build.id}-heading`} className="casename">
          <Wordmark build={build} />
        </h3>
        <Tags tags={build.tags} />
      </div>
      <div className="casetext">
        {/* One paragraph: the role line opens it, set larger, so it is not a heading in disguise. */}
        <p className="mech">
          {build.role && (
            <>
              <span className="role2">{build.role}</span>{' '}
            </>
          )}
          {build.mech}
        </p>
      </div>
      {build.image && (
        <div className="caseart">
          <Shot image={build.image} sizes={CARD_SIZES} />
        </div>
      )}
      {build.links.length > 0 && (
        <p className="caselink">
          {spaced(
            build.links.map((link) => (
              <a key={link.href} className="ext" href={link.href}>
                {link.label}
              </a>
            )),
          )}
        </p>
      )}
    </article>
  )
}

export default function Work() {
  return (
    <section className="scene work" id="work" aria-labelledby="work-heading">
      <div className="light light-work para" aria-hidden="true" />
      <div className="wrap">
        <div className="headrow" data-rv="seq">
          <h2 id="work-heading" className="h2 shine">
            {WORK.heading.lead}
            <span className="emc">{WORK.heading.em}</span>
          </h2>
          <p className="sub">{WORK.sub}</p>
        </div>
        <Flagship build={WORK.flagship} />
        <div className="deck">
          {WORK.cards.map((build) => (
            <Case key={build.id} build={build} />
          ))}
        </div>
        <div className="index" data-rv="seq">
          <h3 className="h3">{WORK.indexLabel}</h3>
          <ul className="ix" role="list">
            {WORK.index.map((row) => (
              <li key={row.sector}>
                <IndexName builds={row.builds} />
                <p className="ixsector">{row.sector}</p>
                <p className="ixwhat">{row.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
