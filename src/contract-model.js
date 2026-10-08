/**
 * Single source of truth for the Marketing Services Agreement.
 *
 * Imported by three places that must never disagree:
 *   src/Contract.jsx   — the generator Ahmad or Salman fills in
 *   src/Sign.jsx       — the page the client opens to sign
 *   api/sign.js        — the email both parties receive afterwards
 *
 * Clause bodies are plain strings with **bold** markers rather than JSX, so the
 * same text can be rendered to the screen, to an HTML email, and to plain text
 * without three copies of the wording drifting apart.
 */

import brand from './brand-config.json' with { type: 'json' };

export const SIGNERS = [
  { name: 'Ahmad Hamadi', title: `Founder, ${brand.name}` },
  { name: 'Salman Musa',  title: `Founder, ${brand.name}` }
];

export const SERVICE_LIBRARY = [
  { id: 'ads',       label: 'Google Ads management',               desc: 'Campaign build, keyword and negative-keyword management, ad copy, bid strategy, and ongoing optimization.' },
  { id: 'website',   label: 'Website design or rebuild',           desc: 'Design and build of a conversion-focused website or landing pages, including mobile layout and page speed.' },
  { id: 'seo',       label: 'Local SEO',                           desc: 'Service-area pages, on-page optimization, citations, and review strategy for local search visibility.' },
  { id: 'gbp',       label: 'Google Business Profile optimization', desc: 'Category targeting, photos, posts, service listings, questions and answers, and review management for the local map pack.' },
  { id: 'tracking',  label: 'Call and form tracking',              desc: 'Call tracking, form tracking, and conversion tracking installed and attributed to campaign, ad, and keyword.' },
  { id: 'cro',       label: 'Conversion rate optimization',         desc: 'Testing of offers, headlines, and forms to increase the share of visitors who request a quote.' },
  { id: 'aiseo',     label: 'AI search optimization',              desc: 'Structured data and content work targeting AI Overviews, ChatGPT, and similar answer engines.' },
  { id: 'reporting', label: 'Monthly reporting',                   desc: 'A monthly report covering leads, cost per lead, booked estimates, and campaign performance.' }
];

// Package presets mirror the public Packages page. They fill the agreement's
// scope and fees; the currency and ad budget remain explicit agreement fields.
export const PACKAGE_PRESETS = [
  { name: 'Foundation Engine', monthlyFee: '297', setupFee: '0', currency: 'USD', term: '12 months', usesAds: false, services: [
    'SEO-friendly 5-page website', 'Basic AI lead follow-up', 'Automated review management', 'Appointment booking system'
  ] },
  { name: 'AI Visibility', monthlyFee: '597', setupFee: '1000', currency: 'USD', term: 'To be agreed in writing', usesAds: false, services: [
    'Google Business Profile optimization and management', 'Local SEO optimization', 'AI search visibility (ChatGPT, Google AI, and other AI-powered search experiences)', 'Website SEO improvements', 'Review and online reputation optimization'
  ] },
  { name: 'Lead Engine', monthlyFee: '797', setupFee: '1000', currency: 'USD', term: 'To be agreed in writing', usesAds: true, services: [
    'Google Ads setup and management', 'High-converting landing page', 'Advanced conversational AI lead follow-up', 'AI lead qualification and appointment booking', 'CRM and lead tracking', 'Google advertising spend is separate from the service fee'
  ] },
  { name: 'Growth Engine', monthlyFee: '997', setupFee: '2000', promoSetupFee: '1000', promoEndDate: '2026-10-31', currency: 'USD', term: 'To be agreed in writing', usesAds: true, services: [
    'Google Ads setup and management', 'High-converting landing page', 'Advanced conversational AI lead follow-up', 'AI lead qualification and appointment booking', 'CRM and lead tracking', 'Google Business Profile optimization and management', 'Local SEO optimization', 'AI search visibility (ChatGPT, Google AI, and other AI-powered search experiences)', 'Website SEO improvements', 'Review and online reputation optimization', 'Google Ads and organic lead generation', 'Complete lead tracking and reporting', 'Google advertising spend is separate from the service fee'
  ] }
];

