# Technical SEO review — 6 October 2026

## Scope and verified findings

Reviewed the existing 47-page production build, source sitemap/robots configuration, canonical branding configuration, JSON-LD, internal HTML links and fragment targets, and Vercel routing configuration. This is a local-build audit, not a claim that production URLs are indexed or that Search Console has been verified.

- Public pages have distinct titles and meta descriptions in the audited build. The canonical origin is consistently `https://www.arvenogrowth.com` from `src/brand-config.json`.
- JSON-LD parses successfully. Organization markup describes US and Canadian coverage without inventing physical local offices. No `AggregateRating` markup was found.
- The generated sitemap now contains 40 intended public canonical URLs. Application, contract, signing, confirmation, internal presentation, and hidden testimonial pages are excluded.
- The generator validates that every included page has exactly one canonical on the configured origin without query strings or fragments. Duplicate canonical destinations cause a build error. Metadata parsing tolerates different attribute order and quote styles.
- Removed automatically refreshed build-date `lastmod` values. Those implied every page had a significant content change on every build. Dates can be reinstated when reliable content modification records exist. Removed ignored priority values from the source snapshot.
- Removed robots disallows for HTML pages that carry `noindex`, so crawlers can fetch those pages and read the directive. `/api/` remains disallowed. Robots directives do not protect private information; contract access still needs the application's existing access controls.
- No `llms.txt` was added. Google says ordinary SEO fundamentals apply to its AI search features, with no additional machine-readable file requirement.

## Source fixes handed to the main editing agent

1. `referrals/index.html` had three same-page fragments with no targets: `#services`, `#reviews`, and `#contact`. Point these to the appropriate homepage sections; use `/#audit-form` for contact.
2. `testimonials/index.html` still declared `index,follow` despite the request to hide that page. Set `noindex,follow` until approved videos/content are ready. Remove its duplicated, unrelated AboutPage schema.
3. `plans/index.html` had a copied AboutPage schema named “About Arveno Growth”; its type/name should describe the actual plans page.
4. `blog/contractor-keyword-research.html` had the budget article's headline inside Article schema. Match the visible keyword-research heading.

These items require verification in the next production build after the coordinating agent's edits. The static link check ignores JS-generated content; browser checks cover interactive routes separately.

## Deployment checks still required

- Configure the custom domain and permanent apex-to-www redirect in the actual Vercel project. Local configuration establishes the preferred canonical host but does not prove a project-level domain redirect exists.
- Vercel defines rewrites for extensionless calculator/application/internal routes. Canonical tags identify the public calculator URL as `/calculator`. Consider permanent redirects for `/calculator.html` and `/index.html` only after checking the deployed route behavior; do not introduce rewrite/redirect loops.
- Fetch the deployed sitemap, robots, public pages, and noindex pages over HTTPS; verify status codes, headers, canonical host redirects, assets, and forms.
- Verify domain ownership in Google Search Console, submit `/sitemap.xml`, and use URL Inspection for representative homepage, service, industry, and article pages. Indexing and AI citation decisions remain with search engines.
- Confirm search eligibility through Search Console and real crawl data rather than assuming successful local builds guarantee indexing.

## Content and local-search guardrails

Each service/industry/article should answer a distinct visitor need. Internal links should connect the relevant service, supporting guide, applicable industry, and free-audit destination. A high word count alone does not establish usefulness. Location coverage must reflect real service availability; do not publish repeated city-name pages or imply local offices where none exist. Published client metrics and testimonials need accurate, approved supporting records.

## Official guidance consulted

- [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap): use preferred canonical URLs; `lastmod` must reflect significant changes; sitemap submission does not guarantee crawling.
- [Google: block indexing with noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing): the crawler must access a page to see its noindex instruction.
- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features): established SEO requirements apply; useful, crawlable content is the foundation, not special AI markup or a promise of inclusion.

## Implementation follow-up — 7 October 2026

The referral fragments, hidden-testimonial noindex, copied plans schema, and keyword-guide headline fixes listed above are now applied in source. Eight service pages were expanded with distinct intent, relevant internal links, and real licensed photographs. Images use descriptive filenames, subject-accurate alt text, explicit dimensions, and responsive WebP sources at 480, 800, and 1200 pixels. Credits are in `docs/IMAGE-CREDITS.md`.

The public-site crawler rule allows OAI-SearchBot under the wildcard group. This does not verify hosting firewall access or establish that ChatGPT has crawled or cited the site. [OpenAI's crawler documentation](https://developers.openai.com/api/docs/bots) distinguishes its search crawler from training and user-triggered fetching. No training preference was changed.

Current primary guidance checked on 7 October 2026:

- [Google image guidance](https://developers.google.com/search/docs/appearance/google-images): filenames provide limited subject clues; useful alt text and surrounding content matter. Renaming licensed stock does not make it original project evidence.
- [Google helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content): Google specifies no preferred word count. Content expansion here answers customer questions and clarifies service scope, rather than meeting a claimed ranking threshold.
- [Google local ranking guidance](https://support.google.com/business/answer/7091?hl=en): national service availability does not remove relevance, distance, and prominence from local results.

No Search Console exports, analytics conversions, Bing Webmaster data, hosting logs, or controlled AI-citation baseline were supplied. Search-volume estimates and ranked visibility gains are therefore not claimed. Production verification is still required after the domain and Vercel project are connected.

## Final local verification — October 7, 2026

- Expanded all eight service pages (890–971 words), all twelve industry pages (823–879 words), and all nine articles (817–924 words), measured from main HTML content. These counts satisfy the requested content scope; they are not a ranking claim.
- Added responsive 480/800/1200px real photographs to the service pages, with descriptive alternative text and source records in IMAGE-CREDITS.md.
- Corrected the deck-builder benchmark link to the 2026 cross-industry source. Removed a garage-door statistic whose linked source did not support it. Rechecked the published junk-removal and tree-service data against the original provider reports.
- Production build passed. Sitemap generation validated 40 distinct public canonical URLs. Internal application, signing, presentation, confirmation, and hidden testimonial routes remain excluded.
- Static audit checked 47 built HTML files, 2,364 internal links/image paths, and 20 JSON-LD blocks: no broken files/fragments or malformed JSON-LD.
- Browser checks passed: 70 navigation/trust-bar/case-study/service checks and 150 calculator/guarantee/responsive checks. Widths included 320, 390, 1121, and 1440 pixels.
- All 47 routes returned successfully in desktop and mobile browser sweeps without horizontal overflow, unresolved brand tokens, or JavaScript errors. The internal presentation deck intentionally has slide headings and no public navigation; its two H1s are not a public-page SEO failure.
- Visually reviewed updated service CTAs, service imagery, industry content, guide typography, blog listing, referral layout, trust bar, and case-study presentation. Fixed dark headings on dark CTA backgrounds and malformed blog-card placement.
- No production deployment, Search Console indexing, live form delivery, AI citation, or search ranking is established by these local checks. Form and contract checks from the earlier audit used controlled/stubbed delivery; they did not send customer email.
- Homepage performance terms retain the existing 90-day eligibility period in the small print, while the main offer is concise. A replacement measurement period needs a business decision before contract terms change.
- Do not publish invented IKAD/Tridan results or an unsupported $1M revenue claim. Those claims still require genuine records and permission. Seven Stones calculations derive from the owner-supplied $25k/$80k figures, with evidence limitations visible.
