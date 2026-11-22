# Arveno Growth shared context

Reviewed 4 November 2026 against the live site with Playwright MCP and the local `Website` workspace. This is a dated working brief for assistants collaborating on Arveno Growth. Treat the live site as the current public presentation and verify it again before quoting time-sensitive details. Treat the local tree as the source under review, not as a guarantee of what is deployed.

**Update 19 November 2026:** Use the dated corrections below for current no-pricing positioning, guarantee versions, client-reported figures and currency; older text in this November 4 review has been superseded where stated.

## Business and positioning

Arveno Growth is a remote marketing, AI implementation, and growth consulting partner for contractors and local service businesses. Its public promise is to help turn relevant local demand into enquiries, booked estimates, and work the client can deliver. The approach is business-first: understand the services, target work, service territory, economics, response process, and capacity; choose a small set of appropriate actions; then measure useful outcomes and improve.

The site says support is available across all 50 US states and Canada, while clarifying that remote availability does not create a local office or guarantee local map visibility. Client work shown publicly is Canadian. Public contact: (289) 489-1167, info@arvenogrowth.com. Legal entity in local brand config: Ahmad Hamadi Consulting Inc.

## Services

- **Websites:** improve an existing site when practical or build clear, mobile-friendly pages organized around real services and territories; place authentic proof near contact actions; make phone, forms, accessibility, speed, search fundamentals, ownership, and launch handoff part of the work.
- **Google Ads:** structure campaigns by service, intent, and territory; review queries and exclusions; align ads with landing pages; test calls/forms and routing; report platform spend separately from service fees; assess qualified opportunities and downstream outcomes instead of clicks alone.
- **Local SEO:** accurate Google Business Profile and directory details, useful service and location content, technical/indexability foundations, internal links, and genuine review/project evidence. Do not create repetitive city pages, imply offices that do not exist, or promise a map position.
- **AI search visibility:** make authentic expertise, business details, and service information clear and crawlable; answer customer questions with original useful content; use structured data only when it reflects visible facts. No guaranteed AI inclusion or citations.
- **AI consulting and automation:** start from a real workflow or bottleneck; assess tools, data, access, consent, and quality; implement with human review and clear ownership; measure whether it saves time or improves the process. Do not add AI for its own sake.
- **Lead tracking and follow-up:** connect calls/forms and marketing sources to a simple CRM process; distinguish enquiries, qualified opportunities, estimates, won/lost jobs, completed work, revenue, and gross profit; use reliable records and consent-aware tracking.
- **Growth consulting:** connect strategy to service/customer fit, margins, sales process, seasonality, geography, capacity, and budget; produce prioritized actions with owners, evidence, and review dates; help implement when appropriate.

The industry directory covers auto repair, HVAC/mechanical, roofing, landscaping, remodeling/general contracting, plumbing, electrical contractors, deck builders, garage doors, med spas, tree services, and junk removal.

## Internal package reference (not public pricing)

The website no longer displays package prices. The internal reference below is in USD; ad spend is separate and client scope/terms must be confirmed in writing. Do not copy these prices into the four-slide pitch or public copy without a current owner decision:

| Package | Monthly fee | Published setup | Scope summary |
|---|---:|---:|---|
| Foundation Engine | $297 | $0; 12-month commitment | Five-page SEO-friendly website, basic AI follow-up, review management, appointment booking |
| AI Visibility | $597 | $1,000 | Google Business Profile, local SEO, AI search visibility, website SEO, reputation work |
| Lead Engine | $797 | $1,000 | Google Ads, landing page, conversational AI follow-up/qualification/booking, CRM and lead tracking |
| Growth Engine | $997 | $2,000 standard; $1,000 promo through Nov. 30, 2026 | Lead Engine plus AI Visibility, paid and organic acquisition, follow-up, tracking/reporting |

Current internal note: the Growth Engine setup promotion is $1,000 through **November 30, 2026**; its standard setup fee is $2,000. Ad spend is separate. Verify against the signed agreement before quoting. Setup fees are due before work starts, with installments only by agreement.

## Guarantee and sales path

As of Nov. 19, 2026, new agreements version 4+ use setup completed within 7 days of the agreed Setup Start Date or the setup fee is waived; unpaid setup installments are canceled. Older signed agreements retain their stated 14-day term. The live homepage says “waived or refunded,” which must be reconciled with the signed agreement before further guarantee changes; do not promise a setup refund unless that specific agreement provides it. After the first three paid monthly service fees, if verified CRM-tracked gross profit from eligible projects has not covered those fees, monthly service billing pauses while included work continues, subject to the contract. Setup, ad spend, taxes, software, and third-party costs are excluded; fees already paid are not refunded. Maintaining the agreed ad budget and CRM tracking, accurate records, access, and replies within one business day are conditions. See the current wording and unresolved copy discrepancy in `docs/GUARANTEE-COPY.md`.

