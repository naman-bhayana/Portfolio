import { NOT_FOUND } from '@/content/site'

// Next.js adds its own noindex to this response; the home page's robots and canonical tags
// live in page.js, so nothing here contradicts it.
export const metadata = {
  title: NOT_FOUND.title,
}

export default function NotFound() {
  return (
    <section aria-labelledby="not-found-heading" className="section">
      <div className="container-page max-w-prose">
        <h1 id="not-found-heading" className="text-h2 font-semibold">
          {NOT_FOUND.title}
        </h1>
        <p className="mt-4 text-lead text-muted">{NOT_FOUND.body}</p>
        <p className="mt-8">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load is fine here */}
          <a href="/">{NOT_FOUND.home}</a>
        </p>
      </div>
    </section>
  )
}
