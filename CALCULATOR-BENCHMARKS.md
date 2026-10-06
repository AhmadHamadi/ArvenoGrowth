# Revenue calculator assumptions

Updated October 6, 2026. Configuration lives in `src/calculator-data.js`.

The default budget is $900 USD, with shortcuts for $700, $900, $1100. The budget control remains $500–$5,000. Industry selection sets a fixed planning CPL; there is no CPL slider, input, or scenario selector.

These CPL inputs are moderate preset planning assumptions selected for the calculator at the site owner's request. They are not researched market averages, campaign forecasts, or measured Arveno results. The estimate disclosure and expandable methodology explain this distinction. A smaller budget does not itself make leads cheaper. Published figures remain separate comparison data and are never relabeled as the lower inputs.

| Industry | Fixed planning CPL | Published comparison | Example first-sale value |
|---|---:|---:|---:|
| Roofing | $85 | $228.15 | $10,000 |
| HVAC & mechanical | $90 | $128.38 | $3,500 |
| Landscaping | $65 | $117.92 | $2,000 |
| General contracting | $95 | $165.67 | $8,000 |
| Auto repair & service | $32 | $29.96 | $500 |
| Plumbing | $90 | $129.02 | $650 |
| Electrical contractors | $65 | $93.69 | $800 |
| Deck building | $65 | $90.92 | $7,500 |
| Garage doors | $60 | $81.45 | $700 |
| Tree removal | $65 | $90.92 | $1,500 |
| Junk removal | $45 | $90.92 | $400 |
| Med spa & aesthetics | $38 | $39.25 | $500 |
| Other local service | $65 | $90.92 | $1,000 |

## Method

Leads = budget / planning CPL. Customers = leads × close rate. Revenue = customers × job value. Gross profit after marketing = revenue × gross margin − budget − agency fee. The lead band varies CPL by ±20%; it is not a confidence interval or published market range. Outcomes can fall outside it.

Close rate (25%), margin (40%), and industry-specific job values are illustrative and editable. Agency fee defaults to $0 and must be entered for a fuller cost estimate. Overhead, taxes, refunds, cancellations, repeat sales, and lead-quality variation are not modeled. Changing industry resets its example job value; Reset restores roofing, $900 budget, and the original assumptions.

## References checked

- [LocaliQ home services, 2025 campaign report](https://localiq.com/blog/home-services-search-advertising-benchmarks/): roofing/gutters, landscaping, general contracting, electrical, plumbing, and garages; HVAC is the midpoint of AC and heating figures. The article was updated in 2026, but its campaign sample remains April 2024–March 2025.
- [LocaliQ search benchmarks, 2026](https://localiq.com/blog/search-advertising-benchmarks/): automotive repair/service/parts and broad beauty and home improvement categories. Med spa, deck, tree, junk, and other local service use broad proxies, not niche-specific evidence.
- [Google Keyword Planner forecasts](https://support.google.com/google-ads/answer/3022575): local forecasts account for bids, budget, seasonality, and historical ad quality.

These observations cover different categories and samples. They do not establish what an individual campaign will cost. Each selected industry's exact comparison category and source are displayed in the methodology disclosure.
