/**
 * Compresses the PNGs that are NOT part of the responsive pipeline.
 * Run: node scripts/optimize-images.js
 *
 * Everything the homepage renders through <Shot> — the hero, the slider, the
 * before/after screenshots, the mark — is built by scripts/build-images.js
 * instead, which writes an AVIF and WebP ladder plus a manifest. Those sources
 * were removed from this file deliberately: leaving them here meant a later run
 * would recreate the single full-size .webp twins the ladder replaced, and the
 * page would quietly go back to shipping a 1200px screenshot to a phone.
 *
 * What is left here is the social and icon artwork, which has one fixed size
 * and no need for a ladder.
 */
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const PUBLIC = new URL('../public/', import.meta.url).pathname.replace(/^\//, '');
const TARGETS = {
  // Social cards — one fixed size, and the crawlers that fetch them want a
  // plain PNG or WebP rather than a srcset
  'og.png':               { maxWidth: 1200, png: 82, webp: 78 },
  'og-apply.png':         { maxWidth: 1200, png: 82, webp: 78 },
  // Icons: fixed dimensions, transparency, no ladder worth building
  'tlmlogo.png':          { maxWidth: 512, png: 90 },
  'apple-touch-icon.png': { maxWidth: 180, png: 90 }
};

const formatBytes = (b) => `${(b / 1024).toFixed(1)} KB`;

async function compressOne(file, opts) {
  const path = join(PUBLIC, file);
  const before = (await stat(path)).size;
  const buf = await sharp(path).resize({ width: opts.maxWidth, withoutEnlargement: true }).toBuffer();

  // Re-encode PNG with palette where it shrinks the file
  const pngBuf = await sharp(buf).png({ quality: opts.png, compressionLevel: 9, palette: true, effort: 10 }).toBuffer();

  // Only write if PNG is smaller than original
  if (pngBuf.length < before) {
    await sharp(pngBuf).toFile(path);
  }

  // Optionally write WebP twin
  if (opts.webp) {
    const webpPath = path.replace(/\.png$/i, '.webp');
    await sharp(buf).webp({ quality: opts.webp, effort: 6 }).toFile(webpPath);
    const webpSize = (await stat(webpPath)).size;
    console.log(`  ${file.padEnd(28)} ${formatBytes(before).padStart(9)} -> PNG ${formatBytes((await stat(path)).size).padStart(9)}  WebP ${formatBytes(webpSize).padStart(9)}`);
  } else {
    console.log(`  ${file.padEnd(28)} ${formatBytes(before).padStart(9)} -> PNG ${formatBytes((await stat(path)).size).padStart(9)}`);
  }
}

async function main() {
  console.log('Optimizing images in /public...\n');
  const files = await readdir(PUBLIC);
  for (const f of files) {
    if (TARGETS[f]) await compressOne(f, TARGETS[f]);
  }
  // favicon.ico — just copy from tlmlogo since browsers handle PNG-as-ico
  console.log('\nDone.');
}

main().catch((e) => { console.error(e); process.exit(1); });