The homepage’s current CTA is a free, no-pressure review/consultation intake. The form asks for contact information, business, services, and an optional website and goal/question message; the team follows up and opens a booking calendar. The intent is a useful conversation about goals and fit, not a hard sell.

## Evidence and claim guardrails

Public case examples are Seven Stones Landscape, IKAD Mechanical, and Tridan Contracting. All three revenue examples are client-reported Canadian dollars from Ontario; the owner confirmed ad-use approval and backup records were available on Nov. 17, 2026. Seven Stones reported $25k to $85k monthly over four months; IKAD reported $48k to $60k monthly; Tridan reported $33k to $46k monthly. Comparison periods for IKAD and Tridan are not stated here. Figures have not been independently audited. Estimated job equivalents are calculations from stated assumptions, not CRM-verified job counts. A Seven Stones website slider documents a site comparison, not advertising or ranking impact. Do not infer causal impact or ROI from those facts.

The local evidence memo `docs/case-study-evidence-needed.md` says auditable lead, ad-spend, revenue, and return records were not in the reviewed project materials and lists what is needed to support stronger claims. The live homepage now also says **“$1M+ client revenue generated.”** That aggregate claim was not supported by the reviewed case-study evidence memo; it needs substantiation, methodology, and permission before it is repeated as verified fact.

The site’s approach page disclaims exact rankings, AI citations, fixed lead counts, and automatic revenue returns. Keep observed facts, client statements, calculations, and estimates clearly distinct.

## Website and operational assets

Public resources include industry solution pages, marketing guides/blog, FAQs, US/Canada coverage, referrals, revenue/ad-budget calculator, testimonials, case studies, and a contract generator. The local app also includes Vercel API routes and workflows for lead intake, booking follow-up, contracts/e-signing, CRM clients/leads/tasks, Stripe billing, and admin views. `CONTRACT_CRM_SETUP.md` is the operational map; treat it as sensitive implementation context and never expose credentials or change production billing/deployment without a separate explicit task.

The calculator is a planning tool, not a forecast: its preset industry CPLs, job values, 25% close rate, and 40% gross margin are assumptions; it discloses limits and excludes factors such as overhead, taxes, cancellations, and repeat sales. See `CALCULATOR-BENCHMARKS.md` and `src/calculator-data.js` before describing its methodology.

Brand kit: navy/electric/sky blue, white, modern AG monogram and wordmark; preserve existing brand choices. The website should remain trade-specific, plain-spoken, proof-aware, and clear about who the offer fits. Stock/illustrative images are labeled as such. Do not invent customer results, testimonials, service capabilities, offices, or AI/search promises.

## Live site vs. local workspace

During the Playwright review, the live homepage used the headline “More of the right work. A clearer way to grow,” a “Find your best growth option” form, a “$1M+ client revenue generated” trust-bar claim, and a shorter US-only remote-support label. The local `Website/index.html` still contains the earlier headline/form and says “Canada-based client work shown transparently.” The live and local package pages both still displayed the expired October 31 setup promotion. Reconcile source and deployment deliberately before future edits; do not assume the current local source exactly matches production.

The `Website` Git checkout was on `feature/arveno-growth-website` at `815f49c` and already had many modified and untracked files during this review. Preserve those changes; inspect `git status` before editing and do not overwrite or revert them.

## Claude handoff

This note is in the shared Website workspace. Claude Code can use it when working in this same checkout. The Claude account/project page was not accessible from the Playwright session (HTTP 403), and no Arveno-specific local Claude Code project record was available. A separate Claude Project will need this file uploaded or its contents added to that Project’s knowledge/instructions; this review could not directly update or message that project.

## Sources checked

- Live homepage: https://www.arvenogrowth.com/
- Services overview and detail pages: https://www.arvenogrowth.com/services/ and its seven linked detail pages
- Packages: https://www.arvenogrowth.com/plans/
- Industry overview: https://www.arvenogrowth.com/solutions/
- About and approach: https://www.arvenogrowth.com/about/ and https://www.arvenogrowth.com/our-approach/
- Client work: https://www.arvenogrowth.com/case-studies/
- Local source/docs: `README.md`, `src/brand-config.json`, service and industry HTML, `docs/case-study-evidence-needed.md`, `docs/GUARANTEE-COPY.md`, `CALCULATOR-BENCHMARKS.md`, `CONTRACT_CRM_SETUP.md`, and dated SEO/content reviews.
