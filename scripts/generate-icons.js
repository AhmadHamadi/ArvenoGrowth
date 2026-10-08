import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url));

const pngIcon = (size) => sharp(svg).resize(size, size).png().toBuffer();
for (const [filename, size] of [
  ['favicon-32.png', 32],
  ['favicon-48.png', 48],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512]
]) {
  await writeFile(new URL(`../public/${filename}`, import.meta.url), await pngIcon(size));
}

// ICO can contain a PNG payload, which preserves the crisp 256px render.
const iconPng = await pngIcon(256);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);  // reserved
header.writeUInt16LE(1, 2);  // icon resource
header.writeUInt16LE(1, 4);  // one image
header.writeUInt8(0, 6);    // 256px wide
header.writeUInt8(0, 7);    // 256px high
header.writeUInt8(0, 8);    // no palette
header.writeUInt8(0, 9);    // reserved
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(iconPng.length, 14);
header.writeUInt32LE(header.length, 18);
await writeFile(new URL('../public/favicon.ico', import.meta.url), Buffer.concat([header, iconPng]));
