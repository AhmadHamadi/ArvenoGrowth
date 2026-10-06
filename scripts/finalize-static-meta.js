import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const brand = JSON.parse(readFileSync(new URL('../src/brand-config.json', import.meta.url), 'utf8'));
const replacements = {
  __BRAND_NAME__: brand.name,
  __BRAND_MARK__: brand.mark,
  __BRAND_EMAIL__: brand.contactEmail,
  __SITE_ORIGIN__: brand.siteOrigin,
  __BRAND_ID__: brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
};

for (const file of ['site.webmanifest', 'robots.txt', 'sitemap.xml']) {
  const path = resolve('dist', file);
  let content = readFileSync(path, 'utf8');
  for (const [token, value] of Object.entries(replacements)) {
    content = content.replaceAll(token, () => value);
  }
  writeFileSync(path, content);
}

// Keep the sitemap in sync with the actual built, indexable HTML pages.
// Noindex contract, application, and confirmation routes are intentionally omitted.
const htmlFiles = [];
function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith('.html')) htmlFiles.push(path);
  }
}
walk(resolve('dist'));
const sitemapUrls = htmlFiles.flatMap((path) => {
  const html = readFileSync(path, 'utf8');
  const robots = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i)?.[1] || '';
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i)?.[1];
  if (!canonical || /noindex/i.test(robots)) return [];
  return [canonical];
});
const uniqueUrls = [...new Set(sitemapUrls)].sort((a, b) => a.localeCompare(b));
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueUrls.map((url) => `  <url><loc>${url.replaceAll('&', '&amp;')}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
writeFileSync(resolve('dist/sitemap.xml'), xml);
