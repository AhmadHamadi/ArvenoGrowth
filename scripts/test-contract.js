/**
 * Exercises the contract pipeline end to end without sending an email:
 * pack -> encode -> link -> decode -> clauses -> signed email.
 *
 * global.fetch is stubbed, so the Resend call is captured and inspected
 * rather than leaving the machine.
 *
 * Run: node scripts/test-contract.js
 */
import handler, { buildSignedEmail } from '../api/sign.js';
import {
  DEFAULTS, SIGNERS, SERVICE_LIBRARY, PACKAGE_PRESETS, AGENCY,
  encodeContract, decodeContract, packContract, signingUrl, slugify,
  buildClauses, coveringEmail, contractGaps, money, longDate, selectedServices
} from '../src/contract-model.js';

/* ---------- fetch stub ---------- */
const sent = [];
globalThis.fetch = async (url, init) => {
  sent.push({ url, payload: JSON.parse(init.body) });
  return { ok: true, status: 200, json: async () => ({ id: 'stub' }), text: async () => '' };
};

process.env.RESEND_API_KEY = 're_TEST_KEY_NOT_REAL';
process.env.MAIL_TO = 'info@arvenogrowth.com';
delete process.env.SMTP_HOST; delete process.env.SMTP_USER; delete process.env.SMTP_PASS;

/* A 1x1 transparent PNG stands in for a drawn signature. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function makeReq(body, ip = '10.0.0.1') {
  return { method: 'POST', headers: { 'x-forwarded-for': ip }, socket: { remoteAddress: ip }, body };
}
function makeRes() {
  return {
    statusCode: null, payload: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(p) { this.payload = p; return this; },
    end() { return this; }
  };
}
async function post(body, ip) {
  const before = sent.length;
  const res = makeRes();
  await handler(makeReq(body, ip), res);
  return { status: res.statusCode, body: res.payload, email: sent.length > before ? sent[sent.length - 1] : null };
}

/* ---------- fixtures ---------- */
const FULL = {
  ...DEFAULTS,
  clientBusiness: 'Smith Concrete Co.',
  clientContact: 'John Smith',
  clientTitle: 'Owner',
  clientAddress: '123 Main St, Hamilton, ON',
  clientEmail: 'john@smithconcrete.ca',
  clientPhone: '(905) 555-0134',
  agreementDate: '2026-09-05',
  setupStart: '2026-09-15',
  term: '6 months',
  currency: 'CAD',
  setupFee: '1500',
  monthlyFee: '1200',
  services: ['ads', 'gbp', 'tracking', 'reporting', 'seo'],
  customServices: ['Quarterly strategy session', ''],
  guarantee: 'both',
  bookingCount: 3,
  bookingRemedy: 'untilMet',
  minAdSpend: 500,
  adSpendCurrency: 'USD',
  signerIndex: 1,
  signatureData: PNG
};

const MINIMAL = {
  ...DEFAULTS,
  clientBusiness: 'Nguyen HVAC',
  clientContact: 'Pat Nguyen',
  clientEmail: 'pat@nguyenhvac.com',
  agreementDate: '2026-09-05',
  setupStart: '2026-09-05',
  setupFee: '0',            // waived setup fee must still render as $0
  monthlyFee: '900',
  services: ['ads'],
  guarantee: 'none'
};

