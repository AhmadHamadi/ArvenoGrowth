import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';

const brand = JSON.parse(readFileSync(new URL('./src/brand-config.json', import.meta.url), 'utf8'));

function brandVariables() {
  const htmlEscape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const replaceTokens = (content) => String(content)
    .replaceAll('__BRAND_NAME__', () => htmlEscape(brand.name))
    .replaceAll('__BRAND_MARK__', () => htmlEscape(brand.mark))
    .replaceAll('__SITE_ORIGIN__', () => htmlEscape(brand.siteOrigin))
    .replaceAll('__BRAND_ID__', () => brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  return {
    name: 'brand-variables',
    transformIndexHtml(html) {
      return replaceTokens(html);
    },
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'asset' && typeof output.source === 'string') {
          output.source = replaceTokens(output.source);
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), brandVariables()],
  build: {
    rollupOptions: {
      // Multi-page build: the marketing site (index.html), the standalone
      // ROI calculator (calculator.html → /calculator), and the application
      // funnel (apply.html → /apply, thank-you.html → /thank-you).
      input: {
        main:       fileURLToPath(new URL('./index.html', import.meta.url)),
        calculator: fileURLToPath(new URL('./calculator.html', import.meta.url)),
        apply:      fileURLToPath(new URL('./apply.html', import.meta.url)),
        thankyou:   fileURLToPath(new URL('./thank-you.html', import.meta.url)),
        contract:   fileURLToPath(new URL('./contract.html', import.meta.url)),
        sign:       fileURLToPath(new URL('./sign.html', import.meta.url)),
        contracts:  fileURLToPath(new URL('./contracts.html', import.meta.url)),
        deck:       fileURLToPath(new URL('./deck.html', import.meta.url)),
        services:   fileURLToPath(new URL('./services/index.html', import.meta.url)),
        websites:   fileURLToPath(new URL('./services/websites.html', import.meta.url)),
        googleAds:  fileURLToPath(new URL('./services/google-ads.html', import.meta.url)),
        localSeo:   fileURLToPath(new URL('./services/local-seo.html', import.meta.url)),
        aiSearch:   fileURLToPath(new URL('./services/ai-visibility.html', import.meta.url)),
        tracking:   fileURLToPath(new URL('./services/lead-tracking.html', import.meta.url)),
        consulting:   fileURLToPath(new URL('./services/growth-consulting.html', import.meta.url)),
        coverage:     fileURLToPath(new URL('./coverage/index.html', import.meta.url)),
        solutions:    fileURLToPath(new URL('./solutions/index.html', import.meta.url)),
        blog:         fileURLToPath(new URL('./blog/index.html', import.meta.url)),
        articleBudget:fileURLToPath(new URL('./blog/contractor-marketing-budget.html', import.meta.url)),
        articleAgency:fileURLToPath(new URL('./blog/choose-contractor-marketing-agency.html', import.meta.url)),
        articleAdsSeo:fileURLToPath(new URL('./blog/google-ads-vs-seo-contractors.html', import.meta.url)),
        articleTracking:fileURLToPath(new URL('./blog/track-contractor-leads.html', import.meta.url)),
        articleWebsite:fileURLToPath(new URL('./blog/contractor-website-quote-checklist.html', import.meta.url))
      }
    }
  },
  server: {
    port: 5173,
    open: true,
    watch: {
      // Ignore nested Next.js / build / vendor directories so the file
      // watcher never tries to lstat their cache files (Windows-prone).
      ignored: [
        '**/TLMportal/**',
        '**/.next/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/.vercel/**',
        '**/.git/**'
      ]
    }
  }
});
