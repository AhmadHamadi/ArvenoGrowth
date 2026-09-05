/**
 * Generates the 1200x630 Open Graph card for /apply.
 * Run: node scripts/make-apply-og.js
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
    <radialGradient id="glow1" cx="0.1" cy="0.9" r="0.55">
      <stop offset="0%" stop-color="#1E55C7" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#1E55C7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.92" cy="0.1" r="0.5">
      <stop offset="0%" stop-color="#F37021" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#F37021" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow1)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>

  <g stroke="rgba(255,255,255,0.04)" stroke-width="1">
    ${Array.from({ length: 13 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="${H}"/>`).join('')}
    ${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 100}" x2="${W}" y2="${i * 100}"/>`).join('')}
  </g>

  <!-- Orange rule, matching the site's guarantee band -->
  <rect x="80" y="96" width="88" height="5" fill="#F37021"/>

  <text x="80" y="150" fill="#F37021" font-family="Inter, system-ui, sans-serif" font-size="21" font-weight="800" letter-spacing="5.5">
    NOW ACCEPTING CONTRACTOR APPLICATIONS
  </text>

  <text x="80" y="248" fill="#FFFFFF" font-family="'Plus Jakarta Sans', Inter, sans-serif" font-size="66" font-weight="900">
    Apply for your free
  </text>
  <text x="80" y="326" fill="#F37021" font-family="'Plus Jakarta Sans', Inter, sans-serif" font-size="66" font-weight="900">
    marketing audit
  </text>

  <text x="80" y="398" fill="rgba(255,255,255,0.75)" font-family="Inter, system-ui, sans-serif" font-size="26" font-weight="500">
    Five questions. About 60 seconds. We tear apart
  </text>
  <text x="80" y="436" fill="rgba(255,255,255,0.75)" font-family="Inter, system-ui, sans-serif" font-size="26" font-weight="500">
    your site, your Google profile, and your ad spend.
  </text>

  <!-- Trust pills -->
  ${[
    ['Contractors only', 80],
    ['Free audit, yours to keep', 340],
    ['No contracts', 700]
  ].map(([label, x]) => {
    const w = label.length * 12.2 + 46;
    return `
      <rect x="${x}" y="510" width="${w}" height="52" rx="26" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.16)"/>
      <circle cx="${x + 26}" cy="536" r="5.5" fill="#34A853"/>
      <text x="${x + 42}" y="544" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="19" font-weight="700">${label}</text>`;
  }).join('')}
</svg>
`;

async function main() {
  const logo = await sharp(join(PUBLIC, 'tlmlogo.png'))
    .resize({ width: 300, height: 300, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  const composite = [{ input: logo, left: W - 300 - 80, top: 150 }];

  await sharp(Buffer.from(svg)).composite(composite)
    .png({ quality: 88, compressionLevel: 9 })
    .toFile(join(PUBLIC, 'og-apply.png'));

  await sharp(Buffer.from(svg)).composite(composite)
    .webp({ quality: 80 })
    .toFile(join(PUBLIC, 'og-apply.webp'));

  console.log('og-apply.png + og-apply.webp generated at 1200x630');
}

main().catch((e) => { console.error(e); process.exit(1); });
