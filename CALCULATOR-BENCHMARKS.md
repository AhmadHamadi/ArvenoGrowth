# Lead Calculator — Benchmark Data & Sources

This documents every number behind the `/calculator` trade dropdown, so any figure is
defensible on a sales call. Data compiled from a two-pass, multi-agent research sweep
(2024–2026 North American paid-search benchmarks).

**Last updated:** 16 Jul 2026

---

## Methodology

- **"CPL" here = Google Ads SEARCH cost per lead** (an inbound call or form-fill from a
  search campaign). This is deliberately **not** LSA (Local Services Ads) or shared-marketplace
  (Angi/HomeAdvisor/Thumbtack) pricing — those run 40–60% cheaper per lead but are lower-intent
  and/or sold to multiple contractors, so blending them in would understate real cost.
- **Job value = the ticket for a paid-search-acquired customer**, which skews toward
  installs/replacements/emergencies and is therefore **higher than the blended consumer average**
  reported by cost guides (which are dominated by small repairs).
- **Anchor datasets** (the two most methodology-backed, used to cross-check every trade):
  1. **LocaliQ 2025 Home Services Search Benchmarks** — 3,211 US campaigns, per-category medians.
  2. **SearchLight Digital 2026** — account aggregates from millions in real ad spend, CRM-attributed.
- **Important:** LocaliQ and WordStream are the **same company** (WordStream is a LocaliQ property),
  so they count as **one** independent dataset, not two. Independent cross-checks come from
  trade-specific agencies (SearchLight, Hook Agency, Richey, EverGrow, MDMPPC, etc.).
- All figures **USD**. For **CAD**, multiply by ~1.37 (2025–26).
- The calculator uses **cplLo → cplHi** to produce the leads range (`leads = spend ÷ CPL`), and
  `job value` to compute break-even (`jobs = ceil(spend ÷ job value)`).

---

## Reconciled data (what the calculator ships with)

| Trade | CPL low | CPL typical | CPL high | Job value (paid-lead) | Close rate | Confidence |
|---|--:|--:|--:|--:|--:|---|
| Roofing | $90 | $150 | $220 | $10,000 | ~20% | High |
| HVAC | $90 | $130 | $200 | $8,000 | ~40% | High |
| Plumbing | $90 | $150 | $185 | $1,700 | ~18% | Med-High |
| Electrical | $90 | $120 | $165 | $2,000 | ~40% | High |
| Solar | $65 | $130 | $250 | $25,000 | 15–20% | Medium |
| Windows & Doors | $75 | $150 | $250 | $9,500 | 20–35% | Med-High |
| Siding | $120 | $190 | $300 | $13,000 | 20–30% | Medium |
| Landscaping | $85 | $110 | $150 | $6,500 | 30–50% | Med-High |
| Concrete | $70 | $110 | $175 | $5,500 | 20–30% | Medium |
| Paving / Asphalt | $80 | $130 | $200 | $5,500 | 25–35% | Medium |
| Masonry | $80 | $150 | $300 | $6,000 | 25–40% | Medium |
| Fencing | $50 | $65 | $130 | $6,000 | 15–25% | Medium |
| Decks | $40 | $75 | $130 | $16,000 | 18–30% | Medium |
| Excavation | $60 | $120 | $200 | $8,000 | 15–40% | Low-Med |
| Tree Service | $35 | $60 | $90 | $2,000 | 35–70% | Med-High |
| Pools (inground builder) | $75 | $150 | $300 | $60,000 | 25–50% | Med-High |
| Kitchen & Bath Remodel | $120 | $180 | $350 | $27,000 | 25–40% | Med-High |
| General Contractor / Reno | $110 | $165 | $350 | $45,000 | 25–40% | Medium |
| Painting | $70 | $120 | $200 | $4,500 | 25–40% | High |
| Flooring | $60 | $100 | $150 | $4,000 | 20–35% | Medium |
| Drywall / Insulation | $70 | $150 | $250 | $2,500 | ~30% | Medium |
| Garage Doors | $80 | $145 | $200 | $1,300 | ~33% | Med-High |
| Pest Control | $40 | $85 | $120 | $550 (annual; CLV ~$1,500) | ~50% | Medium |
| Cleaning / Janitorial | $30 | $47 | $100 | $500 | 30–40% | Med-High |
| Handyman | $35 | $54 | $90 | $450 | 20–35% | Medium |

> Job value note: the calculator ships one "typical" ticket per trade but it's **editable** —
> tune it to the client on the call. Several trades are genuinely **bimodal** (repair vs. install):
> masonry ($500–$1,500 repair vs. $8k–$50k install), excavation ($2,500 grading vs. $20k–$60k
> site work), garage doors ($265 repair vs. $1,200+ install), landscaping ($1,400 maintenance vs.
> $6k–$25k design-build). Pest/cleaning/handyman are recurring — CLV is the stronger pitch.

---

## Confidence notes (where to be careful)