export function packageSetupFee(preset, now = new Date()) {
  if (!preset?.promoSetupFee || !preset?.promoEndDate) return preset?.setupFee ?? '';
  const promoEnd = new Date(`${preset.promoEndDate}T23:59:59.999`);
  return now <= promoEnd ? preset.promoSetupFee : preset.setupFee;
}

export const TERMS = ['To be agreed in writing', 'Month-to-month', '3 months', '6 months', '12 months'];

export const AGENCY = {
  name: brand.name,
  legalName: brand.legalName,
  mark: brand.mark,
  email: 'info@arvenogrowth.com',
  phone: '(289) 489-1167',
  site: new URL(brand.siteOrigin).host,
  origin: brand.siteOrigin
};

/**
 * CAREFUL: a signing link carries only what differs from DEFAULTS, so anything
 * left at its default is rebuilt from this file when the client opens the link.
 * Rewording a default therefore also rewords every agreement that has been sent
 * but not yet signed. Before editing this wording or DEFAULTS below, either
 * confirm nothing is outstanding in /contracts, or reissue the open links.
 */
export const DEFAULT_QUALIFIED =
  "a contact from a property owner in the Client's service area who requests a quote or estimate for a service " +
  'the Client offers and provides valid contact details. Spam, wrong numbers, solicitations, job applicants, ' +
  'and contacts outside the agreed service area do not count.';

export const DEFAULTS = {
  contractVersion: 1, // version 1 links retain their original clauses; the generator issues version 2
  packageName: '',
  clientBusiness: '',
  clientContact: '',
  clientTitle: 'Owner',
  clientAddress: '',
  clientEmail: '',
  clientPhone: '',

  agreementDate: '',
  setupStart: '',
  term: 'Month-to-month',
  currency: 'CAD',
  setupFee: '',
  setupPayment: 'beforeStart',
  monthlyFee: '',

  services: ['ads', 'gbp', 'tracking', 'reporting'],
  customServices: [],

  guarantee: 'none',          // new: none | breakEven | performance | breakEvenAndPerformance; legacy values remain readable
  bookingCount: 3,
  bookingRemedy: 'waive',     // waive | untilMet
  bookingCapDays: 0,          // 0 = uncapped; otherwise the free period ends here
  qualifiedDefinition: DEFAULT_QUALIFIED,
  breakEvenDefinition: 'Gross profit from agreed, trackable new customers covers the Client advertising spend and Arveno monthly service fees during the first 90 days.',
  threeMonthPaybackDefinition: 'The first three full monthly subscription periods begin on the Setup Completion Date. The target is the total monthly service fees the Client actually paid for those three periods. Verified gross profit from new projects attributable to leads recorded in the agreed CRM is measured against that target. Setup fees, advertising spend, taxes, and third-party costs are excluded.',
  minAdSpend: 500,
  adSpendCurrency: 'USD',

  signerIndex: 0,
  signatureData: ''           // never encoded into a link, see packContract
};

/* ============================================================
   FORMATTING
   ============================================================ */

/** Formats a fee. Returns null only when the value is absent or unparseable —
 *  a deliberate $0 (a waived setup fee) still renders. */
export function money(value, currency) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, '');
  // Stripping non-numerics turns "abc" into "", and Number("") is 0 — which
  // would silently print a $0.00 fee into a contract. Require a real digit.
  if (!/\d/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  const digits = { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 };
  try {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency, ...digits }).format(n);
  } catch {
    // The currency arrives from a signing link, so a truncated or edited one can
    // carry a code Intl refuses. A fee is far too important to throw away over
    // its label: print the number and whatever code came with it.
    const amount = new Intl.NumberFormat('en-CA', digits).format(n);
    const code = String(currency ?? '').trim().toUpperCase();
    return code ? `${amount} ${code}` : amount;
  }
}

function setupInstallmentAmounts(value, currency) {
  const raw = String(value ?? '').replace(/[^0-9.]/g, '');
  if (!/\d/.test(raw)) return [];
  const totalCents = Math.round(Number(raw) * 100);
  if (!Number.isFinite(totalCents) || totalCents <= 0) return [];
  const firstCents = Math.floor(totalCents / 3);
  const lastCents = totalCents - firstCents * 2;
  return [firstCents, firstCents, lastCents].map((amount) => money(amount / 100, currency));
}

