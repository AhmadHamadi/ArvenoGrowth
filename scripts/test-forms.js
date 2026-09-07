/**
 * Exercises every form on the site through api/lead.js without sending
 * a single email. global.fetch is stubbed, so the Resend call is captured
 * and inspected instead of leaving the machine.
 *
 * Run: node scripts/test-forms.js
 */
import handler from '../api/lead.js';

/* ---------- fetch stub: capture, never send ---------- */
const sent = [];
globalThis.fetch = async (url, init) => {
  const payload = JSON.parse(init.body);
  sent.push({ url, auth: init.headers.Authorization, payload });
  return {
    ok: true,
    status: 200,
    json: async () => ({ id: 'stubbed-message-id' }),
    text: async () => ''
  };
};

/* Force the Resend path; a fake key never leaves this process. */
process.env.RESEND_API_KEY = 're_TEST_KEY_NOT_REAL';
process.env.MAIL_TO = 'info@tradeleadsmarketing.com';
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

/* ---------- minimal req/res doubles ---------- */
function makeReq(body, ip = '10.0.0.1') {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    socket: { remoteAddress: ip },
    body
  };
}

function makeRes() {
  const res = {
    statusCode: null,
    payload: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(p) { this.payload = p; return this; },
    end() { return this; }
  };
  return res;
}

async function run(label, body, ip) {
  const before = sent.length;
  const res = makeRes();
  await handler(makeReq(body, ip), res);
  const email = sent.length > before ? sent[sent.length - 1] : null;
  return { label, status: res.statusCode, body: res.payload, email };
}

/* ---------- the forms ---------- */
const CASES = [
  {
    label: 'Homepage — free audit form (/#audit), all fields',
    ip: '10.0.0.1',
    body: {
      name: 'John Smith',
      business: 'Smith Concrete Co.',
      email: 'john@smithconcrete.ca',
      phone: '(905) 555-0134',
      city: 'Hamilton, ON',
      service: 'Google Ads management',
      message: 'Driveways and patios mostly. Ads are eating money.'
    },
    expect: { status: 200, emails: 1 }
  },
  {
    label: 'Homepage — free audit form, optional fields blank',
    ip: '10.0.0.2',
    body: {
      name: 'Dana Lee',
      email: 'dana@leeroofing.com',
      city: 'Austin, TX'
    },
    expect: { status: 200, emails: 1 }
  },
  {
    label: 'Lead with apply-page fields',
    ip: '10.0.0.3',
    body: {
      source: 'apply',
      name: 'Mike Rivera',
      business: 'Rivera Roofing',
      email: 'mike@riveraroofing.ca',
      phone: '(289) 555-0199',
      city: 'Burlington, ON',
      service: 'Roofing',
      trade: 'Roofing',
      budget: '$2,500 – $5,000 / mo',
      siteUrl: 'riveraroofing.ca',
      message: 'Best to call after 4pm.'
    },
    expect: { status: 200, emails: 1 }
  },
  {
    label: 'Lead with apply-page fields, optionals blank',
    ip: '10.0.0.4',
    body: {
      source: 'apply',
      name: 'Pat Nguyen',
      email: 'pat@nguyenhvac.com',
      phone: '2895550142',
      city: 'Oakville, ON',
      trade: 'HVAC',
      budget: 'Not sure yet'
      // business, siteUrl, message deliberately omitted
    },
    expect: { status: 200, emails: 1 }
  },
  {
    label: 'SPAM — honeypot filled (should be silently dropped)',
    ip: '10.0.0.5',
    body: {
      name: 'Bot', email: 'bot@spam.example', city: 'Nowhere',
      website: 'http://spam.example'
    },
    expect: { status: 200, emails: 0 }
  },
  {
    label: 'INVALID — bad email address',
    ip: '10.0.0.6',
    body: { name: 'Broken', email: 'not-an-email', city: 'Hamilton' },
    expect: { status: 400, emails: 0 }
  },
  {
    label: 'INVALID — missing name',
    ip: '10.0.0.7',
    body: { name: '', email: 'x@example.com', city: 'Hamilton' },
    expect: { status: 400, emails: 0 }
  },
  {
    label: 'INVALID — apply source with an unusable phone number',
    ip: '10.0.0.8',
    body: {
      source: 'apply', name: 'No Phone', email: 'np@example.com',
      city: 'Hamilton', phone: '123', trade: 'Plumbing'
    },
    expect: { status: 400, emails: 0 }
  }
];

/* ---------- run ---------- */
const results = [];
for (const c of CASES) {
  results.push({ ...(await run(c.label, c.body, c.ip)), expect: c.expect, sourceBody: c.body });
}

/* Rate limit: 4 rapid submissions from one visitor, cap is 3 */
const rlIp = '10.9.9.9';
const rl = [];
for (let i = 0; i < 4; i++) {
  rl.push(await run(`Rate limit attempt ${i + 1}`, {
    name: 'Repeat Sender', email: 'repeat@example.com', city: 'Hamilton, ON'
  }, rlIp));
}

/* ---------- report ---------- */
const line = (c = '─') => console.log(c.repeat(78));

console.log('\nFORM DELIVERY TEST — nothing was sent, fetch is stubbed');
line('═');

let pass = 0;
let fail = 0;

for (const r of results) {
  const emails = r.email ? 1 : 0;
  const ok = r.status === r.expect.status && emails === r.expect.emails;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.label}`);
  console.log(`      HTTP ${r.status}   emails sent: ${emails} (expected ${r.expect.emails})`);
  if (r.email) {
    const p = r.email.payload;
    console.log(`      SUBJECT   ${p.subject}`);
    console.log(`      from      ${p.from}`);
    console.log(`      to        ${JSON.stringify(p.to)}`);
    console.log(`      reply_to  ${p.reply_to}`);
    console.log(`      html      ${p.html.length} chars     text: ${p.text.length} chars`);
    // Every submitted value must appear in both bodies.
    const skip = new Set(['source', 'website']);
    const missing = Object.entries(r.sourceBody)
      .filter(([k, v]) => !skip.has(k) && v)
      .filter(([, v]) => !p.html.includes(String(v).replace(/&/g, '&amp;')) || !p.text.includes(String(v)))
      .map(([k]) => k);
    if (missing.length) {
      console.log(`      !! fields missing from the email body: ${missing.join(', ')}`);
      fail++; pass--;
    }
  } else if (r.body?.error) {
    console.log(`      rejected  "${r.body.error}"`);
  }
  console.log('');
}

line();
console.log('RATE LIMIT — same visitor, 4 submissions, cap is 3 per 10 min');
for (const r of rl) {
  const emails = r.email ? 1 : 0;
  console.log(`  ${r.label}: HTTP ${r.status}, emails ${emails}${r.body?.error ? ` — "${r.body.error}"` : ''}`);
}
const rlOk = rl.slice(0, 3).every((r) => r.status === 200) && rl[3].status === 429;
rlOk ? pass++ : fail++;
console.log(`  ${rlOk ? 'PASS' : 'FAIL'} — 4th submission blocked\n`);

line('═');
console.log('SUBJECT LINES, side by side:');
for (const r of results.filter((x) => x.email)) {
  console.log(`  • ${r.email.payload.subject}`);
}
line('═');
console.log(`\n${pass} passed, ${fail} failed`);
console.log(`Resend endpoint called: ${sent.length} time(s) — all stubbed, nothing left this machine.\n`);

process.exit(fail === 0 ? 0 : 1);
