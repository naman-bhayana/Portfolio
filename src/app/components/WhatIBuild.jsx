import { WHAT_I_BUILD } from '@/content/site'

export default function WhatIBuild() {
  const { heading, subline, layers } = WHAT_I_BUILD
  return (
    <section aria-labelledby="build-heading" className="section">
      <div className="container-page grid gap-10 lg:grid-cols-12 lg:gap-12" data-reveal>
        <div className="lg:col-span-4">
          <h2 id="build-heading" className="text-balance text-h2 font-semibold">
            {heading}
          </h2>
          <p className="mt-3 text-lead text-muted">{subline}</p>
        </div>
        <ol role="list" className="stack lg:col-span-8">
          {layers.map((layer) => (
            <li key={layer.name} className="stack-layer">
              <h3 className="text-h3 font-semibold">{layer.name}</h3>
              <p className="text-muted">{layer.copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
