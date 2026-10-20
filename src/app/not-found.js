import { NOT_FOUND } from '@/content/site'
import Icon from './components/Icon'

// Next.js adds its own noindex to this response; the home page's robots and canonical tags
// live in page.js, so nothing here contradicts it.
export const metadata = {
  title: NOT_FOUND.title,
}

export default function NotFound() {
  return (
    <section className="sec" aria-labelledby="not-found-heading">
      <div className="wrap">
        <h1 id="not-found-heading" className="h2">
          {NOT_FOUND.title}
        </h1>
        <p className="lead">{NOT_FOUND.body}</p>
        <p className="cta">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load is fine here */}
          <a className="pill pill-primary" href="/">
            {NOT_FOUND.home} <Icon name="arrow" />
          </a>
        </p>
      </div>
    </section>
  )
}
