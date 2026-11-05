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
  { name: 'Foundation Engine', monthlyFee: '297', setupFee: '0', currency: 'USD', term: '12 months', usesAds: false, summary: 'Build your online presence and automate follow-up.', services: [
    'SEO-friendly 5-page website', 'Basic AI lead follow-up', 'Automated review management', 'Appointment booking system'
  ] },
  { name: 'AI Visibility', monthlyFee: '597', setupFee: '1000', currency: 'USD', term: '3 months', usesAds: false, summary: 'Improve visibility across Google, Maps, and AI search.', services: [
    'Google Business Profile optimization and management', 'Local SEO optimization', 'AI search visibility (ChatGPT, Google AI, and other AI-powered search experiences)', 'Website SEO improvements', 'Review and online reputation optimization'
  ] },
  { name: 'Lead Engine', monthlyFee: '797', setupFee: '1000', currency: 'USD', term: '3 months', usesAds: true, summary: 'Generate leads and automate prospect follow-up.', services: [
    'Google Ads setup and management', 'High-converting landing page', 'Advanced conversational AI lead follow-up', 'AI lead qualification and appointment booking', 'CRM and lead tracking', 'Google advertising spend is separate from the service fee'
  ] },
  { name: 'Growth Engine', monthlyFee: '997', setupFee: '2000', promoSetupFee: '1000', promoEndDate: '2026-11-30', currency: 'USD', term: '3 months', usesAds: true, summary: 'Combine paid leads, organic visibility, and automated follow-up.', services: [
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
  terminationFeeMode: 'one_month',
  terminationFeeAmount: '',
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

function setupInstallmentAmounts(value, currency, contractVersion = 1) {
  const raw = String(value ?? '').replace(/[^0-9.]/g, '');
  if (!/\d/.test(raw)) return [];
  const totalCents = Math.round(Number(raw) * 100);
  if (!Number.isFinite(totalCents) || totalCents <= 0) return [];
  const baseCents = Math.floor(totalCents / 3);
  const remainder = totalCents - baseCents * 3;
  // Version 3 matches Stripe's recurring installment plus a one-time first-
  // invoice adjustment. Older signing links retain their original schedule.
  const amounts = Number(contractVersion) >= 3
    ? [baseCents + remainder, baseCents, baseCents]
    : [baseCents, baseCents, baseCents + remainder];
  return amounts.map((amount) => money(amount / 100, currency));
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
  ['terminationFeeMode', 'tfm'], ['terminationFeeAmount', 'tfa'],
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

export function terminationFee(d) {
  if (d.term === 'Month-to-month') return 0;
  if (d.terminationFeeMode === 'none') return 0;
  const monthly = Number(String(d.monthlyFee ?? '').replace(/[^0-9.]/g, '')) || 0;
  if (d.terminationFeeMode === 'one_month') return monthly;
  if (d.terminationFeeMode === 'custom') return Number(String(d.terminationFeeAmount ?? '').replace(/[^0-9.]/g, '')) || 0;
  return null;
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
  const earlyTerminationFee = terminationFee(d);
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
    `${d.packageName ? `The selected package is **${d.packageName}**. ` : ''}Arveno will provide these Services:`,
    ...(services.length ? services.map((s) => `- ${s.label}`) : [`- ${BLANK}`]),
    'Services outside this scope require a separate written quote.'
  ]);

  const setupNumber = Number(String(d.setupFee ?? '').replace(/[^0-9.]/g, ''));
  const billingTrigger = setupNumber > 0 ? 'first successful setup payment' : 'successful card setup';
  const setupParts = setupInstallmentAmounts(d.setupFee, d.currency, d.contractVersion);
  const setupSchedule = !setupFee
    ? `- **Setup fee: ${BLANK}.** The setup-fee payment schedule will be confirmed before work begins. Setup starts ${setupStart}.`
    : setupNumber === 0
      ? `- **Setup fee: ${setupFee}.** No setup payment is due. Setup starts ${setupStart}.`
    : d.setupPayment === 'threeMonthly'
      ? `- **Setup fee: ${setupFee}.** Paid in three monthly installments of ${setupParts.join(', ')}. The first installment is due before work begins; the second is due one month after the first, and the third is due two months after the first. Setup starts ${setupStart}.`
      : `- **Setup fee: ${setupFee}.** Paid in full before work begins. Setup starts ${setupStart}.`;

  add('Fees, Setup, and Term', [
    setupSchedule,
    `- **Monthly fee: ${monthlyFee || BLANK} per month.** ${Number(d.contractVersion) >= 7 ? `Monthly billing starts automatically 14 calendar days after ${billingTrigger} using the payment method saved in the setup checkout.` : Number(d.contractVersion) >= 6 ? 'Monthly billing begins when the Client completes the separate monthly Stripe Checkout and renews monthly.' : 'Recurring billing begins when setup is complete, then renews monthly.'} Setup is complete when the agreed initial tasks are finished and Arveno confirms this in writing.`,
    Number(d.contractVersion) >= 4
      ? d.term === 'Month-to-month'
        ? `- **Term: month-to-month,** beginning ${Number(d.contractVersion) >= 7 ? 'when the first monthly payment is due' : Number(d.contractVersion) >= 6 ? 'when the monthly Stripe Checkout is completed' : 'on the setup completion date'}. Monthly billing continues until either party gives 30 days’ written notice.`
        : `- **Term: ${d.term},** beginning ${Number(d.contractVersion) >= 7 ? 'when the first monthly payment is due' : Number(d.contractVersion) >= 6 ? 'when the monthly Stripe Checkout is completed' : 'on the setup completion date'}. Monthly billing stops after the final monthly payment in this committed term. Renewal requires a new written agreement.`
      : `- **Term: ${d.term},** beginning when monthly billing starts.` +
        (d.term === 'Month-to-month' || d.term === 'To be agreed in writing' ? '' : ' It continues month to month afterwards unless either party gives notice.'),
    Number(d.contractVersion) >= 7
      ? `The Client authorizes one secure Stripe Checkout to collect the setup fee (or first agreed installment) and securely save the payment method for off-session charges. The Client also authorizes automatic monthly charges of ${monthlyFee || BLANK}, starting 14 calendar days after ${billingTrigger}, for the signed commitment term. Stripe will make those charges automatically using the saved payment method; no second monthly checkout is required. The subscription stops after the final committed monthly payment. Setup will be completed within 14 calendar days after ${billingTrigger}. If it is late, the setup-fee remedy above applies and remaining setup installments are cancelled; this review does not delay the separately authorized monthly billing schedule. Fees are in ${d.currency}; Stripe automatic tax is not applied. Advertising spend is paid directly to the platform.`
      : Number(d.contractVersion) >= 6
      ? `The Client authorizes two separate Stripe Checkouts when both fees apply: one for the setup fee on the schedule above, and one for the monthly subscription. The monthly subscription begins when the Client completes that Checkout. Fees are in ${d.currency} and exclude applicable taxes. Advertising spend is paid directly to the platform.`
      : `The Client authorizes Stripe to charge the payment method provided for the setup fee on the schedule above and the monthly fee starting at setup completion. Fees are in ${d.currency} and exclude applicable taxes. Advertising spend is paid directly to the platform.`,
    Number(d.contractVersion) >= 5 && d.term !== 'Month-to-month'
      ? earlyTerminationFee > 0
        ? `The Client may end this fixed-term Agreement early by written notice. On early termination, the Client owes an agreed early-termination charge of **${money(earlyTerminationFee, d.currency)}** as the parties’ estimate of Arveno’s unrecovered onboarding and reserved-capacity costs. No remaining monthly service fees are charged after the effective termination date. This charge does not apply when the Client ends under an express guarantee remedy in this Agreement or because Arveno materially breaches and fails to cure after written notice.`
        : 'The Client may end this fixed-term Agreement early by written notice without an early-termination charge. Accrued fees and unpaid setup installments remain due.'
      : null,
    ...(d.packageName === 'Lead Engine' || d.packageName === 'Growth Engine'
      ? [`The agreed minimum monthly Google advertising budget is **${money(d.minAdSpend, d.adSpendCurrency) || BLANK}**. The Client pays this amount directly to Google; it is not included in the service fees.`]
      : []),
    (Number(d.contractVersion) >= 2
      ? Number(d.contractVersion) >= 7
        ? `Setup will be completed within **14 calendar days** after ${billingTrigger}. If it is late, the setup fee is waived or refunded and unpaid setup installments are cancelled. The monthly billing schedule stated above is not delayed by this review. `
        : 'Setup will be completed within **14 calendar days** after the agreed Setup Start Date. If it is late, the setup fee is waived or refunded and unpaid installments are cancelled. '
      : '') +
    (Number(d.contractVersion) >= 4
      ? d.term === 'Month-to-month'
        ? "Either party may end this Agreement on **30 days' written notice**. The final month is payable in full "
        : 'This Agreement ends after the committed term unless renewed in a new written agreement. The final committed monthly fee is payable in full '
      : d.term === 'Month-to-month'
        ? "Either party may end this Agreement on **30 days' written notice**. The final month is payable in full "
        : "The initial term is a commitment. After it ends, either party may end this Agreement on **30 days' written notice**. The final month is payable in full ") +
    'and setup fees are not refundable, except where a clause below expressly says otherwise.'
  ]);

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
      `The Client pays the first three monthly service fees ${Number(d.contractVersion) >= 6 ? 'after monthly billing begins' : 'after setup is complete'}. At the end of the third paid subscription period, if verified gross profit from tracked projects is below the target, monthly service-fee billing pauses. Arveno continues the included Services without a monthly service fee until cumulative verified gross profit from those projects reaches the target. Regular monthly billing resumes only after the target is reached, unless this Agreement has ended. Monthly fees already paid are not refunded.`,
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

  add('Client Responsibilities', [
    'The Client will provide timely account access, accurate business details and licensed materials; review work promptly; respond to leads within one business day; and pay advertising platforms directly. Client-caused delays extend delivery dates and guarantee periods. The Client is responsible for supplied materials and will cover Arveno for third-party claims arising from them.'
  ]);

  add('Ownership and Confidentiality', [
    'The Client owns its accounts, domain, lead data, and custom work paid in full. Arveno retains its existing tools, templates, and processes. Each party will protect the other’s non-public business information. Arveno may identify the Client and report results as a case study unless the Client opts out in writing.'
  ]);

  add('Results and Liability', [
    (g.any ? 'Except for an express guarantee in this Agreement, Arveno does not promise' : 'Arveno does not promise') +
    ' specific lead volume, rankings, cost per lead, or revenue. Platforms control their policies, algorithms, and prices. Neither party is liable for indirect or consequential loss. **Arveno’s total liability is limited to the fees paid in the three months before the claim.**'
  ]);

  add('General', [
    'Ontario and applicable federal Canadian law govern. This Agreement replaces prior discussions about these Services. Changes must be written and signed by both parties. If one term is unenforceable, the rest remains in effect. Electronic signatures are binding.'
  ]);

  return clauses.map((clause) => ({
    ...clause,
    paras: clause.paras.filter((paragraph) => paragraph != null).map((paragraph) => paragraph.replaceAll(/\bTLM\b/g, brand.name))
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
  if (Number(d.contractVersion) >= 5 && d.term !== 'Month-to-month') {
    if (!['one_month', 'custom', 'none'].includes(d.terminationFeeMode)) gaps.push('Early-termination option');
    if (d.terminationFeeMode === 'custom' && money(d.terminationFeeAmount, d.currency) === null) gaps.push('Agreed early-termination fee');
  }
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
    : `- Setup: ${setupFee}, ${d.setupPayment === 'threeMonthly' ? `split into three monthly installments (${setupInstallmentAmounts(d.setupFee, d.currency, d.contractVersion).join(', ')}), with the first due before work begins` : 'due in full before work begins'}.`;
  const termination = d.term === 'Month-to-month' ? null
    : terminationFee(d) > 0 ? `- Early exit: ${money(terminationFee(d), d.currency)} one-time fee; no remaining monthly fees after the effective termination date.`
      : '- Early exit: no fee; accrued fees and unpaid setup installments remain due.';

  const body = [
    `Hi ${first},`,
    '',
    `Great speaking with you. Here is the agreement for ${business}, attached as a PDF and also linked below so you can sign it online.`,
    '',
    'The short version:',
    setupPaymentLine,
    `- Monthly: ${monthly}. ${Number(d.contractVersion) >= 7 ? 'The saved payment method is charged automatically starting 14 calendar days after the first successful setup payment (or after card setup when no setup fee is due).' : Number(d.contractVersion) >= 6 ? 'Billing starts when the client completes the separate monthly Stripe Checkout.' : 'Billing starts only after setup is complete and Arveno confirms it in writing.'}`,
    ...(termination ? [termination] : []),
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
