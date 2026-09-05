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

export const SIGNERS = [
  { name: 'Ahmad Hamadi', title: 'Founder, Trade Leads Marketing' },
  { name: 'Salman Musa',  title: 'Founder, Trade Leads Marketing' }
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

export const TERMS = ['Month-to-month', '3 months', '6 months', '12 months'];

export const AGENCY = {
  name: 'Trade Leads Marketing',
  email: 'info@tradeleadsmarketing.com',
  phone: '(289) 489-1167',
  site: 'tradeleadsmarketing.com',
  origin: 'https://www.tradeleadsmarketing.com'
};

export const DEFAULT_QUALIFIED =
  'a contact from a property owner in the Client service area who requests a quote or estimate for a service ' +
  'the Client offers and provides valid contact details. Spam, wrong numbers, solicitations, job applicants, ' +
  'and contacts outside the agreed service area do not count.';

export const DEFAULTS = {
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
  monthlyFee: '',

  services: ['ads', 'gbp', 'tracking', 'reporting'],
  customServices: [],

  guarantee: 'none',          // none | bookings | performance | both
  bookingCount: 3,
  bookingRemedy: 'waive',     // waive | untilMet
  qualifiedDefinition: DEFAULT_QUALIFIED,
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
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(n);
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
  ['clientBusiness', 'b'], ['clientContact', 'c'], ['clientTitle', 't'],
  ['clientAddress', 'a'], ['clientEmail', 'e'], ['clientPhone', 'p'],
  ['agreementDate', 'ad'], ['setupStart', 'ss'], ['term', 'tm'], ['currency', 'cu'],
  ['setupFee', 'sf'], ['monthlyFee', 'mf'],
  ['services', 'sv'], ['customServices', 'cs'],
  ['guarantee', 'g'], ['bookingCount', 'bc'], ['bookingRemedy', 'br'],
  ['qualifiedDefinition', 'qd'], ['minAdSpend', 'ms'], ['adSpendCurrency', 'mc'],
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

export function packContract(d) {
  const out = {};
  for (const [full, short] of PACK_KEYS) {
    let v = d[full];
    if (full === 'customServices' && Array.isArray(v)) v = v.filter((x) => String(x).trim());
    // Drop anything that still matches the default; it is rebuilt on unpack.
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
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
  const performance = d.guarantee === 'performance' || d.guarantee === 'both';
  return { bookings, performance, any: bookings || performance, both: d.guarantee === 'both' };
}

const BLANK = '________________';

/**
 * Builds the numbered clauses. Paragraph strings may contain **bold** runs and
 * `- ` list lines; every renderer understands those two conventions and nothing
 * else, which keeps screen, email, and plain text identical.
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

  add('Parties', [
    `This Marketing Services Agreement (the **"Agreement"**) is entered into on ${agreedOn} between ` +
    `**${AGENCY.name}** ("TLM", "we", "us") of ${AGENCY.email}, ${AGENCY.phone}, and ` +
    `**${d.clientBusiness || BLANK}** ("Client", "you")` +
    `${d.clientAddress ? ` of ${d.clientAddress}` : ''}, represented by ` +
    `${d.clientContact || BLANK}${d.clientTitle ? `, ${d.clientTitle}` : ''}.`
  ]);

  add('Services', [
    'TLM will provide the Client with the following services (the **"Services"**):',
    ...(services.length
      ? services.map((s) => `- **${s.label}.**${s.desc ? ` ${s.desc}` : ''}`)
      : [`- ${BLANK}`]),
    'Work outside this list is not included and will be quoted separately in writing before it begins.'
  ]);

  add('Setup and Start Date', [
    `Setup begins on ${setupStart} and covers the build work required to launch the Services: account access ` +
    'and configuration, tracking installation, campaign or page build, and any design work included above.',
    '**The monthly subscription starts on the date setup is completed and the Services go live, not on the ' +
    'date this Agreement is signed.** TLM will confirm that date to the Client in writing, and it becomes the ' +
    'monthly billing date for the remainder of the Agreement.'
  ]);

  add('Fees and Payment', [
    `- **Initial setup fee: ${setupFee || BLANK}.** One time, payable before setup work begins.`,
    `- **Monthly service fee: ${monthlyFee || BLANK} per month.** First payment due on the setup completion ` +
    'date, then monthly on the same day.',
    `- **Term: ${d.term}.**`,
    `All amounts are in ${d.currency} and exclusive of applicable taxes. Invoices are payable on receipt. ` +
    'Advertising spend paid to Google, Meta, or any other platform is billed by that platform directly to the ' +
    'Client and is not included in the fees above.'
  ]);

  if (g.any) {
    add('Advertising Budget', [
      `The Client will maintain a minimum advertising budget of **${adSpend || BLANK} per month**, paid ` +
      `directly to the advertising platform. This minimum is a condition of the ` +
      `${g.both ? 'guarantees' : 'guarantee'} in this Agreement: if the Client's advertising budget falls ` +
      `below it in any month, the ${g.both ? 'guarantees do' : 'guarantee does'} not apply for that month.`
    ]);
  }

  if (g.bookings) {
    const n = d.bookingCount;
    add('30-Day Booking Guarantee', [
      `TLM guarantees the Client will receive at least **${n} qualified booking${n === 1 ? '' : 's'}** within ` +
      'the first 30 days after the Services go live.',
      d.bookingRemedy === 'untilMet'
        ? 'If that target is not met within the first 30 days, **the Client owes no monthly service fee and ' +
          'none becomes payable until the target is met.** TLM continues to work at no monthly cost to the ' +
          'Client until it is.'
        : 'If that target is not met within the first 30 days, **the Client does not pay the monthly service ' +
          "fee for that period.** Any monthly fee already paid for that period is refunded or credited at the " +
          "Client's choice.",
      `A **qualified booking** means ${d.qualifiedDefinition}`,
      'This guarantee applies only where the Client has maintained the minimum advertising budget above, given ' +
      'TLM the account access and approvals needed to run and track the Services, and responded to incoming ' +
      'leads within one business day. The setup fee is not covered by this guarantee.'
    ]);
  }

  if (g.performance) {
    add('No-Trap Performance Clause', [
      'The Client is never locked into paying for work that is not performing. If, after the Services go live, ' +
      'TLM is not delivering against the performance expectations agreed at kickoff, the Client may end this ' +
      'Agreement immediately by written notice.',
      'On that notice, **no further monthly service fees are payable** beyond the month in which notice is ' +
      'given, and there is no early-termination charge, penalty, or remaining-term liability. The Client keeps ' +
      'ownership of the accounts and assets described below.',
      'This clause applies only while the Client maintains the minimum advertising budget above and provides ' +
      'the access and approvals TLM needs to do the work.'
    ]);
  }

  add('Client Responsibilities', [
    'The Client agrees to:',
    '- provide timely access to the website, domain, ad accounts, Google Business Profile, and analytics;',
    '- review and approve drafts, ad copy, and page content within a reasonable time;',
    '- respond to leads promptly, since TLM can generate a lead but only the Client can close it;',
    '- supply photos, service details, and any licence or insurance information needed for ads; and',
    '- pay advertising platforms directly and keep those accounts in good standing.',
    'Where a delay in the above prevents TLM from delivering the Services, timelines and any guarantee period ' +
    'shift by the length of that delay.'
  ]);

  add('Term, Renewal, and Termination', [
    `The term of this Agreement is **${d.term}**, beginning on the setup completion date.` +
    (d.term === 'Month-to-month'
      ? ' It continues month to month until either party ends it.'
      : ' At the end of the term it continues month to month unless either party gives notice.'),
    "Either party may end this Agreement with **30 days' written notice**. TLM will complete any work already " +
    'paid for. Fees for the final month are payable in full and setup fees are not refundable, except where a ' +
    'clause of this Agreement expressly says otherwise.'
  ]);

  add('Ownership and Confidentiality', [
    'The Client owns its ad accounts, Google Business Profile, domain, website content, lead data, and any ' +
    'creative produced specifically for the Client and paid for in full. TLM keeps ownership of its own ' +
    'templates, internal processes, tools, and anything built before this Agreement.',
    "Each party will keep the other's non-public business information confidential and use it only to perform " +
    "this Agreement. TLM may reference the Client's business name and campaign results as a case study unless " +
    'the Client asks in writing that it not.'
  ]);

  add('Results', [
    (g.any
      ? 'Apart from the guarantee terms expressly set out above, TLM does not guarantee any specific lead ' +
        'volume, ranking position, cost per lead, or revenue outcome.'
      : 'TLM does not guarantee any specific lead volume, ranking position, cost per lead, or revenue outcome.') +
    " Results depend on market competition, advertising budget, service area, seasonality, pricing, and the " +
    "Client's own sales process. TLM is not affiliated with or endorsed by Google, and cannot control changes " +
    'those platforms make to their policies, algorithms, or pricing.',
    "Neither party is liable to the other for indirect or consequential loss. TLM's total liability under this " +
    'Agreement is limited to the fees the Client paid TLM in the three months before the claim arose.'
  ]);

  add('General', [
    'This Agreement is governed by the laws of the Province of Ontario and the federal laws of Canada that ' +
    'apply in it. It is the entire agreement between the parties on this subject and replaces any earlier ' +
    'discussion or proposal. Changes must be in writing and signed by both parties. If any clause is found ' +
    'unenforceable, the rest of the Agreement stays in force.',
    'An electronic signature applied through the TLM signing page has the same effect as a signature in ink.'
  ]);

  return clauses;
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

  const subject = `Your Trade Leads Marketing agreement — ${business}`;

  const guaranteeLines = [];
  if (g.bookings) {
    guaranteeLines.push(
      `- ${d.bookingCount} qualified booking${d.bookingCount === 1 ? '' : 's'} in your first 30 days, or ` +
      (d.bookingRemedy === 'untilMet' ? 'you do not pay until we hit it.' : 'you do not pay for that month.')
    );
  }
  if (g.performance) {
    guaranteeLines.push('- If we are not delivering after launch, you can walk with no further fees. No lock-in.');
  }
  if (g.any) {
    guaranteeLines.push(
      `- Both of the above assume a minimum ad spend of ${money(d.minAdSpend, d.adSpendCurrency) || '[minimum]'} per month, paid directly to the platform.`
    );
  }

  const body = [
    `Hi ${first},`,
    '',
    `Great speaking with you. Here is the agreement for ${business}, attached as a PDF and also linked below so you can sign it online.`,
    '',
    'The short version:',
    `- Setup: ${setupFee}, one time, before we start building.`,
    `- Monthly: ${monthly}. This does not start until setup is finished and your campaigns are live.`,
    `- Term: ${d.term}.`,
    services.length ? `- Included: ${services.join(', ')}.` : '',
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
  ].filter((line) => line !== '').join('\n');

  return { subject, body };
}