- **Highest confidence (direct, trade-specific, large-sample):** HVAC, Electrical, Roofing,
  Windows & Doors, Painting, Garage Doors, Landscaping, Cleaning, Handyman — these have a
  trade-specific measured search CPL.
- **Triangulated (no dedicated large-sample dataset — treat CPL as directional):** Solar, Siding,
  Masonry, Concrete, Paving, Fencing, Flooring, Drywall/Insulation, Excavation, Kitchen & Bath.
  Their CPLs are anchored to the broad "Construction & Contractors" ($165.67) / "Home Improvement"
  ($90.92) categories plus trade agencies.
- **Corrected in the deep pass:** Pools — the generic "$45 CPL" figure reflects pool *maintenance*;
  inground **builders** run $75–$300. Fixed.
- Self-managed / brand-new accounts commonly run **40–60% higher CPL for the first ~90 days**.
- 2024→2026 trend is **upward** (CPCs flat/down but conversion rates falling).

---

## Search-volume reality check (2026 validation)

A separate validation pass checked whether real local search demand can actually supply these lead
counts (not just whether the budget can be spent). Findings, folded into the shipped ranges:

- **The low ends were all defensible; several high ends were inflated** — implying cost-per-leads
  (~$70–120) below what the market supports. Shipped `cplLo` values were raised so no contractor trade
  implies a sub-~$90 CPL at $3,000/mo. (e.g. Roofing high end went 33 → 20 leads; Concrete 43 → 23;
  Painting 43 → 25; Fencing 60 → 33.)
- **Search volume rarely binds the high-demand trades** (HVAC, plumbing, electrical, roofing,
  landscaping in-season) — you run out of budget before searches, so these are correctly budget-capped.
- **Volume DOES bind low-frequency trades** — fencing above all (a mid-size metro can't supply ~60 fence
  leads/mo), plus concrete, kitchen/bath remodel, and GC in smaller metros. These were tightened.
- **Med spa:** Mississauga high-intent injectable search pool ≈ 1,500–3,000/mo (GTA-west 4,000–7,000).
  The $750 and $1,500 tiers are well-supported; the $3,000 tier is realistic only toward its lower end,
  so med-spa CPL was raised to $70–100 (was $58–83) → caps at ~30–43 enquiries. Canadian "near me" CPCs
  can also run higher ($10–22) than the $5.75–8.25 blended assumption.
- The tool's disclaimer now states the high end assumes an LSA/organic blend and that local search
  volume — not budget — can cap leads in smaller markets and lower-demand trades.
- Volume sources: Game of SERPS (`botox toronto` = 1,600/mo), Creekside/VortiHQ (med-spa CPC/CPL),
  LocaliQ + SearchLight (contractor CPL), keyword-cluster scaling for metro volume estimates.

## Primary sources

- LocaliQ — 2025 Home Services Search Advertising Benchmarks — https://localiq.com/blog/home-services-search-advertising-benchmarks/
- WordStream — 2025 / 2026 Google Ads Benchmarks — https://www.wordstream.com/blog/2025-google-ads-benchmarks · https://www.wordstream.com/blog/2026-google-ads-benchmarks
- SearchLight Digital — per-trade Google Ads CPL (roofing, HVAC, plumbing, electrical, garage doors) & LSA CPL — https://searchlightdigital.io/
- WebFX — Home Services Marketing Benchmarks — https://www.webfx.com/blog/home-services/home-services-marketing-benchmarks/
- Hook Agency — Google Ads Cost for Contractors — https://hookagency.com/blog/google-ads-cost-for-contractors/
- MDMPPC — Roofing / Windows-Doors-Garage benchmarks — https://mdmppc.com/google-ads-benchmarks/
- Richey Consulting (concrete), EverGrow (landscaping/pest), PavingMarketers, Media Spearhead (masonry), Home Service Direct (decks/tree/windows), Pool Marketing Pros & 99Calls (pools), Cube Creative (pest), Abstrakt (cleaning) — trade-specific cross-checks.
- Job values: Angi, HomeAdvisor, HomeGuide, Fixr, EnergySage, Zonda Cost-vs-Value, This Old House.

Full per-trade source lists (30–50 URLs per research batch) are preserved in the session research
transcripts. Regenerate/refresh annually — ad costs trend up ~10%/yr.

---

## Cosmetic / med-spa (separate vertical — CliniMedia)

Not in the contractor dropdown, but validated for the Aura pitch. GTA medical-aesthetics:
CPC $5.75–$8.25 · landing-page conversion 10% → **~$50–$100 per enquiry** · enquiry→booked
25–30% typical (40–45% only with fast follow-up) → **$160–$270 per booked client** · first visit
~$550 · **client LTV ~$1,500 year one, $4,000–5,000 over 18 months**. ROAS ~3× on first visit,
5–18× on lifetime value. Sources: Prospyr, Pennock, ScaleHaven, Dean Garland, WordStream/LocaliQ
healthcare & beauty benchmarks. Note Google's Botox trademark + prescription-drug ad policies.
