/**
 * Builds responsive AVIF and WebP variants for every photographic asset, and
 * writes a manifest the page reads to emit correct <picture> markup.
 *
 * Run: node scripts/build-images.js
 *
 * Why this exists on top of optimize-images.js: that script produced one WebP
 * per source at full size. A 1200px screenshot was therefore shipped whole to a
 * 390px phone — roughly nine times the pixels the device can show — and no <img>
 * carried a width or height, so every panel reflowed the page as it loaded.
 *
 * This generates a ladder of widths, adds AVIF (materially smaller than WebP on
 * flat UI screenshots like these), and records the intrinsic size of each source
 * so the markup can reserve the right box before the bytes arrive.
 *
 * The original PNGs stay untouched as the final fallback.
 */
import sharp from 'sharp';
import { readFile, writeFile, stat, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const MANIFEST = fileURLToPath(new URL('../src/image-manifest.json', import.meta.url));

/** Widths worth generating. Anything wider than the source is skipped. */
const LADDER = [400, 640, 900, 1200, 1600];

const SOURCES = {
  // Photographic / screenshot content — the ladder pays off most here
  'heroimage.png':    { widths: LADDER, avif: 52, webp: 74 },
  'slider1.png':      { widths: LADDER, avif: 50, webp: 72 },
  'slider2.png':      { widths: LADDER, avif: 50, webp: 72 },
  'gbpbefore.png':    { widths: LADDER, avif: 52, webp: 74 },
  'gbpafter.png':     { widths: LADDER, avif: 52, webp: 74 },
  'googlebefore.png': { widths: LADDER, avif: 52, webp: 74 },
  'googleafter.png':  { widths: LADDER, avif: 52, webp: 74 },
  // The mark renders at 56-64px but shipped as a 512px, 157KB PNG on every page
  'tlm-mark.png':     { widths: [64, 128, 256], avif: 60, webp: 82, alpha: true }
};

const kb = (b) => `${(b / 1024).toFixed(1)} KB`;

async function build(file, opts) {
  const path = join(PUBLIC, file);
  const base = file.replace(/\.png$/i, '');
  const src = sharp(path);
  const meta = await src.metadata();
  const original = (await stat(path)).size;

  const widths = opts.widths.filter((w) => w <= meta.width);
  if (!widths.length) widths.push(meta.width);

  const written = [];
  for (const w of widths) {
    const resized = sharp(path).resize({ width: w, withoutEnlargement: true });

    const avifPath = join(PUBLIC, `${base}-${w}.avif`);
    await resized.clone().avif({ quality: opts.avif, effort: 6, chromaSubsampling: '4:4:4' }).toFile(avifPath);

    const webpPath = join(PUBLIC, `${base}-${w}.webp`);
    await resized.clone().webp({ quality: opts.webp, effort: 6, alphaQuality: opts.alpha ? 100 : 80 }).toFile(webpPath);

    written.push({ w, avif: (await stat(avifPath)).size, webp: (await stat(webpPath)).size });
  }

  const biggest = written[written.length - 1];
  console.log(
    `  ${file.padEnd(20)} ${String(meta.width).padStart(4)}x${String(meta.height).padEnd(4)}` +
    ` PNG ${kb(original).padStart(9)}  ->  ${widths.length} widths,` +
    ` largest AVIF ${kb(biggest.avif).padStart(8)} / WebP ${kb(biggest.webp).padStart(8)}`
  );

  return { width: meta.width, height: meta.height, widths };
}

/** Removes the single full-size .webp twins the previous script left behind. */
async function sweepLegacy(manifest) {
  const files = await readdir(PUBLIC);
  for (const f of files) {
    const base = f.replace(/\.webp$/i, '');
    if (!/\.webp$/i.test(f)) continue;
    if (/-\d+\.webp$/i.test(f)) continue;            // one of ours
    if (!manifest[base]) continue;                    // not a source we rebuilt
    await unlink(join(PUBLIC, f));
    console.log(`  removed superseded ${f}`);
  }
}

async function main() {
  console.log('Building responsive images...\n');
  const manifest = {};
  for (const [file, opts] of Object.entries(SOURCES)) {
    manifest[file.replace(/\.png$/i, '')] = await build(file, opts);
  }

  console.log('');
  await sweepLegacy(manifest);

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nWrote ${MANIFEST.split(/[\\/]/).pop()} with ${Object.keys(manifest).length} entries.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
