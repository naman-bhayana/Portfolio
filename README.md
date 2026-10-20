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

The styles are in `src/styles/`, one file per section, with every animation in `motion.css`. The page is complete in the server HTML and reads the same with JavaScript off, with reduced motion, or with the pause switch in the header.

Three rules keep the loops cheap. Break one and `browser-checks.mjs` fails:

- Anything that loops animates only `opacity` or a transform, so it runs off the main thread.
- Loops are staggered with negative delays, and the hero's arrival is one batch of equal-length animations (see `Hero.jsx`). Positive delays wake the main thread at every start and finish.
- Arrivals fill backwards only, so text is drawn on the pixel grid once a block has arrived.

Below the hero, a block arrives once as the reader reaches it. `MotionIsland.jsx` marks the page (`html.rv-on`) and the blocks still below the fold (`.rv-wait`); a block coming into view plays its arrival (`.rv-in`) and is let go of once it has played. Headlines arrive word by word. Without JavaScript nothing waits. The parts tied to scroll (the lights behind each scene, the deck of cases, the rail, the progress line) are CSS scroll-driven animations with no script at all.

`MotionIsland.jsx` also flies the 400 dots of the proof stage into their grid, scrambles and counts the figures, and tilts the avatar stage and the plates towards the pointer, which carries a light. The particle field under the page runs in a worker (`field.worker.js`) on a canvas handed over to it, started once the browser is idle after load. On the main thread, a frame loop would make Chrome update every CSS loop there each frame, so the page could never rest; in a worker the field drifts for as long as the page is open and `T8.idle-main-thread` still measures nothing. The tilt and the light only ease while the pointer moves, and nothing reads the DOM in a frame. The pause switch stops it all, and a page that opens paused starts its motion on the first resume.

The deck of cases is the one scroll effect that holds a state: a case recedes while the next one covers it, from the moment they meet to the moment the next is pinned, and stays receded under it. That resting state applies only on screen and only while motion runs, so a paused, printed or reduced-motion page shows every case as it is. The cases are opaque, and they pin below the sticky header at every width.

Two more Chrome behaviours shape the rest. A scroll-driven animation whose subject is several screens away is still serviced on the main thread every frame, so the lights, the brand card, the portrait and the cases drop their animation while they are more than a screen and a half off (`.far`, set by an observer); pausing is not enough. And the 400 dots are one repeating gradient, not 400 elements: as elements they were most of the first layout's cost on a phone.

`src/instrumentation-client.js` drops React's `animationiteration` listener; with it, Chrome re-styles every running animation at the end of each loop.

`MotionIsland.jsx` moves every loop on by a millisecond once the web fonts are in. Chrome works a loop's percentages out in pixels as it starts it, and a font that lands in that moment leaves them out of date: the typed role's caret ends up a few pixels off its text.

## How the page reads as text

Crawlers, answer engines and reader modes take the HTML as plain text, so the page says each thing once and keeps its words apart:

- Neighbouring inline elements get a space between them (`spaced()` in `src/lib/spaced.js`), even where a flex gap already separates them on screen.
- Decoration that repeats what the text says is drawn by CSS from a `data-t` attribute: the letters of the name, the typed role line, the marquee's other copies. A case's wordmark is an image that only draws the name; the name is text beside it.
- A proof figure is real text once and a labelled graphic to screen readers, so the count-up never changes what is read out. The figures only start from zero after the first scroll.
- Every client mark on the wall is named by its alt text; its descriptor is text a pointer uncovers.

`verify-site.mjs` fails if any text is glued to its neighbour, and if any dash stands between words (ranges are "30-40%" or "2023 to 2024").

## The studio's address

The page links nexerah.com. Its Organization node joins the structured data only once `NEXERAH_LIVE` is set in `site.js`, which `verify-site.mjs` checks against the live address; until the domain answers, the HTTP check warns.

## Checks

```sh
npm run budget                                        # gzip JavaScript of the built home page against its budget
node scripts/qa/css-survival.mjs                      # the motion CSS survived the minifier
npm run verify -- http://127.0.0.1:3000               # HTML, metadata, routes and headers
node scripts/qa/browser-checks.mjs http://127.0.0.1:3000   # layout, motion, accessibility in Chrome
npm run assets                                        # rebuild the avatar, share card and icons
```

When content changes, bump `UPDATED` in `src/content/site.js`. If the share card changes after it has been live, give the image a new file name so link previews refresh.
