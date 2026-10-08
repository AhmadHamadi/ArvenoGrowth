# Fresh technical SEO review

Date: 8 October 2026. Commit inspected: `cddae78`. Working tree was clean at the start. Audited existing `dist/` output (53 HTML routes) against current source metadata and build routing. No shared site files were edited and no deployment was performed.

## Concrete findings

### 1. Production origin could not be resolved from this environment — deployment blocker to verify

Python `urllib.request.urlopen` failed for the apex homepage, www homepage, www robots.txt, and www sitemap.xml with `[Errno 8] nodename nor servname provided, or not known`. A follow-up `socket.getaddrinfo` successfully resolved `example.com` and `google.com` while both Arveno hostnames failed.

Consequently, this audit cannot confirm a working public site, redirects, crawler responses, indexing, or AI-search access on the canonical origin. Confirm domain registration/DNS and the Vercel custom-domain connection, then fetch these endpoints again. This is an observed resolver failure here, not proof of the exact DNS configuration or a claim about all resolvers.

### 2. Source sitemap snapshot omits six routes — maintenance issue, production generator is correct

`public/sitemap.xml` contains 40 URLs, while the finalized `dist/sitemap.xml` correctly contains all 46 public canonical URLs. Missing from the source snapshot:

- `/blog/ai-search-visibility-service-businesses.html`
- `/blog/gohighlevel-crm-service-businesses.html`
- `/blog/missed-call-follow-up-service-businesses.html`
- `/blog/service-area-pages-local-seo.html`
- `/blog/service-business-website-image-seo.html`
- `/coverage/ontario.html`

The configured `npm run build` runs `scripts/finalize-static-meta.js`, which regenerates the sitemap from the built HTML, so these routes are not missing from the production artifact. Synchronize the source snapshot or document it as a generated placeholder to prevent someone treating the stale development file as authoritative. Do not deploy `public/` directly.

## Checks with no confirmed defects

- 53 built HTML pages: 46 public and seven intentional noindex pages.
- All 46 public pages have a single canonical on `https://www.arvenogrowth.com`, distinct titles/descriptions/canonicals, and one H1.
- Sitemap membership matches all 46 public canonical URLs exactly; no missing or extra production URLs.
- Internal static HTML links, fragment targets, local image/script/stylesheet assets, and image alt attributes passed the check. Every public page has at least one static inbound link from another page.
- Source and build agree on titles, descriptions, canonical URLs, and H1 text for all pages.
- Every JSON-LD block parses. An automated equality check flagged the benchmark article's descriptive schema headline as different from its visible H1. Both describe the same article, so this was not classified as an error or an indexing blocker.
- Internal contract/signing/application/deck/confirmation pages and hidden testimonials have noindex directives and are absent from the sitemap. Robots allows those HTML pages to be fetched so crawlers can see noindex; only `/api/` is disallowed.
- No public noindex or nosnippet restriction was identified. Absence of `llms.txt` is not a Google AI-search defect; Google says no special AI file or schema is required.

## Commands and procedure

Executed from `/Users/ahmadhamadi/Desktop/Arveno Growth/Website`:

```sh
git rev-parse --short HEAD
git status --short
cat scripts/finalize-static-meta.js public/robots.txt src/brand-config.json
cat vercel.json
rg -n 'input:|fileURLToPath' vite.config.js
python3 /tmp/arveno-fresh-seo.py
```

The temporary Python audit used `html.parser.HTMLParser` on every `dist/**/*.html`, `json.loads` on JSON-LD, and `xml.etree.ElementTree` on the generated sitemap. It collected metadata, H1s, canonical URLs, IDs, and links; checked duplicates and sitemap membership; resolved local paths and anchors; and counted static inbound links. Additional inline Python checks compared source/build metadata, checked referenced local assets and image alts, compared source/production sitemaps, and used `urllib.request.urlopen` plus `socket.getaddrinfo` for the domain checks. Temporary detail output: `/tmp/arveno-fresh-seo.json`.

This was a technical document/code audit, not a new visual-browser audit or a Search Console inspection. JS-created links and client-rendered calculator content require the separate browser pass. A matching sitemap does not establish Google indexing.

## Skills and current guidance reviewed

Read the Desktop copies of `Skills/skills/SEO/agency-seo/SKILL.md`, `references/search.md`, and `references/ai-visibility.md`. Rechecked these official sources on 8 October 2026:

- [Google AI features and your website](https://developers.google.com/search/docs/appearance/ai-features): indexed, snippet-eligible pages and ordinary SEO foundations are relevant; no inclusion guarantee or special AI file requirement.
- [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing): a crawler needs access to the page to read its noindex instruction.

## Recheck after competitor and content review — 8 October 2026

- Added a distinct 1,259-word auto-repair local SEO / Google Business Profile guide with official Google references, trade-specific FAQs, internal links, responsive licensed photography, and matching Article metadata. Registered it in the multi-page build and blog index. The site now has 15 blog articles and 12 industry detail pages (plus their respective index pages).
- Shortened the only public title over 70 characters. Google does not prescribe a character cap for titles or descriptions; the review checked that all 47 public titles and descriptions are distinct, useful, and accurate, and that descriptions remain concise. Google can rewrite both title links and snippets for a query/device.
- Rebuilt the site: 54 HTML documents total, 47 public canonical sitemap URLs, seven intentional noindex routes. Source and generated sitemaps match exactly. Static audit passed with 2,891 internal links/assets and 27 parseable JSON-LD blocks, no missing targets or orphaned public pages.
- Browser route sweep passed all 54 routes at desktop/mobile; its only flagged route remains the private presentation deck, which intentionally has no public navigation and is noindex. Mobile checks passed at 320–430px, including bottom action links, form, reviews, calculator, and no horizontal overflow. Calculator tests passed at 320, 390, and 1440px.
- Independent visual recheck at 320px and 390px verified an 8px sticky-summary gap below the calculator header, 18–21px clearance between the mobile-nav CTA and fixed action bar, and three distinct images in the first blog row.
- Production-domain DNS still fails in this environment for both the apex and `www` host. Production crawlability, Search Console sitemap processing, and page indexing remain unverified until DNS resolves and the deployment is reachable.
- Competitor observations and recommended content priorities are in `docs/competitor-audit-2026-10-08.md` and `docs/fresh-keyword-content-review.md`. Search demand/rankings remain qualitative because no Search Console, keyword-volume, rank, or backlink export is connected.