/* ---------- assertions ---------- */
let pass = 0, fail = 0;
const results = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; results.push(`PASS  ${name}`); }
  else { fail++; results.push(`FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
}

console.log('\nCONTRACT PIPELINE TEST — nothing was emailed, fetch is stubbed');
console.log('='.repeat(78));

/* --- 1. Codec round trip --- */
{
  const token = encodeContract(FULL);
  const back = decodeContract(token);
  const compare = ['clientBusiness', 'clientContact', 'clientEmail', 'agreementDate', 'setupStart',
    'term', 'currency', 'setupFee', 'setupPayment', 'monthlyFee', 'guarantee', 'bookingCount', 'bookingRemedy',
    'breakEvenDefinition', 'minAdSpend', 'adSpendCurrency', 'signerIndex'];
  const bad = compare.filter((k) => String(back[k]) !== String(FULL[k]));
  check('Codec round trip keeps every field', bad.length === 0, `differs: ${bad.join(', ')}`);
  check('Codec drops the empty custom-service line',
    back.customServices.length === 1 && back.customServices[0] === 'Quarterly strategy session',
    JSON.stringify(back.customServices));
  check('Codec never carries the signature image',
    !JSON.stringify(packContract(FULL)).includes('data:image'),
    'signature leaked into the link');
  check('Token is URL-safe', /^[A-Za-z0-9_-]+$/.test(token), token.slice(0, 40));
  console.log(`      link length: ${signingUrl(FULL).length} chars (token ${token.length})`);
  check('Signing link stays under 2000 chars', signingUrl(FULL).length < 2000);
}

/* --- 2. Unicode and awkward input survive the link --- */
{
  const weird = {
    ...MINIMAL,
    clientBusiness: 'Café Ståhl & Sons — Ontario’s #1',
    clientContact: 'José Peña',
    qualifiedDefinition: 'a contact — with an em dash, “smart quotes”, and é accents.'
  };
  const back = decodeContract(encodeContract(weird));
  check('Unicode survives the round trip',
    back.clientBusiness === weird.clientBusiness && back.clientContact === weird.clientContact,
    `${back.clientBusiness} / ${back.clientContact}`);
  check('Slug is URL-safe for a messy business name',
    /^[a-z0-9-]+$/.test(slugify(weird.clientBusiness)), slugify(weird.clientBusiness));
}

/* --- 3. Malformed tokens are rejected, not crashed on --- */
{
  const bad = ['', 'not-base64!!!', 'YWJj', btoa('[]').replace(/=/g, ''), btoa('"str"').replace(/=/g, '')];
  let rejected = 0;
  for (const t of bad) {
    try { decodeContract(t); } catch { rejected++; }
  }
  check('Every malformed token is rejected', rejected === bad.length, `${rejected}/${bad.length}`);
}

/* --- 4. Clause numbering shifts with the optional clauses --- */
{
  const titles = (g) => buildClauses({ ...FULL, guarantee: g }).map((c) => c.title);
  const none = titles('none'), bookings = titles('bookings'), perf = titles('performance'), both = titles('both');

  check('No guarantee omits all three optional clauses',
    !none.includes('30-Day Booking Guarantee') && !none.includes('No Lock-In'));
  check('Bookings guarantee adds budget + booking clauses only',
    bookings.includes('30-Day Booking Guarantee') && !bookings.includes('No Lock-In'));
  check('Performance clause adds budget + no-trap only',
    perf.includes('No Lock-In') && !perf.includes('30-Day Booking Guarantee'));
  check('Both adds all three', both.includes('30-Day Booking Guarantee') && both.includes('No Lock-In'));

  for (const [label, g] of [['none', 'none'], ['bookings', 'bookings'], ['performance', 'performance'], ['both', 'both']]) {
    const cs = buildClauses({ ...FULL, guarantee: g });
    const seq = cs.map((c) => c.n);
    check(`Clause numbering is 1..n with no gaps (${label})`,
      seq.every((n, i) => n === i + 1), seq.join(','));
  }
  const current = buildClauses({ ...MINIMAL, guarantee: 'breakEven', minAdSpend: 750, adSpendCurrency: 'USD' });
  const guarantee = current.find((c) => c.title === '90-Day Break-Even Guarantee')?.paras.join(' ');
  const normalizedGuarantee = guarantee?.toLowerCase();
  check('New contract guarantee states the 90-day break-even target',
    Boolean(normalizedGuarantee) && normalizedGuarantee.includes('first 90 days') && normalizedGuarantee.includes('gross profit'));
  check('New contract guarantee continues agreed work without a monthly fee',
    Boolean(guarantee) && guarantee.includes('continues the included Services at no monthly cost until the target is reached'));
  check('New guarantee keeps platform ad spend separate',
    Boolean(guarantee) && guarantee.includes('Platform ad spend and the setup fee remain payable'));

  const updated = buildClauses({ ...FULL, contractVersion: 2, packageName: 'Lead Engine', guarantee: 'breakEven', setupFee: '1000', monthlyFee: '797', setupPayment: 'threeMonthly' });
  const setupDeadline = updated.find((c) => c.title === 'Setup Deadline and CRM Measurement')?.paras.join(' ');
  const payback = updated.find((c) => c.title === 'Three-Month Service-Fee Payback Guarantee')?.paras.join(' ');
  check('Updated agreement gives a 14-calendar-day setup deadline and remedy',
    Boolean(setupDeadline) && setupDeadline.includes('14 calendar days') && setupDeadline.includes('refunded') && setupDeadline.includes('cancelled'));
  check('Updated payback target is the first three monthly service fees, excluding setup and ads',
    Boolean(payback) && payback.includes('first three full monthly subscription periods') && payback.includes('Setup fees, advertising spend') && payback.includes('without a monthly service fee'));
  check('CRM measurement requires accurate values and forbids knowingly invented results',
    Boolean(setupDeadline) && setupDeadline.includes('quoted project value') && setupDeadline.includes('will not knowingly invent, inflate, or misattribute'));
  check('Google conversion data is conditional on configuration, authorization, and platform requirements',
    Boolean(setupDeadline) && setupDeadline.includes('authorizes it') && setupDeadline.includes('Google controls its systems'));
  const v2Email = coveringEmail({ ...FULL, contractVersion: 2, guarantee: 'breakEven', setupFee: '1000', setupPayment: 'threeMonthly' }, 'https://example.test/sign');
  check('Updated covering email states setup installments, the 14-day target, and the payback offer',
    v2Email.body.includes('three monthly installments') && v2Email.body.includes('14 calendar days') && v2Email.body.includes('first three monthly service payments'));
}

/* --- 5. Guarantee wording actually changes with the remedy --- */
{
  const waive = buildClauses({ ...FULL, guarantee: 'bookings', bookingRemedy: 'waive' })
    .find((c) => c.title === '30-Day Booking Guarantee').paras.join(' ');
  const until = buildClauses({ ...FULL, guarantee: 'bookings', bookingRemedy: 'untilMet' })
    .find((c) => c.title === '30-Day Booking Guarantee').paras.join(' ');
  check('Remedy "waive" says they do not pay that period', waive.includes('the Client does not pay the monthly fee for that period'));
  check('Remedy "untilMet" says nothing is payable until met', until.includes('until it is met'));
  check('The two remedies are genuinely different text', waive !== until);

  const uncapped = buildClauses({ ...FULL, guarantee: 'bookings', bookingRemedy: 'untilMet', bookingCapDays: 0 })
    .find((c) => c.title === '30-Day Booking Guarantee').paras.join(' ');
  const capped = buildClauses({ ...FULL, guarantee: 'bookings', bookingRemedy: 'untilMet', bookingCapDays: 90 })
    .find((c) => c.title === '30-Day Booking Guarantee').paras.join(' ');
  check('No cap by default, so the wording is unchanged for existing contracts',
    !uncapped.includes('either party may end this Agreement on written notice'));
  check('A cap adds an exit after the chosen number of days',
    capped.includes('90 days after go-live') && capped.includes('either party may end this Agreement on written notice'));
  check('The cap survives the signing link', (() => {
    const back = decodeContract(encodeContract({ ...FULL, bookingCapDays: 90 }));
    return Number(back.bookingCapDays) === 90;
  })());

  const budget = buildClauses({ ...FULL, guarantee: 'both' }).find((c) => c.title === '30-Day Booking Guarantee').paras.join(' ');
  check('Minimum ad spend appears in the budget clause', budget.includes('$500.00') || budget.includes('$500'), budget.slice(0, 120));
  check('Both-guarantee budget clause uses plural wording', budget.includes('guarantees'));
}

/* --- 6. A waived ($0) setup fee renders as a real number --- */
{
  check('money() renders a deliberate zero', money('0', 'CAD') === '$0.00' || money('0', 'CAD') === '$0', money('0', 'CAD'));
  check('money() returns null for a blank fee', money('', 'CAD') === null);
  check('money() returns null for nonsense', money('abc', 'CAD') === null);
  const fees = buildClauses(MINIMAL).find((c) => c.title === 'Fees, Setup, and Term').paras.join(' ');
  check('A $0 setup fee prints in the fees clause instead of a blank line',
    fees.includes('$0') && fees.includes('Setup fee: $0'), fees.slice(0, 140));
  const upfront = buildClauses({ ...FULL, setupFee: '1000', setupPayment: 'beforeStart' }).find((c) => c.title === 'Fees, Setup, and Term').paras.join(' ');
  const split = buildClauses({ ...FULL, setupFee: '1000', setupPayment: 'threeMonthly' }).find((c) => c.title === 'Fees, Setup, and Term').paras.join(' ');
  check('Setup paid upfront is required before work begins', upfront.includes('Paid in full before work begins'));
  check('Three-part setup installments state each amount and due timing', split.includes('three monthly installments of $333.33, $333.33, $333.34') && split.includes('first installment is due before work begins'), split.slice(0, 220));
  check('Package presets match all four package names', PACKAGE_PRESETS.map((item) => item.name).join('|') === 'Foundation Engine|AI Visibility|Lead Engine|Growth Engine');
}

/* --- 7. Dates never shift a day --- */
{
  check('longDate keeps the exact day', longDate('2026-09-05') === 'September 5, 2026', longDate('2026-09-05'));
  check('longDate handles the first of a month', longDate('2026-01-01') === 'January 1, 2026', longDate('2026-01-01'));
  check('longDate returns null when empty', longDate('') === null);
}

/* --- 8. Gap detection --- */
{
  check('A complete contract reports no gaps', contractGaps(FULL).length === 0, contractGaps(FULL).join(', '));
  check('An empty contract reports gaps', contractGaps(DEFAULTS).length >= 5);
  check('A missing client email is flagged',
    contractGaps({ ...FULL, clientEmail: '' }).includes('Client email (needed to send it)'));
  check('A $0 setup fee is NOT flagged as missing',
    !contractGaps({ ...FULL, setupFee: '0' }).includes('Setup fee'));
  check('No services selected is flagged',
    contractGaps({ ...FULL, services: [], customServices: [] }).includes('At least one service'));
}

/* --- 9. Covering email --- */
{
  const url = signingUrl(FULL);
  const { subject, body } = coveringEmail(FULL, url);
  check('Covering subject names the client', subject.includes('Smith Concrete Co.'), subject);
  check('Covering body contains the signing link', body.includes(url));
  check('Covering body greets the contact by first name', body.includes('Hi John,'));
  check('Covering body states the setup fee', body.includes('$1,500'));
  check('Covering body states the monthly fee', body.includes('$1,200'));
  check('Covering body states the term', body.includes('6 months'));
  check('Covering body is signed by the chosen signer', body.includes(SIGNERS[1].name), SIGNERS[1].name);
  check('Covering body mentions both guarantees',
    body.includes('qualified booking') && body.includes('no further fees'));
  const currentOffer = coveringEmail({ ...MINIMAL, guarantee: 'breakEven' }, url).body;
  check('New covering email explains the 90-day break-even offer',
    currentOffer.includes('90-day break-even guarantee') && currentOffer.includes('without a monthly service fee'));
  check('Covering body has no blank-line pileups', !body.includes('\n\n\n'));
}

/* --- 10. The signed-copy email --- */
{
  const { subject, html, text } = buildSignedEmail({
    d: FULL, typedName: 'John Smith', signedAtLong: 'September 6, 2026',
    reference: 'AG-SMITHC-260905', hasPdf: true
  });
  check('Signed subject names the client', subject.includes('Smith Concrete Co.'), subject);
  check('Signed subject carries the reference', subject.includes('AG-SMITHC-260905'));
  check('HTML says the signed PDF is attached', html.includes('signed agreement is attached as a PDF'));
  check('Email identifies signer and date', html.includes('John Smith') && html.includes('September 6, 2026'));
  check('HTML uses the shared plain shell', html.includes('Signed agreement') && html.includes('border-top:3px solid #0F59F5'));
  check('Text includes agreement reference', text.includes('AG-SMITHC-260905'));
  check('HTML and text have no leftover bold markers', !html.includes('**') && !text.includes('**'));
  check('HTML escapes a hostile business name', (() => {
    const evil = { ...FULL, clientBusiness: '<script>alert(1)</script>' };
    const out = buildSignedEmail({ d: evil, typedName: 'X Y', signedAtLong: 'today', reference: 'R' });
    return !out.html.includes('<script>alert(1)</script>') && out.html.includes('&lt;script&gt;');
  })());
  check('HTML escapes a hostile typed name', (() => {
    const out = buildSignedEmail({ d: FULL, typedName: '"><img src=x onerror=alert(1)>', signedAtLong: 'today', reference: 'R' });
    return !out.html.includes('<img src=x');
  })());
}

/* --- 11. The endpoint --- */
{
  const token = encodeContract(FULL);

  const ok = await post({ token, signature: PNG, typedName: 'John Smith', signedAt: '2026-09-06', reference: 'AG-A' }, '20.0.0.1');
  check('A valid signature returns 200', ok.status === 200, JSON.stringify(ok.body));
  check('One email is sent', Boolean(ok.email));
  if (ok.email) {
    const p = ok.email.payload;
    check('Signed copy goes to BOTH the office and the client',
      p.to.length === 2 && p.to.includes('info@arvenogrowth.com') && p.to.includes('john@smithconcrete.ca'),
      JSON.stringify(p.to));
    check('Real recipients are in "to", never bcc', Array.isArray(p.to) && p.bcc === undefined);
    check('reply_to points at the office', p.reply_to === 'info@arvenogrowth.com', String(p.reply_to));
    check('Both html and text are present', Boolean(p.html) && Boolean(p.text));
    check('One attachment: the signed PDF agreement',
      Array.isArray(p.attachments) && p.attachments.length === 1,
      JSON.stringify(p.attachments?.map((a) => a.filename)));
    const docAtt = p.attachments?.find((a) => a.filename?.endsWith('.pdf'));
    check('The signed agreement is attached as a PDF', Boolean(docAtt) && docAtt.content_type === 'application/pdf');
    check('PDF has a valid file header', Boolean(docAtt) && Buffer.from(docAtt.content, 'base64').subarray(0, 5).toString() === '%PDF-');
    console.log(`      SUBJECT   ${p.subject}`);
    console.log(`      to        ${JSON.stringify(p.to)}`);
    console.log(`      html      ${p.html.length} chars     text: ${p.text.length} chars`);
  }

  const noSig = await post({ token, signature: '', typedName: 'John Smith' }, '20.0.0.2');
  check('A missing signature is rejected', noSig.status === 400 && !noSig.email, JSON.stringify(noSig.body));

  const badSig = await post({ token, signature: 'javascript:alert(1)', typedName: 'John Smith' }, '20.0.0.3');
  check('A non-PNG signature is rejected', badSig.status === 400 && !badSig.email, JSON.stringify(badSig.body));

  const noName = await post({ token, signature: PNG, typedName: 'J' }, '20.0.0.4');
  check('A one-character name is rejected', noName.status === 400 && !noName.email);

  const noToken = await post({ signature: PNG, typedName: 'John Smith' }, '20.0.0.5');
  check('A missing token is rejected', noToken.status === 400 && !noToken.email);

  const junkToken = await post({ token: 'not-a-real-token!!', signature: PNG, typedName: 'John Smith' }, '20.0.0.6');
  check('A corrupt token is rejected', junkToken.status === 400 && !junkToken.email, JSON.stringify(junkToken.body));

  const huge = await post({ token, signature: `data:image/png;base64,${'A'.repeat(500_000)}`, typedName: 'John Smith' }, '20.0.0.7');
  check('An oversized signature is rejected', huge.status === 413 && !huge.email);

  // A client with no email on file still notifies the office.
  const officeOnlyToken = encodeContract({ ...FULL, clientEmail: '' });
  const officeOnly = await post({ token: officeOnlyToken, signature: PNG, typedName: 'John Smith' }, '20.0.0.8');
  check('With no client email, the office is still notified',
    officeOnly.status === 200 && officeOnly.email?.payload.to.length === 1,
    JSON.stringify(officeOnly.email?.payload.to));

  const wrongMethod = makeRes();
  await handler({ method: 'GET', headers: {}, socket: {} }, wrongMethod);
  check('GET is refused', wrongMethod.statusCode === 405);
}

/* --- 12. Rate limiting --- */
{
  const token = encodeContract(FULL);
  const ip = '30.0.0.1';
  const codes = [];
  for (let i = 0; i < 8; i++) {
    codes.push((await post({ token, signature: PNG, typedName: 'John Smith' }, ip)).status);
  }
  check('The 7th attempt from one visitor is blocked',
    codes.slice(0, 6).every((c) => c === 200) && codes[6] === 429 && codes[7] === 429,
    codes.join(','));
}

/* ---------- report ---------- */
console.log(results.join('\n'));
console.log('='.repeat(78));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(`Resend endpoint called ${sent.length} time(s) — all stubbed, nothing left this machine.\n`);
process.exit(fail === 0 ? 0 : 1);
