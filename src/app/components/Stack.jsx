import { STACK } from '@/content/site'
import SectionHead from './SectionHead'

// Four plates, four layers. Plates are drawn bottom-up (p1 is the lowest); the layers read
// top-down, so layer 1 pairs with plate 4. CSS lights each pair in turn and on hover.
export default function Stack() {
  const count = STACK.layers.length
  return (
    <section className="sec" id="stack" aria-labelledby="stack-heading">
      <div className="wrap">
        <SectionHead id="stack-heading" kicker={STACK.kicker} heading={STACK.heading} sub={STACK.sub} />
        <div className="stackgrid">
          <div className="iso" aria-hidden="true">
            {STACK.layers.map((layer, i) => (
              <div key={layer.name} className={`plate p${i + 1}`} />
            ))}
          </div>
          <div className="layers">
            {STACK.layers.map((layer, i) => (
              <div key={layer.name} className={`layer l${count - i} rv`}>
                <span className="n" aria-hidden="true" data-t={String(count - i).padStart(2, '0')} />
                <div>
                  <h3>{layer.name}</h3>
                  <p>{layer.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="tools rv">
          <p className="mono" id="toolbox-label">
            {STACK.toolboxLabel}
          </p>
          <ul className="toollist" aria-labelledby="toolbox-label">
            {STACK.toolbox.map((tool) => (
              <li key={tool}>{tool}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
