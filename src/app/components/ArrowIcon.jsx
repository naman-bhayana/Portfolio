// Outbound-link arrow. Poppins has no north-east arrow glyph, so it is drawn rather than typed.
export default function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      width="0.75em"
      height="0.75em"
      className="ml-1 inline-block align-baseline"
    >
      <path
        d="M5 11 11 5M6 5h5v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
