// The image optimiser serves exactly these widths (next.config.js reads them from here) at
// quality 75. Building the srcset by hand keeps next/image's client component (about 5 KB)
// off the page.
export const IMAGE_WIDTHS = [640, 768, 1080]
// The client marks are shown 16 to 42 px tall, so a 384 px file is sharp at 2x.
export const LOGO_WIDTHS = [256, 384]
export const IMAGE_QUALITY = 75

export const optimised = (src, width) => `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${IMAGE_QUALITY}`

export const srcSet = (src, widths = IMAGE_WIDTHS) => widths.map((width) => `${optimised(src, width)} ${width}w`).join(', ')
