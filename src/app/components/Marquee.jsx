import { CAPABILITIES, CAPABILITIES_LABEL } from '@/content/site'

// A moving strip: the same list twice, so the loop is seamless. The first copy is a real,
// labelled list. The second is drawn by CSS (data-t) and hidden from assistive technology, so
// the HTML holds the list once and a screen reader reads it once.
export default function Marquee() {
  return (
    <div className="mq">
      <div className="mqt">
        <ul className="mqg" aria-label={CAPABILITIES_LABEL}>
          {CAPABILITIES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <ul className="mqg" aria-hidden="true">
          {CAPABILITIES.map((item) => (
            <li key={item} data-t={item} />
          ))}
        </ul>
      </div>
    </div>
  )
}
