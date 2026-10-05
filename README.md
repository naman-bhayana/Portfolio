# namanbhayana.com

Personal site of Naman Bhayana: https://www.namanbhayana.com

One static page built with Next.js (App Router) and plain CSS, deployed on Vercel. All copy, links and dates live in `src/content/site.js`; the page, metadata, structured data, sitemap, `llms.txt` and share card read from it.

## Develop

Requires Node.js 24.

```sh
npm install
npm run dev              # http://127.0.0.1:3000
npm run build && npm start
npm run lint
```

## How the page moves

The styles are in `src/styles/`, one file per section, with every animation in `motion.css`. The motion is CSS: the page is complete in the server HTML and reads the same with JavaScript off, with reduced motion, or with the pause switch in the header.

Three rules keep it cheap. Break one and `browser-checks.mjs` fails:

- Anything that loops animates only `opacity` or a transform, so it runs off the main thread.
- Loops are staggered with negative delays, and the hero's arrival is one batch of equal-length animations (see `Hero.jsx`). Positive delays wake the main thread at every start and finish.
- Scroll reveals fill backwards only, so text is drawn on the pixel grid once a block has arrived.

`src/instrumentation-client.js` drops React's `animationiteration` listener; with it, Chrome re-styles every running animation at the end of each loop.

## How the page reads as text

Crawlers, answer engines and reader modes take the HTML as plain text, so the page says each thing once and keeps its words apart:

- Neighbouring inline elements get a space between them (`spaced()` in `src/lib/spaced.js`), even where a flex gap already separates them on screen.
- Decoration that repeats what the text says, or only labels a drawing, is drawn by CSS from a `data-t` attribute: the letters of the name, the typed role line, the marquee's second copy, the diagram labels.
- A proof figure is real text once and a labelled graphic to screen readers, so the count-up never changes what is read out. The figures only start from zero after the first scroll.

`verify-site.mjs` fails if any text is glued to its neighbour.

## Checks

```sh
npm run budget                                        # gzip JavaScript of the built home page against its budget
node scripts/qa/css-survival.mjs                      # the motion CSS survived the minifier
npm run verify -- http://127.0.0.1:3000               # HTML, metadata, routes and headers
node scripts/qa/browser-checks.mjs http://127.0.0.1:3000   # layout, motion, accessibility in Chrome
npm run assets                                        # rebuild the avatar, share card and icons
```

When content changes, bump `UPDATED` in `src/content/site.js`. If the share card changes after it has been live, give the image a new file name so link previews refresh.
