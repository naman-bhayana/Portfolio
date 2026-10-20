// Drawn rather than typed: the loaded font subsets carry no arrow glyphs.
const PATHS = {
  arrow: 'M3 8h10M9 4l4 4-4 4',
  external: 'M5 11l6-6M6 5h5v5',
  pause: 'M4 3h3v10H4zM9 3h3v10H9z',
  play: 'M5 3l8 5-8 5z',
}

export default function Icon({ name, small = false, className = '' }) {
  return (
    <svg className={`ic${small ? ' sm' : ''}${className ? ` ${className}` : ''}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  )
}