/** Parses a yyyy-mm-dd input as a local date, so the day never shifts a timezone. */
export function longDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'agreement';
}

/* ============================================================
   LINK CODEC
   The agreement travels inside the signing link, so there is no database
   to keep in sync. Keys are one or two characters to keep the URL short,
   and the drawn signature image is deliberately left out — it is far too
   large for a URL, and the countersignature is attested by name and date
   on the signing page instead.
   ============================================================ */

const PACK_KEYS = [
  ['contractVersion', 'cv'],
  ['packageName', 'pn'],
  ['clientBusiness', 'b'], ['clientContact', 'c'], ['clientTitle', 't'],
  ['clientAddress', 'a'], ['clientEmail', 'e'], ['clientPhone', 'p'],
  ['agreementDate', 'ad'], ['setupStart', 'ss'], ['term', 'tm'], ['currency', 'cu'],
  ['setupFee', 'sf'], ['setupPayment', 'sp'], ['monthlyFee', 'mf'],
  ['services', 'sv'], ['customServices', 'cs'],
  ['guarantee', 'g'], ['bookingCount', 'bc'], ['bookingRemedy', 'br'], ['bookingCapDays', 'cd'],
  ['qualifiedDefinition', 'qd'], ['breakEvenDefinition', 'bd'], ['minAdSpend', 'ms'], ['adSpendCurrency', 'mc'],
  ['signerIndex', 'si']
];

function utf8ToBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  // Chunked so a long agreement cannot blow the argument limit on spread.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(s) {
  const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function packContract(d) {
  const out = {};
  for (const [full, short] of PACK_KEYS) {
    let v = d[full];
    if (full === 'customServices' && Array.isArray(v)) v = v.filter((x) => String(x).trim());
    // Drop anything that still equals the default, which unpack rebuilds
    // identically. That keeps the signing link short enough to survive an email
    // client. An empty list is NOT a default and must travel: dropping it would
    // let unpack hand the client back the four default services, and an
    // agreement must never gain a service nobody agreed to.
    if (v === undefined || same(v, DEFAULTS[full])) continue;
    if (full === 'bookingCapDays' && !Number(v)) continue;
    out[short] = v;
  }
  return out;
}

export function unpackContract(packed) {
  const d = { ...DEFAULTS };
  for (const [full, short] of PACK_KEYS) {
    if (packed[short] !== undefined) d[full] = packed[short];
  }
  d.customServices = Array.isArray(d.customServices) ? d.customServices : [];
  d.services = Array.isArray(d.services) ? d.services : [];
  d.signerIndex = Number(d.signerIndex) || 0;
  d.bookingCount = Number(d.bookingCount) || 3;
  return d;
}

export function encodeContract(d) {
  return utf8ToBase64Url(JSON.stringify(packContract(d)));
}

export function decodeContract(token) {
  const parsed = JSON.parse(base64UrlToUtf8(token));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Malformed agreement token');
  }
  return unpackContract(parsed);
}

export function signingUrl(d, origin = AGENCY.origin) {
  return `${origin}/sign/${slugify(d.clientBusiness)}?a=${encodeContract(d)}`;
}

/* ============================================================
   THE AGREEMENT ITSELF
   ============================================================ */

/** Services actually selected, library entries plus any custom lines. */
export function selectedServices(d) {
  return [
    ...SERVICE_LIBRARY.filter((s) => d.services.includes(s.id)),
    ...(d.customServices || []).filter((x) => String(x).trim()).map((label) => ({ id: label, label, desc: '' }))
  ];
}

export function guaranteeFlags(d) {
  const bookings = d.guarantee === 'bookings' || d.guarantee === 'both';
  const breakEven = d.guarantee === 'breakEven' || d.guarantee === 'breakEvenAndPerformance';
  const performance = d.guarantee === 'performance' || d.guarantee === 'both' || d.guarantee === 'breakEvenAndPerformance';
  return {
    bookings, breakEven, performance,
    any: bookings || breakEven || performance,
    both: (bookings && performance) || (breakEven && performance)
  };
}

