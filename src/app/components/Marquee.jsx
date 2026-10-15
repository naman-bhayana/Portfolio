import { CAPABILITIES, CAPABILITIES_LABEL } from '@/content/site'

// A moving strip: the same list three times, so the loop is seamless on screens up to twice
// as wide as one copy. The first copy is a real, labelled list. The other two are drawn by CSS
// (data-t) and hidden from assistive technology, so the HTML holds the list once and a screen
// reader reads it once.
export default function Marquee() {
  return (
    <div className="mq">
      <div className="mqt">
        <ul className="mqg" aria-label={CAPABILITIES_LABEL}>
          {CAPABILITIES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {[2, 3].map((copy) => (
          <ul key={copy} className="mqg" aria-hidden="true">
            {CAPABILITIES.map((item) => (
              <li key={item} data-t={item} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
