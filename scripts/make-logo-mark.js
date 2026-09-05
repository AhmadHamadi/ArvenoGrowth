/**
 * TLMLOGOTRANSPARENT.png is not actually transparent — it ships with an opaque
 * near-white background. Naively keying every white pixel would also punch out
 * the white inside the mark (the roof outline, the gaps between letters), so
 * this flood-fills inward from the border instead: only white that is connected
 * to the edge becomes transparent.
 *
 * Output: public/tlm-mark.png — trimmed, square, genuinely transparent.
 * Run: node scripts/make-logo-mark.js
 */
import sharp from 'sharp';

const SRC = new URL('../TLMLOGOTRANSPARENT.png', import.meta.url).pathname.replace(/^\//, '');
const OUT = new URL('../public/tlm-mark.png', import.meta.url).pathname.replace(/^\//, '');

// How far from pure white still counts as background.
const TOLERANCE = 26;
// Pixels within this distance of the keyed edge get their alpha ramped, so the
// mark does not end up with a hard aliased fringe.
const FEATHER = 1.6;

async function main() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;

  const isNearWhite = (i) =>
    data[i] >= 255 - TOLERANCE && data[i + 1] >= 255 - TOLERANCE && data[i + 2] >= 255 - TOLERANCE;

  // Flood fill from every border pixel.
  const bg = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, x + (h - 1) * w); }
  for (let y = 0; y < h; y++) { stack.push(y * w, w - 1 + y * w); }

  while (stack.length) {
    const p = stack.pop();
    if (bg[p]) continue;
    if (!isNearWhite(p * ch)) continue;
    bg[p] = 1;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0)     stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0)     stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }

  // Apply the mask, feathering the boundary by distance to the nearest kept pixel.
  for (let p = 0; p < w * h; p++) {
    if (!bg[p]) continue;
    const x = p % w;
    const y = (p - x) / w;
    let touchesInk = false;
    for (let dy = -1; dy <= 1 && !touchesInk; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (!bg[ny * w + nx]) { touchesInk = true; break; }
      }
    }
    data[p * ch + 3] = touchesInk ? Math.round(255 / (1 + FEATHER)) : 0;
  }

  const keyed = await sharp(data, { raw: { width: w, height: h, channels: ch } }).png().toBuffer();

  // Trim the now-transparent margin, then letterbox into a square canvas so the
  // mark drops into any square box without the aspect ratio shifting.
  const trimmed = await sharp(keyed).trim({ threshold: 1 }).toBuffer();
  const meta = await sharp(trimmed).metadata();

  await sharp(trimmed)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(OUT);

  const out = await sharp(OUT).metadata();
  console.log(`tlm-mark.png written: ${out.width}x${out.height}, alpha=${out.hasAlpha} (trimmed from ${meta.width}x${meta.height})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
