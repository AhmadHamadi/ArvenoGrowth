import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
        consulting:fileURLToPath(new URL('./services/growth-consulting.html', import.meta.url))
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
