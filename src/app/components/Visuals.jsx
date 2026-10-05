import { optimised, srcSet } from '@/lib/images'

// A build's card image, 1.91:1, served through the optimiser.
export function Shot({ image, sizes }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- optimised URLs built in lib/images
    <img
      src={optimised(image.src, 768)}
      srcSet={srcSet(image.src)}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={image.alt}
      loading="lazy"
      decoding="async"
    />
  )
}

// Drawn stand-ins for builds that have no card image yet. All decorative, all CSS-animated,
// and their labels are drawn by CSS (data-t) so they are not read as part of the page's text.

function Chart() {
  const curve = 'M0 152 C40 142 60 120 90 126 S140 90 170 98 S220 58 250 72 S300 38 330 46 S370 24 400 18'
  return (
    <div className="cviz chart" aria-hidden="true">
      <svg viewBox="0 0 400 200" preserveAspectRatio="none">
        <path className="area" d={`${curve} L400 200 L0 200 Z`} />
      </svg>
      <div className="wipe">
        <div>
          <svg viewBox="0 0 400 200" preserveAspectRatio="none">
            <path className="line" d={curve} />
          </svg>
        </div>
      </div>
      <span className="dot" />
    </div>
  )
}

function Doc() {
  return (
    <div className="cviz doc" aria-hidden="true">
      <div className="sheet">
        <span className="plus" />
        <span className="ln" />
        <span className="ln ln2" />
        <span className="ln ln3" />
        <span className="ln ln4" />
        <span className="ln ln5" />
      </div>
      <span className="beam" />
      <span className="dtag dt1" data-t="EMR" />
      <span className="dtag dt2" data-t="SNOMED CT" />
      <span className="dtag dt3" data-t="OCR" />
    </div>
  )
}

// Labels and addresses are the ones the Prozone app really uses.
function Gas() {
  return (
    <div className="cviz gas" aria-hidden="true">
      <div className="gasrows">
        {['CO', 'HC', 'CO2', 'O2', 'LAMBDA'].map((reading) => (
          <span key={reading}>
            <b data-t={reading} />
            <i />
          </span>
        ))}
      </div>
      <span className="dtag gt1" data-t="COM3 · 9600" />
      <span className="dtag gt2" data-t="localhost:8585" />
    </div>
  )
}

export const DIAGRAMS = { chart: Chart, doc: Doc, gas: Gas }
