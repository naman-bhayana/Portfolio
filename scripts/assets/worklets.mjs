// Copies the ElevenLabs client's two audio worklets into public/vendor/elevenlabs/, where the
// concierge loads them (src/app/components/concierge/session.js). Served from this origin, they
// need no blob: in the Content Security Policy's script-src. Runs before every build and every
// dev server (package.json "prebuild", "predev"); the copies are not committed (.gitignore), so
// they always match the installed client.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const NAMES = ['rawAudioProcessor', 'audioConcatProcessor']
const out = path.join(process.cwd(), 'public', 'vendor', 'elevenlabs')

mkdirSync(out, { recursive: true })
for (const name of NAMES) {
  const from = require.resolve(`@elevenlabs/client/worklets/${name}.js`)
  copyFileSync(from, path.join(out, `${name}.js`))
}
console.log(`worklets: ${NAMES.join(', ')} -> public/vendor/elevenlabs/`)
