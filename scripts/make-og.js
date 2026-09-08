/**
 * Generates a proper 1200x630 Open Graph share card.
 * Run: node scripts/make-og.js
 */
import sharp from 'sharp';
import { join } from 'node:path';

const PUBLIC = new URL('../public/', import.meta.url).pathname.replace(/^\//, '');

const W = 1200;
const H = 630;

const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A1B3D"/>
      <stop offset="100%" stop-color="#06122B"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0.15" cy="0.85" r="0.5">
      <stop offset="0%" stop-color="#1E55C7" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#1E55C7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.9" cy="0.15" r="0.45">
      <stop offset="0%" stop-color="#F37021" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#F37021" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow1)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>

  <!-- subtle grid -->
  <g stroke="rgba(255,255,255,0.04)" stroke-width="1">
    ${Array.from({ length: 13 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="${H}"/>`).join('')}
    ${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 100}" x2="${W}" y2="${i * 100}"/>`).join('')}
  </g>

  <!-- Eyebrow -->
  <text x="80" y="180" fill="#F37021" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="800" letter-spacing="6">
    BUILT FOR CONTRACTORS
  </text>

  <!-- Headline -->
  <text x="80" y="270" fill="#FFFFFF" font-family="'Plus Jakarta Sans', Inter, sans-serif" font-size="78" font-weight="900">
    Trade Leads
  </text>
  <text x="80" y="360" fill="#FFFFFF" font-family="'Plus Jakarta Sans', Inter, sans-serif" font-size="78" font-weight="900">
    Marketing
  </text>

  <!-- Tagline -->
  <text x="80" y="445" fill="rgba(255,255,255,0.78)" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="500">
    Marketing that books
  </text>
  <text x="80" y="485" fill="rgba(255,255,255,0.78)" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="500">
    real contractor jobs.
  </text>

  <!-- URL pill -->
  <rect x="80" y="540" width="320" height="50" rx="25" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)"/>
  <circle cx="108" cy="565" r="5" fill="#34A853"/>
  <text x="125" y="572" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700">
    tradeleadsmarketing.com
  </text>
</svg>
`;

async function main() {
  const logo = await sharp(join(PUBLIC, 'tlmlogo.png'))
    .resize({ width: 360, height: 360, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  await sharp(Buffer.from(svg))
    .composite([{ input: logo, left: W - 360 - 80, top: H - 360 - 130 }])
    .png({ quality: 88, compressionLevel: 9 })
    .toFile(join(PUBLIC, 'og.png'));

  // WebP twin
  await sharp(Buffer.from(svg))
    .composite([{ input: logo, left: W - 360 - 80, top: H - 360 - 130 }])
    .webp({ quality: 80 })
    .toFile(join(PUBLIC, 'og.webp'));

  console.log('og.png + og.webp generated at 1200x630');
}

main().catch((e) => { console.error(e); process.exit(1); });
