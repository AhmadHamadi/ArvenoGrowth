/**
 * The pitch deck's words, kept apart from the page that draws them.
 *
 * Every number and quote here comes from something that already exists:
 * the CPL table is the reconciled data in CALCULATOR-BENCHMARKS.md, the
 * testimonials are the three on the homepage, and the process and service
 * wording matches the site. Nothing on these slides is invented, so the
 * deck cannot drift away from what the site and the agreement say.
 */

export const AGENCY = {
  name: 'Trade Leads Marketing',
  site: 'tradeleadsmarketing.com',
  email: 'info@tradeleadsmarketing.com',
  phone: '(289) 489-1167',
  phoneHref: 'tel:+12894891167',
  apply: 'tradeleadsmarketing.com/apply'
};

export const LEAKS = [
  ['Wasted spend', 'Bidding on searches that never buy'],
  ['A site that leaks', 'Visitors who arrive and leave'],
  ['No attribution', 'No idea which ad booked the job'],
  ['Vanity reporting', 'Clicks and impressions, no revenue']
];

export const TRADES = [
  'Roofing', 'HVAC', 'Concrete', 'Plumbing', 'Electrical',
  'Landscaping', 'Paving', 'Excavation', 'Windows and doors', 'Renovation'
];

export const THREE = [
  ['01', 'Your website', 'Pages written for homeowners ready to spend, built to book estimates rather than to look nice.'],
  ['02', 'Google Business Profile', 'Categories, photos, posts, services, and reviews — the things competitors leave half done.'],
  ['03', 'Google Ads', 'Structured by service, negatives managed, quality score worked. Top of page for less.']
];

/* Google Ads search CPL, USD. Source: CALCULATOR-BENCHMARKS.md, which
   reconciles LocaliQ 2025 (3,211 campaigns) against trade-specific agency
   data. Only the trades with High or Med-High confidence are shown here,
   because these are the ones defensible on a call. */
export const CPL = {
  head: ['Trade', 'Typical CPL', 'Job value', 'Close rate'],
  rows: [
    ['Roofing', '$150', '$10,000', '~20%'],
    ['HVAC', '$130', '$8,000', '~40%'],
    ['Electrical', '$120', '$2,000', '~40%'],
    ['Concrete', '$110', '$5,500', '20–30%'],
    ['Landscaping', '$110', '$6,500', '30–50%'],
    ['Kitchen & bath', '$180', '$27,000', '25–40%']
  ]
};

/* Worked from the concrete row above: 2000 / 110 = 18.2 leads,
   18 x 25% = 4.5 jobs, 4.5 x 5500 = $24,750. */
export const MATH = [
  ['$2,000', 'ad spend in a month'],
  ['÷ $110', 'cost per lead (concrete)'],
  ['= 18', 'qualified leads'],
  ['× 25%', 'close rate'],
  ['= 4–5', 'jobs at $5,500']
];

export const PROCESS = [
  ['01', 'Audit', 'Website, ads, SEO, competitors, tracking. No fluff.'],
  ['02', 'Build', 'Pages, campaigns, and the local SEO foundation.'],
  ['03', 'Launch', 'Live, optimised for quote requests, not clicks.'],
  ['04', 'Track', 'Calls, forms, lead quality, booked estimates, sold jobs.'],
  ['05', 'Improve', 'On real data, week by week. Not gut feel.']
];

export const SERVICES = [
  ['Google Ads management', 'Campaign build, negatives, ad copy, bid strategy, ongoing optimisation.'],
  ['Website design or rebuild', 'Conversion-focused pages, mobile layout, page speed.'],
  ['Local SEO', 'Service-area pages, on-page work, citations, review strategy.'],
  ['Google Business Profile', 'Categories, photos, posts, services, Q&A, review management.'],
  ['Call and form tracking', 'Every lead attributed to campaign, ad, and keyword.'],
  ['Monthly reporting', 'Leads, cost per lead, booked estimates, performance.']
];

export const REPORTING = [
  ['Qualified leads', 'not sessions'],
  ['Cost per lead', 'not cost per click'],
  ['Booked estimates', 'not form fills'],
  ['Revenue by campaign', 'not impressions']
];

/* These four mirror the Marketing Services Agreement exactly. If a clause in
   contract-model.js changes, this slide has to change with it. */
export const OFFER = [
  ['Month to month', 'Available on every plan. Thirty days’ notice, no early-termination charge.'],
  ['Nothing starts until you go live', 'The monthly fee begins when setup is finished and campaigns are live, not the day you sign.'],
  ['You own everything', 'Ad accounts, Google Business Profile, domain, website, and lead data stay yours.'],
  ['A booking guarantee, where it fits', 'On agreed plans: an agreed number of qualified bookings in the first 30 days, or you do not pay the monthly fee.']
];

export const QUOTES = [
  ['They rebuilt our landing page, cleaned up our Google Business Profile, and our quote requests jumped within weeks. We can finally see exactly which jobs came from which campaign.', 'John Scime', 'Seven Stones Landscape'],
  ['These guys actually understand contractors. Our Google Ads were bleeding money before. Now we are booking high-ticket HVAC jobs at a fraction of the cost per lead.', 'Saif Sabeeh', 'Ikad Mechanical HVAC'],
  ['I was getting reports from my old agency that meant nothing. They showed me the booked jobs and the revenue, not just clicks. The phone is ringing for the right kind of work now.', 'Danny', 'General contractor']
];
