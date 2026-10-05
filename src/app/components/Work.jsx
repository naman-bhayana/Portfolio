import { WORK } from '@/content/site'
import { spaced } from '@/lib/spaced'
import Icon from './Icon'
import SectionHead from './SectionHead'
import { DIAGRAMS, Shot } from './Visuals'

const CARD_SIZES = '(max-width: 960px) 92vw, 400px'
const FLAGSHIP_SIZES = '(max-width: 960px) 86vw, 480px'

// "Live", "Code" and "Site" repeat down the page, so each link carries a hidden hint
// that says which build it belongs to.
function BuildLink({ link }) {
  return (
    <a className="lk" href={link.href}>
      {link.label}
      {link.hint && <span className="sr"> {link.hint}</span>} <Icon name="external" small />
    </a>
  )
}

function Flagship({ build }) {
  return (
    <article className="flag rv">
      <div className="flagbody">
        <div className="tags">
          {spaced(
            build.tags.map((tag, i) => (
              <span key={tag} className={i === 0 ? 'tag hot' : 'tag'}>
                {tag}
              </span>
            )),
          )}
        </div>
        <div className="flagname">
          <h3>{build.name}</h3>
          <a className="ext" href={build.link.href}>
            {build.link.label} <Icon name="external" small />
          </a>
        </div>
        <p className="lead">{build.summary}</p>
        <ul className="mods">
          {build.modules.map((module) => (
            <li key={module}>{module}</li>
          ))}
          <li className="next">{build.next}</li>
        </ul>
      </div>
      <div className="flagviz">
        <Shot image={build.image} sizes={FLAGSHIP_SIZES} />
        {/* --n and --i time the run of light along the stages (see motion.css). */}
        <div className="stages" aria-hidden="true" style={{ '--n': build.stages.count }}>
          {Array.from({ length: build.stages.count }, (_, i) => (
            <i key={i} style={{ '--i': i }} />
          ))}
        </div>
        <p className="stagecap">
          <b>{build.stages.strong}</b> {build.stages.text}
        </p>
      </div>
    </article>
  )
}

function CaseCard({ build, stagger }) {
  const Diagram = DIAGRAMS[build.visual]
  return (
    <article className={`case rv${stagger ? ` s${stagger + 1}` : ''}`}>
      {build.image ? (
        <div className="cviz pic">
          <Shot image={build.image} sizes={CARD_SIZES} />
        </div>
      ) : (
        <Diagram />
      )}
      <div className="cbody">
        <div className="tags">
          {spaced(
            build.tags.map((tag, i) => (
              <span key={tag} className={build.highlight && i === 0 ? 'tag beta' : 'tag'}>
                {tag}
              </span>
            )),
          )}
        </div>
        <h3>{build.name}</h3>
        <p>{build.summary}</p>
        {build.links.length > 0 ? (
          <div className="clinks">{spaced(build.links.map((link) => <BuildLink key={link.href} link={link} />))}</div>
        ) : (
          <p className="pv">{build.note}</p>
        )}
      </div>
    </article>
  )
}

export default function Work() {
  // Numbering runs on from the flagship (01) and the cards.
  const firstIndex = WORK.cards.length + 2
  return (
    <section className="sec" id="work" aria-labelledby="work-heading">
      <div className="wrap">
        <SectionHead id="work-heading" kicker={WORK.kicker} heading={WORK.heading} sub={WORK.sub} />
        <Flagship build={WORK.flagship} />
        <div className="cases">
          {WORK.cards.map((build, i) => (
            <CaseCard key={build.id} build={build} stagger={i % 3} />
          ))}
        </div>
        <p className="mono idxh rv">{WORK.indexLabel}</p>
        <div className="idx">
          {WORK.index.map((build, i) => (
            <article className="row rv" key={build.id}>
              <span className="n" aria-hidden="true" data-t={String(firstIndex + i).padStart(2, '0')} />
              <h3>{build.name}</h3>
              <span className="k">
                {build.category}
                {build.result && <> <em>{build.result}</em></>}
              </span>{' '}
              <span className="d">{build.summary}</span>{' '}
              <span className="lks">{spaced(build.links.map((link) => <BuildLink key={link.href} link={link} />))}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
