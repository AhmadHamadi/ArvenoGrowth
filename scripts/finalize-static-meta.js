import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

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
// Attribute order and quote style must not change sitemap eligibility.
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)]
    .map((match) => [match[1].toLowerCase(), match[3]]));
}
const excludedRoutes = new Set([
  'apply.html', 'contract.html', 'contracts.html', 'sign.html',
  'deck.html', 'thank-you.html', 'testimonials/index.html'
]);
const origin = new URL(brand.siteOrigin).origin;
const sitemapUrls = htmlFiles.flatMap((path) => {
  const html = readFileSync(path, 'utf8');
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const robots = metaTags.filter((tag) => ['robots', 'googlebot'].includes(tag.name?.toLowerCase()))
    .map((tag) => tag.content || '').join(',');
  if (excludedRoutes.has(relative(resolve('dist'), path).replaceAll('\\', '/')) || /\bnoindex\b/i.test(robots)) return [];
  const canonicals = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => attributes(tag))
    .filter((tag) => tag.rel?.toLowerCase().split(/\s+/).includes('canonical'));
  if (canonicals.length !== 1 || !canonicals[0].href) {
    throw new Error(`Indexable page needs exactly one canonical URL: ${path}`);
  }
  const canonical = new URL(canonicals[0].href);
  if (canonical.origin !== origin || canonical.hash || canonical.search) {
    throw new Error(`Invalid canonical URL on ${path}: ${canonical.href}`);
  }
  return [canonical.href];
});
if (new Set(sitemapUrls).size !== sitemapUrls.length) {
  throw new Error('Indexable pages share a canonical URL; resolve the duplicate before publishing.');
}
const uniqueUrls = [...new Set(sitemapUrls)].sort((a, b) => a.localeCompare(b));
// Do not stamp every page with the build date. lastmod is optional and should
// only be supplied when a reliable significant-content modification date exists.
const xmlEscape = (value) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
})[char]);
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueUrls.map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
writeFileSync(resolve('dist/sitemap.xml'), xml);
console.log(`Sitemap: ${uniqueUrls.length} public canonical URLs validated.`);
