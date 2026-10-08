import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const brand = JSON.parse(readFileSync(new URL('./src/brand-config.json', import.meta.url), 'utf8'));

function brandVariables() {
  const htmlEscape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const replaceTokens = (content) => String(content)
    .replaceAll('__BRAND_NAME__', () => htmlEscape(brand.name))
    .replaceAll('__BRAND_MARK__', () => htmlEscape(brand.mark))
    .replaceAll('__BRAND_EMAIL__', () => htmlEscape(brand.contactEmail))
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
  plugins: [react(), brandVariables(), tailwindcss()],
  build: {
    rollupOptions: {
      // Multi-page build: the marketing site (index.html), the standalone
      // ROI calculator (calculator.html → /calculator), and the application
      // funnel (apply.html → /apply, thank-you.html → /thank-you).
      input: {
        main:       fileURLToPath(new URL('./index.html', import.meta.url)),
        admin:      fileURLToPath(new URL('./admin.html', import.meta.url)),
        calculator: fileURLToPath(new URL('./calculator.html', import.meta.url)),
        apply:      fileURLToPath(new URL('./apply.html', import.meta.url)),
        thankyou:   fileURLToPath(new URL('./thank-you.html', import.meta.url)),
        contract:   fileURLToPath(new URL('./contract.html', import.meta.url)),
        sign:       fileURLToPath(new URL('./sign.html', import.meta.url)),
        contracts:  fileURLToPath(new URL('./contracts.html', import.meta.url)),
        deck:       fileURLToPath(new URL('./deck.html', import.meta.url)),
        services:   fileURLToPath(new URL('./services/index.html', import.meta.url)),
        about:      fileURLToPath(new URL('./about/index.html', import.meta.url)),
        plans:      fileURLToPath(new URL('./plans/index.html', import.meta.url)),
        testimonials: fileURLToPath(new URL('./testimonials/index.html', import.meta.url)),
        referrals: fileURLToPath(new URL('./referrals/index.html', import.meta.url)),
        caseStudies: fileURLToPath(new URL('./case-studies/index.html', import.meta.url)),
        keywordResearch: fileURLToPath(new URL('./blog/contractor-keyword-research.html', import.meta.url)),
        websites:   fileURLToPath(new URL('./services/websites.html', import.meta.url)),
        googleAds:  fileURLToPath(new URL('./services/google-ads.html', import.meta.url)),
        localSeo:   fileURLToPath(new URL('./services/local-seo.html', import.meta.url)),
        aiSearch:   fileURLToPath(new URL('./services/ai-visibility.html', import.meta.url)),
        aiAutomation: fileURLToPath(new URL('./services/ai-automation.html', import.meta.url)),
        tracking:   fileURLToPath(new URL('./services/lead-tracking.html', import.meta.url)),
        consulting:   fileURLToPath(new URL('./services/growth-consulting.html', import.meta.url)),
        coverage:     fileURLToPath(new URL('./coverage/index.html', import.meta.url)),
        solutions:    fileURLToPath(new URL('./solutions/index.html', import.meta.url)),
        autoRepair:   fileURLToPath(new URL('./solutions/auto-repair-marketing.html', import.meta.url)),
        hvac:         fileURLToPath(new URL('./solutions/hvac-marketing.html', import.meta.url)),
        roofing:      fileURLToPath(new URL('./solutions/roofing-marketing.html', import.meta.url)),
        landscaping:  fileURLToPath(new URL('./solutions/landscaping-marketing.html', import.meta.url)),
        remodeling:   fileURLToPath(new URL('./solutions/remodeling-marketing.html', import.meta.url)),
        deckBuilder:  fileURLToPath(new URL('./solutions/deck-builder-marketing.html', import.meta.url)),
        garageDoors:  fileURLToPath(new URL('./solutions/garage-door-marketing.html', import.meta.url)),
        medSpa:       fileURLToPath(new URL('./solutions/med-spa-marketing.html', import.meta.url)),
        treeService:  fileURLToPath(new URL('./solutions/tree-service-marketing.html', import.meta.url)),
        junkRemoval:  fileURLToPath(new URL('./solutions/junk-removal-marketing.html', import.meta.url)),
        plumbing:    fileURLToPath(new URL('./solutions/plumbing-marketing.html', import.meta.url)),
        electrical:  fileURLToPath(new URL('./solutions/electrical-contractor-marketing.html', import.meta.url)),
        faq:          fileURLToPath(new URL('./faq/index.html', import.meta.url)),
        approach:     fileURLToPath(new URL('./our-approach/index.html', import.meta.url)),
        blog:         fileURLToPath(new URL('./blog/index.html', import.meta.url)),
        guide0: fileURLToPath(new URL('./blog/ai-search-visibility-service-businesses.html', import.meta.url)),
        guide1: fileURLToPath(new URL('./blog/service-area-pages-local-seo.html', import.meta.url)),
        guide2: fileURLToPath(new URL('./blog/missed-call-follow-up-service-businesses.html', import.meta.url)),
        guide3: fileURLToPath(new URL('./blog/service-business-website-image-seo.html', import.meta.url)),
        ghlGuide: fileURLToPath(new URL('./blog/gohighlevel-crm-service-businesses.html', import.meta.url)),
        ontarioCoverage: fileURLToPath(new URL('./coverage/ontario.html', import.meta.url)),
        articleBudget:fileURLToPath(new URL('./blog/contractor-marketing-budget.html', import.meta.url)),
        articleAgency:fileURLToPath(new URL('./blog/choose-contractor-marketing-agency.html', import.meta.url)),
        articleAdsSeo:fileURLToPath(new URL('./blog/google-ads-vs-seo-contractors.html', import.meta.url)),
        articleTracking:fileURLToPath(new URL('./blog/track-contractor-leads.html', import.meta.url)),
        articleWebsite:fileURLToPath(new URL('./blog/contractor-website-quote-checklist.html', import.meta.url)),
        articleAutoAds:fileURLToPath(new URL('./blog/google-ads-for-auto-repair-shops.html', import.meta.url)),
        articleLeads:fileURLToPath(new URL('./blog/how-contractors-get-more-leads.html', import.meta.url)),
        articleBenchmarks:fileURLToPath(new URL('./blog/2026-search-ad-benchmarks.html', import.meta.url)),
        articleAutoLocalSeo:fileURLToPath(new URL('./blog/auto-repair-google-business-profile-local-seo.html', import.meta.url))
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
