/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    // The palette is replaced, not extended, so off-brand colours cannot creep in.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: '#0A0C10',
      ink: '#0A0C10', // text on the cyan-to-blue gradient (6.25:1 or better)
      surface: '#0F1217',
      fg: '#E6E8EB', // body text, 15.9:1 on bg
      muted: '#9CA3AF', // secondary text, 7.7:1 on bg
      border: '#636B78', // control boundaries, 3:1 or better on bg and surface
      line: 'rgb(230 232 235 / 0.08)', // decorative hairlines
      cyan: '#00D0EE',
      blue: '#0096F7',
    },
    fontFamily: {
      sans: ['var(--font-poppins)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'],
    },
    // Only the two weights the page loads.
    fontWeight: { normal: '400', semibold: '600' },
    extend: {
      fontSize: {
        display: ['clamp(2.5rem, 1.6rem + 4.2vw, 4.5rem)', { lineHeight: '1.04', letterSpacing: '-0.035em' }],
        h2: ['clamp(1.75rem, 1.35rem + 1.8vw, 2.75rem)', { lineHeight: '1.12', letterSpacing: '-0.025em' }],
        h3: ['clamp(1.125rem, 1.05rem + 0.35vw, 1.3125rem)', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        lead: ['clamp(1.0625rem, 0.98rem + 0.45vw, 1.25rem)', { lineHeight: '1.6' }],
        stat: ['clamp(1.5rem, 1.15rem + 1.6vw, 2.75rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        email: ['clamp(1.125rem, 0.95rem + 1.2vw, 1.75rem)', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
      },
      maxWidth: { prose: '40rem', page: '72rem' },
    },
  },
  plugins: [],
}
