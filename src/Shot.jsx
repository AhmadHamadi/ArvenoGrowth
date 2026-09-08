import React from 'react';
import manifest from './image-manifest.json';

/**
 * One <picture> element, built from the manifest scripts/build-images.js writes.
 *
 * Three things this gets right that hand-written <img> tags on this site did not:
 *
 *   1. It offers AVIF before WebP before the PNG, so a modern browser takes the
 *      smallest file and an old one still gets a picture.
 *   2. It ships a srcset ladder with a sizes hint, so a phone downloads a 400px
 *      screenshot instead of the 1200px one meant for a desktop.
 *   3. It always sets width and height. Without them the browser cannot reserve
 *      the box, and every panel shoves the page down as it decodes — the layout
 *      shift you see as the homepage settles.
 *
 * `sizes` should describe how wide the image actually renders at each breakpoint.
 * Getting it wrong costs bandwidth, not correctness, but it is worth being close.
 */
export default function Shot({
  name,
  alt,
  sizes = '100vw',
  className = 'block h-auto w-full',
  priority = false,
  ...rest
}) {
  const entry = manifest[name];

  // A missing entry means the manifest and the markup drifted. Fall back to the
  // plain PNG rather than rendering nothing, and say so in the console.
  if (!entry) {
    if (typeof console !== 'undefined') {
      console.warn(`[Shot] "${name}" is not in image-manifest.json — run node scripts/build-images.js`);
    }
    return <img src={`/${name}.png`} alt={alt} className={className} loading="lazy" decoding="async" {...rest} />;
  }

  const set = (ext) => entry.widths.map((w) => `/${name}-${w}.${ext} ${w}w`).join(', ');

  return (
    <picture>
      <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
      <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
      <img
        src={`/${name}.png`}
        alt={alt}
        width={entry.width}
        height={entry.height}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        // fetchPriority is the React 18.3+ spelling; it lands as fetchpriority
        fetchPriority={priority ? 'high' : undefined}
        decoding={priority ? 'sync' : 'async'}
        {...rest}
      />
    </picture>
  );
}
