# namanbhayana.com

Personal site of Naman Bhayana: https://www.namanbhayana.com

One static page built with Next.js (App Router) and Tailwind CSS, deployed on Vercel. All copy, links and dates live in `src/content/site.js`; the page, metadata, structured data, sitemap and `llms.txt` read from it.

## Develop

Requires Node.js 24.

```sh
npm install
npm run dev              # http://127.0.0.1:3000
npm run build && npm start
npm run lint
```

## Checks

```sh
npm run budget           # gzip JavaScript of the built home page against its budget
npm run verify -- http://127.0.0.1:3000   # HTML, metadata, routes and headers
npm run assets           # rebuild the avatar, share card and icons
```

When content changes, bump `UPDATED` in `src/content/site.js`. If the share card changes, give the image a new file name so link previews refresh.