const BLANK = '________________';

/**
 * Builds the numbered clauses. Paragraph strings may contain **bold** runs and
 * `- ` list lines; every renderer understands those two conventions and nothing
 * else, which keeps screen, email, and plain text identical.
 *
 * Deliberately short: this has to fit on two pages. Every sentence here either
 * states a term or protects one of the parties. No throat-clearing, no stating
 * the same obligation twice, no marketing copy. Anything cut from an earlier
 * draft was cut because it did neither — the protective clauses all stayed.
 */
export function buildClauses(d) {
  const g = guaranteeFlags(d);
  const services = selectedServices(d);

  const setupFee   = money(d.setupFee, d.currency);
  const monthlyFee = money(d.monthlyFee, d.currency);
  const adSpend    = money(d.minAdSpend, d.adSpendCurrency);
  const agreedOn   = longDate(d.agreementDate) || BLANK;
  const setupStart = longDate(d.setupStart) || BLANK;

  const clauses = [];
  const add = (title, paras) => clauses.push({ n: clauses.length + 1, title, paras });

  add('Parties and Services', [
    `This Marketing Services Agreement is made on ${agreedOn} between **${AGENCY.legalName}**, operating as **${AGENCY.name}** ("Arveno"), of ` +
    `${AGENCY.email}, ${AGENCY.phone}, and **${d.clientBusiness || BLANK}** ("the Client")` +
    `${d.clientAddress ? ` of ${d.clientAddress}` : ''}, represented by ` +
    `${d.clientContact || BLANK}${d.clientTitle ? `, ${d.clientTitle}` : ''}.`,
    // Run inline rather than one bullet per line. Ten services set as bullets
    // took a quarter of a page to list ten short labels, and the page budget is
    // two. A semicolon list is just as binding and reads in three lines.
    `${d.packageName ? `The selected package is **${d.packageName}**. ` : ''}TLM will provide the following services (the **"Services"**): ` +
    `${services.length ? services.map((s) => s.label).join('; ') : BLANK}.`,
    'Anything not on this list is quoted separately in writing before it begins.'
  ]);

  const setupNumber = Number(String(d.setupFee ?? '').replace(/[^0-9.]/g, ''));
  const setupParts = setupInstallmentAmounts(d.setupFee, d.currency);
  const setupSchedule = !setupFee
    ? `- **Setup fee: ${BLANK}.** The setup-fee payment schedule will be confirmed before work begins. Setup starts ${setupStart}.`
    : setupNumber === 0
      ? `- **Setup fee: ${setupFee}.** No setup payment is due. Setup starts ${setupStart}.`
    : d.setupPayment === 'threeMonthly'
      ? `- **Setup fee: ${setupFee}.** Paid in three monthly installments of ${setupParts.join(', ')}. The first installment is due before work begins; the second is due one month after the first, and the third is due two months after the first. Setup starts ${setupStart}.`
      : `- **Setup fee: ${setupFee}.** Paid in full before work begins. Setup starts ${setupStart}.`;

  add('Fees, Setup, and Term', [
    setupSchedule,
    `- **Monthly fee: ${monthlyFee || BLANK} per month.** First payment on the setup completion date, then ` +
    'monthly on that day.',
    `- **Term: ${d.term},** beginning on the setup completion date.` +
    (d.term === 'Month-to-month' || d.term === 'To be agreed in writing' ? '' : ' It continues month to month afterwards unless either party gives notice.'),
    '**The monthly subscription begins only on the Setup Completion Date.** Setup is complete when the agreed initial setup tasks are finished and Arveno confirms completion to the Client in writing. The subscription does not start on the agreement date or setup start date.',
    `All amounts are in ${d.currency} and exclude applicable taxes. Invoices are payable on receipt. ` +
    'Advertising spend is paid by the Client directly to Google, Meta, or any other platform and is not ' +
    'included in the fees above.',
    ...(d.packageName === 'Lead Engine' || d.packageName === 'Growth Engine'
      ? [`The agreed minimum monthly Google advertising budget is **${money(d.minAdSpend, d.adSpendCurrency) || BLANK}**. The Client pays this amount directly to Google; it is not included in the service fees.`]
      : []),
    (d.term === 'Month-to-month'
      ? "Either party may end this Agreement on **30 days' written notice**. The final month is payable in full "
      : "The initial term is a commitment. After it ends, either party may end this Agreement on **30 days' written notice**. The final month is payable in full ") +
    'and setup fees are not refundable, except where a clause below expressly says otherwise.'
  ]);

  if (Number(d.contractVersion) >= 2) {
    add('Setup Deadline and CRM Measurement', [
      `Arveno will complete the setup work listed in this Agreement within **14 calendar days** after the agreed Setup Start Date. If setup is not complete by then, the Client owes no setup fee. Any setup-fee amount already paid will be refunded, and any unpaid setup installments are cancelled.`,
      'The Client and Arveno will use the agreed CRM or project pipeline to record lead source, enquiry status, quoted project value, won or lost status, collected revenue, and direct project costs where available. Each party will use accurate records and will not knowingly invent, inflate, or misattribute results. The Client will provide reasonable source records needed to verify project values and costs.',
      'Where the Client authorizes it and the required account setup, consent, and platform requirements are in place, verified eligible outcomes may be sent to Google Ads as offline conversion signals. These signals may inform campaign optimization; Google controls its systems and no improvement in lead volume or quality is guaranteed.'
    ]);
  }

  if (g.bookings) {
    const n = d.bookingCount;
    add('30-Day Booking Guarantee', [
      `TLM guarantees the Client at least **${n} qualified booking${n === 1 ? '' : 's'}** in the first 30 days ` +
      'after the Services go live.',
      d.bookingRemedy === 'untilMet'
        ? 'If that is not met, **no monthly fee is owed and none becomes payable until it is met.** TLM keeps ' +
          'working at no monthly cost until then.' +
          (Number(d.bookingCapDays) > 0
            ? ` If it is still not met ${Number(d.bookingCapDays)} days after go-live, either party may end ` +
              'this Agreement on written notice with nothing further owed for that period.'
            : '')
        : 'If that is not met, **the Client does not pay the monthly fee for that period**, and any monthly fee ' +
          "already paid for it is refunded or credited at the Client's choice.",
      `A **qualified booking** means ${d.qualifiedDefinition}`,
      'This guarantee applies only while the Client maintains an advertising budget of at least ' +
      `**${adSpend || BLANK} per month** paid directly to the platform, gives TLM the access and approvals ` +
      'needed to run and track the Services, and responds to leads within one business day. The setup fee is ' +
      'not covered by this guarantee.'
    ]);
  }

  if (g.breakEven && Number(d.contractVersion) >= 2) {
    add('Three-Month Service-Fee Payback Guarantee', [
      `**Measurement target:** ${d.threeMonthPaybackDefinition || DEFAULTS.threeMonthPaybackDefinition}`,
      'The Client pays the first three monthly service fees after setup is complete. At the end of the third paid subscription period, if verified gross profit from tracked projects is below the target, monthly service-fee billing pauses. Arveno continues the included Services without a monthly service fee until cumulative verified gross profit from those projects reaches the target. Regular monthly billing resumes only after the target is reached, unless this Agreement has ended. Monthly fees already paid are not refunded.',
      `This guarantee applies while the Client maintains at least **${adSpend || BLANK} per month** in platform ad spend where Google Ads are included, keeps the agreed CRM and tracking active, supplies accurate project revenue and direct-cost records, provides required access and approvals, and responds to new enquiries within one business day. Setup fees, ad spend, taxes, software, and third-party costs are excluded from the target and remain payable unless the setup-deadline clause above requires a setup-fee refund.`
    ]);
  } else if (g.breakEven) {
    add('90-Day Break-Even Guarantee', [
      `The Client's break-even target is: **${d.breakEvenDefinition || DEFAULTS.breakEvenDefinition}**`,
      'The first 90 days begin when the Services go live. If the target has not been reached by day 90, **Arveno waives its monthly service fee and continues the included Services at no monthly cost until the target is reached.**',
      `This applies while the Client maintains at least **${adSpend || BLANK} per month** in platform ad spend, keeps agreed tracking active, gives Arveno the access and approvals needed to work, and responds to incoming leads within one business day. Platform ad spend and the setup fee remain payable by the Client.`
    ]);
  }

  if (g.performance) {
    add('No Lock-In', [
      'If, after the Services go live, TLM is not delivering against the performance expectations agreed at ' +
      'kickoff, the Client may end this Agreement immediately by written notice. **No monthly fees are ' +
      'payable beyond the month in which notice is given**, with no early-termination charge, penalty, or ' +
      'remaining-term liability.',
      'This applies only while the Client maintains the advertising budget' +
      (g.bookings || g.breakEven ? ' above' : ` of at least **${adSpend || BLANK} per month**`) +
      ' and provides the access and approvals TLM needs to do the work.'
    ]);
  }

  add('What the Client Provides', [
    '- access to the website, domain, ad accounts, Google Business Profile, and analytics;',
    '- review and approval of drafts, ad copy, and page content within a reasonable time;',
    '- a response to incoming leads within one business day, since TLM can generate a lead but only the ' +
    'Client can close it;',
    '- photos, service details, and any licence or insurance information needed for ads; and',
    '- payment to advertising platforms directly, keeping those accounts in good standing.',
    'Where a delay in the above prevents TLM from delivering the Services, timelines and any guarantee period ' +
    'shift by the length of that delay.',
    // TLM advertises what the Client tells it to. If a claim, licence, or photo
    // the Client supplied turns out to be wrong or not theirs to use, that has
    // to land on the Client rather than on TLM.
    'The Client is responsible for the accuracy and legality of the information, claims, licences, and images ' +
    'it supplies, and will cover TLM against any third-party claim arising out of them.'
  ]);

  add('Ownership and Confidentiality', [
    'The Client owns its ad accounts, Google Business Profile, domain, website content, lead data, and any ' +
    'creative produced specifically for it and paid for in full. TLM keeps its own templates, processes, ' +
    'tools, and anything built before this Agreement.',
    "Each party will keep the other's non-public business information confidential. TLM may reference the " +
    "Client's name and results as a case study unless the Client asks in writing that it not."
  ]);

  add('Results and Liability', [
    (g.any ? 'Apart from the guarantee terms above, TLM does not guarantee' : 'TLM does not guarantee') +
    ' any specific lead volume, ranking position, cost per lead, or revenue. Results depend on market ' +
    "competition, advertising budget, service area, seasonality, pricing, and the Client's own sales " +
    'process. TLM is not affiliated with or endorsed by Google and does not control changes those platforms ' +
    'make to their policies, algorithms, or pricing.',
    'Neither party is liable to the other for indirect or consequential loss. **TLM’s total liability ' +
    'under this Agreement is limited to the fees the Client paid TLM in the three months before the claim ' +
    'arose.**'
  ]);

  add('General', [
    'This Agreement is governed by the laws of the Province of Ontario and the federal laws of Canada that ' +
    'apply in it. It is the entire agreement between the parties on this subject and replaces any earlier ' +
    'discussion or proposal. Changes must be in writing and signed by both parties. If any clause is found ' +
    'unenforceable, the rest stays in force. An electronic signature has the same effect as a signature in ink.'
  ]);

  return clauses.map((clause) => ({
    ...clause,
    paras: clause.paras.map((paragraph) => paragraph.replaceAll(/\bTLM\b/g, brand.name))
  }));
}

