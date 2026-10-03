import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const brand = JSON.parse(readFileSync(new URL('../src/brand-config.json', import.meta.url), 'utf8'));
const replacements = {
  __BRAND_NAME__: brand.name,
  __BRAND_MARK__: brand.mark,
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
