import { Fragment } from 'react'
import { AVATAR, HERO } from '@/content/site'

// The optimiser serves exactly these widths (next.config.js images.deviceSizes) at quality 75.
// Building the srcset here keeps next/image's client component (about 5 KB) off the page.
const optimised = (width) => `/_next/image?url=${encodeURIComponent(AVATAR.src)}&w=${width}&q=75`
const AVATAR_WIDTHS = [640, 768]

// Keep compounds such as "e-commerce" on one line; the text itself is unchanged.
const keepCompounds = (text) =>
  text.split(/(\S+-\S+)/).map((part, i) =>
    i % 2 ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  )

// The h1 and avatar are in the server HTML and never animate. The avatar is the largest
// element on first paint, so it loads eagerly at high priority.
export default function Hero() {
  return (
    // overflow-x-clip: the avatar glow may spill past the column, never past the page.
    <section aria-labelledby="hero-heading" className="overflow-x-clip border-b border-line">
      <div className="container-page grid grid-cols-1 gap-10 pt-10 sm:pt-14 lg:grid-cols-12 lg:items-end lg:gap-8 lg:pt-20">
        <div className="lg:col-span-7 lg:pb-24">
          <p className="eyebrow">
            {/* Phones: one role per line, so the fallback font and Poppins wrap identically
                and nothing moves when the web font arrives. From sm: one line, with the
                separator, breaking only between the roles. */}
            <span>
              {HERO.eyebrow.split(' · ').map((role, i) => (
                <Fragment key={role}>
                  {i > 0 && <span className="hidden sm:inline"> · </span>}
                  <span className="block sm:inline sm:whitespace-nowrap">{role}</span>
                </Fragment>
              ))}
            </span>
          </p>
          <h1 id="hero-heading" className="mt-4 text-balance text-display font-semibold">
            {HERO.heading}
          </h1>
          <p className="mt-5 max-w-[36rem] text-lead text-muted">{keepCompounds(HERO.subline)}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={HERO.primaryCta.href} className="btn btn-primary">
              {HERO.primaryCta.label}
            </a>
            <a href={HERO.secondaryCta.href} className="btn btn-secondary">
              {HERO.secondaryCta.label}
            </a>
          </div>
        </div>
        <div className="hero-figure lg:col-span-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- optimised URLs built above */}
          <img
            src={optimised(768)}
            srcSet={AVATAR_WIDTHS.map((w) => `${optimised(w)} ${w}w`).join(', ')}
            sizes="(max-width: 571px) 70vw, 400px"
            width={AVATAR.width}
            height={AVATAR.height}
            alt={AVATAR.alt}
            loading="eager"
            fetchPriority="high"
          />
        </div>
      </div>
    </section>
  )
}