/** What is still missing before this agreement can go out. */
export function contractGaps(d) {
  const gaps = [];
  if (!String(d.clientBusiness).trim()) gaps.push('Client business name');
  if (!String(d.clientContact).trim())  gaps.push('Client contact name (who signs)');
  if (!String(d.clientEmail).trim())    gaps.push('Client email (needed to send it)');
  if (money(d.setupFee, d.currency) === null)   gaps.push('Setup fee');
  if (money(d.monthlyFee, d.currency) === null) gaps.push('Monthly fee');
  if (selectedServices(d).length === 0)         gaps.push('At least one service');
  if (d.term === 'To be agreed in writing') gaps.push('Agreed term length');
  if ((d.packageName === 'Lead Engine' || d.packageName === 'Growth Engine' || d.guarantee !== 'none') && !money(d.minAdSpend, d.adSpendCurrency)) gaps.push('Agreed minimum monthly ad budget');
  if (!d.agreementDate) gaps.push('Agreement date');
  if (!d.setupStart)    gaps.push('Setup start date');
  return gaps;
}

/* ============================================================
   THE COVERING EMAIL
   Written out in full so it can be copied straight into a mail client.
   ============================================================ */
export function coveringEmail(d, url) {
  const signer = SIGNERS[d.signerIndex] || SIGNERS[0];
  const setupFee = money(d.setupFee, d.currency) || '[setup fee]';
  const monthly  = money(d.monthlyFee, d.currency) || '[monthly fee]';
  const services = selectedServices(d).map((s) => s.label);
  const g = guaranteeFlags(d);
  const business = d.clientBusiness || '[Client]';
  const first = String(d.clientContact || '').trim().split(/\s+/)[0] || 'there';

  const subject = `Your ${AGENCY.name} agreement — ${business}`;

  const guaranteeLines = [];
  if (g.bookings) {
    guaranteeLines.push(
      `- ${d.bookingCount} qualified booking${d.bookingCount === 1 ? '' : 's'} in your first 30 days, or ` +
      (d.bookingRemedy === 'untilMet' ? 'you do not pay until we hit it.' : 'you do not pay for that month.')
    );
  }
  if (g.breakEven && Number(d.contractVersion) >= 2) {
    guaranteeLines.push('- Three-month service-fee payback guarantee: you pay the first three monthly service fees after setup. If verified gross profit from CRM-tracked projects does not cover those fees by the end of month three, monthly service billing pauses and Arveno continues the included work without a monthly service fee until it does. Regular billing resumes only after the target is reached, unless the agreement has ended. Setup fees, advertising spend, taxes, and third-party costs are excluded.');
  } else if (g.breakEven) {
    guaranteeLines.push('- 90-day break-even guarantee: if the written target is not met, Arveno keeps delivering the included work without a monthly service fee until it is.');
  }
  if (g.performance) {
    guaranteeLines.push('- If we are not delivering after launch, you can walk with no further fees. No lock-in.');
  }
  if (g.any) {
    guaranteeLines.push(
      `- Any selected guarantee assumes a minimum ad spend of ${money(d.minAdSpend, d.adSpendCurrency) || '[minimum]'} per month, paid directly to the platform.`
    );
  }

  const setupNumber = Number(String(d.setupFee ?? '').replace(/[^0-9.]/g, ''));
  const setupPaymentLine = setupNumber === 0
    ? `- Setup: ${setupFee}; no setup payment is due.`
    : `- Setup: ${setupFee}, ${d.setupPayment === 'threeMonthly' ? `split into three monthly installments (${setupInstallmentAmounts(d.setupFee, d.currency).join(', ')}), with the first due before work begins` : 'due in full before work begins'}.`;

  const body = [
    `Hi ${first},`,
    '',
    `Great speaking with you. Here is the agreement for ${business}, attached as a PDF and also linked below so you can sign it online.`,
    '',
    'The short version:',
    setupPaymentLine,
    `- Monthly: ${monthly}. Billing starts only after setup is complete and Arveno confirms it in writing.`,
    ...(Number(d.contractVersion) >= 2 ? ['- Setup target: complete within 14 calendar days of the agreed Setup Start Date, or the setup fee is waived/refunded and unpaid installments are cancelled.'] : []),
    `- Term: ${d.term}.`,
    services.length ? `- Included: ${services.join(', ')}.` : null,
    ...guaranteeLines,
    '',
    'To sign, open this link and scroll to the bottom:',
    url,
    '',
    'It takes about a minute. Sign with your finger or your mouse, and you will get a copy of the signed agreement by email straight away.',
    '',
    'Any questions before you sign, just reply to this email or call me.',
    '',
    signer.name,
    signer.title,
    `${AGENCY.phone} — ${AGENCY.email}`
  ].filter((line) => line !== null).join('\n');   // '' is a wanted blank line; null is an omitted one

  return { subject, body };
}
