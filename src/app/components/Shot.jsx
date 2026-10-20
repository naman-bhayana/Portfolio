import { optimised, srcSet } from '@/lib/images'

// A build's card image, 1.91:1, served through the optimiser.
export default function Shot({ image, sizes }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- optimised URLs built in lib/images
    <img
      src={optimised(image.src, 768)}
      srcSet={srcSet(image.src)}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={image.alt}
      loading="lazy"
      decoding="async"
    />
  )
}
