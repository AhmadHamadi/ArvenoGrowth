// Published references and editable what-if assumptions are deliberately separate.
const home2025 = 'https://localiq.com/blog/home-services-search-advertising-benchmarks/';
const search2026 = 'https://localiq.com/blog/search-advertising-benchmarks/';
const homeBasis = 'LocaliQ 2025 home-services search report (April 2024–March 2025 campaigns).';
const proxyBasis = 'LocaliQ 2026 Home & Home Improvement category; a broad proxy, not a trade-specific benchmark.';

export const DEFAULT_BUDGET = 900;
export const BUDGET_PRESETS = [700, 900, 1100];
export const CPL_SENSITIVITY_PERCENT = 20;

// planningCpl and jobValue are illustrative inputs, not market averages or forecasts.
export const TRADES = [
  { key: 'roofing', label: 'Roofing', cpl: 228.15, planningCpl: 85, jobValue: 10000, basis: `${homeBasis} Roofing & Gutters category.`, source: home2025 },
  { key: 'hvac', label: 'HVAC & mechanical', cpl: 128.38, planningCpl: 90, jobValue: 3500, basis: `${homeBasis} Midpoint of AC ($127.74) and heating ($129.02); not a combined HVAC sample.`, source: home2025 },
  { key: 'landscape', label: 'Landscaping', cpl: 117.92, planningCpl: 65, jobValue: 2000, basis: `${homeBasis} Landscaping category.`, source: home2025 },
  { key: 'general', label: 'General contracting', cpl: 165.67, planningCpl: 95, jobValue: 8000, basis: `${homeBasis} Construction & Contractors (General) category.`, source: home2025 },
  { key: 'auto', label: 'Auto repair & service', cpl: 29.96, planningCpl: 32, jobValue: 500, basis: 'LocaliQ 2026 Automotive — Repair, Service & Parts category; includes parts businesses.', source: search2026 },
  { key: 'plumbing', label: 'Plumbing', cpl: 129.02, planningCpl: 90, jobValue: 650, basis: `${homeBasis} Plumbing category.`, source: home2025 },
  { key: 'electrical', label: 'Electrical contractors', cpl: 93.69, planningCpl: 65, jobValue: 800, basis: `${homeBasis} Electricians & Electrical Contractors category.`, source: home2025 },
  { key: 'deck', label: 'Deck building', cpl: 90.92, planningCpl: 65, jobValue: 7500, basis: proxyBasis, source: search2026 },
  { key: 'garage', label: 'Garage doors', cpl: 81.45, planningCpl: 60, jobValue: 700, basis: `${homeBasis} Garages category; not limited to garage-door repair.`, source: home2025 },
  { key: 'tree', label: 'Tree removal', cpl: 90.92, planningCpl: 65, jobValue: 1500, basis: proxyBasis, source: search2026 },
  { key: 'junk', label: 'Junk removal', cpl: 90.92, planningCpl: 45, jobValue: 400, basis: proxyBasis, source: search2026 },
  { key: 'medspa', label: 'Med spa & aesthetics', cpl: 39.25, planningCpl: 38, jobValue: 500, basis: 'LocaliQ 2026 Beauty & Personal Care category; a broad proxy, not med-spa-specific.', source: search2026 },
  { key: 'other', label: 'Other local service', cpl: 90.92, planningCpl: 65, jobValue: 1000, basis: proxyBasis, source: search2026 }
];
