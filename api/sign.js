import nodemailer from 'nodemailer';
import { escapeHtml, shell, INK, MUTED } from './email-template.js';
import { decodeContract, money, AGENCY, longDate, slugify, terminationFee } from '../src/contract-model.js';
import { buildContractPdf } from './contract-pdf.js';
import { dbRequest, findContractBySigningToken, saveSignedRecord, serviceConfig } from '../lib/crm.js';
import { createContractCheckout, stripeClient } from '../lib/stripe.js';

/**
 * POST /api/sign
 *
 * Called when a client signs a Marketing Services Agreement on /sign.
 * Emails a complete copy of the signed agreement to the client and to the
 * office, with the drawn signature embedded inline.
 *
 * The agreement itself travels in the signing link rather than a database, so
 * this endpoint reconstructs it from the same token the client read, using the
 * same wording module the page rendered from.
 *
 * Uses the transports configured for /api/lead: Resend first, SMTP fallback.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const LIMITS = { typedName: 120, typedBusinessName: 160, reference: 60, signedAt: 20, token: 12_000 };

const MAX_SIGNATURE_BYTES = 400_000; // a drawn signature is a few tens of KB

const clean = (v, max) => String(v ?? '').replace(/[\0-\b\v-\x1f\x7f]/g, '').trim().slice(0, max);

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e)) && String(e).length <= 200;

/* Rate limit — best effort, per warm serverless instance. */
const hits = new Map();
const RATE_LIMIT_MAX = 6;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function rateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < RATE_LIMIT_WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > RATE_LIMIT_MAX;
}

function clientIp(req) {
  const fwd = req?.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length) return String(fwd[0]).trim();
  return req?.headers?.['x-real-ip'] || req?.socket?.remoteAddress || '';
}

export function buildSignedEmail({ d, typedName, signedAtLong, reference, hasPdf = true, checkoutUrls = {} }) {
  const setup = money(d.setupFee, d.currency);
  const monthly = money(d.monthlyFee, d.currency);
  const billingTrigger = Number(d.setupFee || 0) > 0 ? 'the first successful setup payment' : 'successful card setup';
  const exitFee = Number(d.contractVersion) >= 5 && d.term !== 'Month-to-month' && terminationFee(d) > 0
    ? money(terminationFee(d), d.currency) : null;
  const business = d.clientBusiness || 'Client';

  const subject = `Signed agreement - ${business} (${reference})`;

  const line1 = `${business} signed on ${signedAtLong} by ${typedName}.`;
  const terms = [
    setup ? (d.setupPayment === 'threeMonthly' ? `${setup} setup in three monthly installments` : `${setup} setup paid in full`) : null,
    monthly ? Number(d.contractVersion) >= 7
      ? `${monthly} per month beginning 14 days after ${billingTrigger}`
      : Number(d.contractVersion) >= 6
      ? `${monthly} per month beginning when the client completes the separate monthly Stripe Checkout`
      : `${monthly} a month from setup completion` : null,
    d.term ? d.term.toLowerCase() : null,
    exitFee ? `one-time ${exitFee} early-termination fee if the client ends a fixed term early` : null
  ].filter(Boolean).join(', ');

  // The closing line has to match what actually left the building. Promising an
  // attachment that failed to render sends the client hunting for a paperclip
  // that is not there.
  const closing = hasPdf
    ? 'The signed agreement is attached as a PDF.'
    : `We will send the PDF copy across shortly. If it has not arrived within the hour, call ${AGENCY.phone}.`;

  const sentence = terms ? `${terms.charAt(0).toUpperCase()}${terms.slice(1)}.` : null;

  const html = shell({
    heading: 'Signed agreement',
    rows: [],
    message: undefined,
    extraHtml:
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};">${escapeHtml(line1)}</p>`
      + (sentence ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};">${escapeHtml(sentence)}</p>` : '')
      + (checkoutUrls.setup ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};"><a href="${escapeHtml(checkoutUrls.setup)}">Complete the setup payment</a></p>` : '')
      + (checkoutUrls.monthly ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};"><a href="${escapeHtml(checkoutUrls.monthly)}">Start the monthly service subscription</a></p>` : '')
      + `<p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED};">${escapeHtml(closing)}</p>`,
    footNote: `Reference ${reference}`
  });

  const text = [
    'SIGNED AGREEMENT',
    '',
    line1,
    ...(sentence ? [sentence] : []),
    ...(checkoutUrls.setup ? ['', `Setup payment: ${checkoutUrls.setup}`] : []),
    ...(checkoutUrls.monthly ? [`Monthly subscription: ${checkoutUrls.monthly}`] : []),
    '',
    closing,
    '',
    `Reference ${reference}`
  ].join('\n');

  return { subject, html, text };
}

/* ============================================================
   TRANSPORTS
   ============================================================ */
async function sendViaResend({ apiKey, from, to, replyTo, subject, html, text, attachments }) {
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      reply_to: replyTo,
      subject,
      html,
      text,
      attachments: attachments?.length ? attachments : undefined
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend responded ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}

async function sendViaSmtp({ host, port, secure, user, pass, from, to, replyTo, subject, html, text, attachments }) {
  const transporter = nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000
  });
  return transporter.sendMail({
    from: `"${AGENCY.name}" <${from}>`,
    to, replyTo, subject, html, text,
    attachments: (attachments || []).map((a) => ({
      filename: a.filename,
      content: a.content,
      encoding: 'base64',
      contentType: a.content_type,
      ...(a.content_id ? { cid: a.content_id } : {})
    }))
  });
}

/* ============================================================
   HANDLER
   ============================================================ */
export default async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || AGENCY.origin;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method === 'GET') {
    const token = clean(req.query?.token, LIMITS.token);
    if (!token) return res.status(400).json({ error: 'This signing link is missing its agreement.' });
    let agreement;
    try { agreement = decodeContract(token); }
    catch { return res.status(400).json({ error: 'This signing link could not be read. Please ask Arveno to resend it.' }); }
    const name = slugify(agreement.clientBusiness).toUpperCase().replace(/-/g, '').slice(0, 6) || 'AGREE';
    const reference = `AG-${name}-${String(agreement.agreementDate || '').replace(/-/g, '').slice(2) || '000000'}`;
    const db = serviceConfig();
    if (!db) return res.status(503).json({ error: 'The signing service is temporarily unavailable. Please contact Arveno.' });
    try {
      const { createHash } = await import('node:crypto');
      const hash = createHash('sha256').update(token).digest('hex');
      const rows = await dbRequest(db, `contracts?reference=eq.${encodeURIComponent(reference)}&contract_token_hash=eq.${hash}&select=signing_expires_at,signed_at,status`);
      const row = rows?.[0];
      if (!row) return res.status(404).json({ error: 'This agreement is not available for signing. Please ask Arveno to resend it.' });
      if (row.signed_at || row.status === 'signed' || row.status === 'archived') return res.status(409).json({ error: 'This agreement has already been signed.' });
      const expiresAt = Date.parse(row.signing_expires_at || '');
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return res.status(410).json({ error: 'This signing link has expired. Please ask Arveno to send a new link.' });
      return res.status(200).json({ valid: true, expiresAt: row.signing_expires_at });
    } catch (error) {
      console.error('[sign] Link validation failed:', error?.message || error);
      return res.status(503).json({ error: 'The signing service is temporarily unavailable. Please try again shortly.' });
    }
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > 1_000_000) return res.status(413).json({ error: 'Payload too large' });
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  if (rateLimited(clientIp(req))) {
    return res.status(429).json({
      error: `Too many attempts from this connection. Please call ${AGENCY.phone} and we will finish it with you.`
    });
  }

  const token      = clean(body.token, LIMITS.token);
  const typedName  = clean(body.typedName, LIMITS.typedName);
  const typedBusinessName = clean(body.typedBusinessName, LIMITS.typedBusinessName);
  const reference  = clean(body.reference, LIMITS.reference) || 'AG-AGREEMENT';
  const signedAt   = clean(body.signedAt, LIMITS.signedAt);
  const signature  = String(body.signature || '');

  if (!token) return res.status(400).json({ error: 'This signing link is missing its agreement.' });
  if (typedName.length < 2) return res.status(400).json({ error: 'Please type your full name.' });
  if (!typedBusinessName) return res.status(400).json({ error: 'Please type your business name.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(signedAt) || Number.isNaN(Date.parse(`${signedAt}T12:00:00Z`)) || new Date(`${signedAt}T12:00:00Z`).toISOString().slice(0, 10) !== signedAt) return res.status(400).json({ error: 'Please enter a valid signing date.' });

  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(signature);
  if (!m) return res.status(400).json({ error: 'Please sign in the signature box.' });
  if (m[1].length > MAX_SIGNATURE_BYTES) {
    return res.status(413).json({ error: 'That signature image is too large to send.' });
  }

  let d;
  try {
    d = decodeContract(token);
  } catch {
    return res.status(400).json({ error: 'This signing link could not be read. Please ask us to resend it.' });
  }
  const normalizeBusiness = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  if (normalizeBusiness(typedBusinessName) !== normalizeBusiness(d.clientBusiness)) return res.status(400).json({ error: 'Please type the business name exactly as it appears in the agreement.' });

  const signedAtLong = longDate(signedAt) || longDate(new Date().toISOString().slice(0, 10));

  let pdf;
  try {
    pdf = await buildContractPdf({
      d, typedName, typedBusinessName, signedAtLong, reference, signaturePngBase64: m[1]
    });
  } catch (err) {
    // A failed render must not cost the client their signature, so send the
    // note anyway and flag it in the log rather than returning an error.
    console.error('[sign] PDF render failed:', err?.message || err);
  }

  const office = process.env.MAIL_TO || AGENCY.email;
  const recipients = [office];
  if (isValidEmail(d.clientEmail)) recipients.push(d.clientEmail);

  const attachments = pdf
    ? [{
        filename: `Signed agreement - ${(d.clientBusiness || 'Client').replace(/[^\w .-]/g, '')} (${reference}).pdf`,
        content: pdf.toString('base64'),
        content_type: 'application/pdf'
      }]
    : [];

  const resendKey  = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || `${AGENCY.name} <${AGENCY.email}>`;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secureEnv = process.env.SMTP_SECURE;
  const secure = secureEnv != null ? secureEnv === 'true' : port === 465;
  const smtpFrom = process.env.MAIL_FROM || 'info@arvenogrowth.com';
  const smtpConfigured = Boolean(host && user && pass);

  let crmArchived = false;
  const checkoutUrls = {};
  let checkoutWarning = '';
  const db = serviceConfig();
  if (!db) return res.status(503).json({ error: 'The CRM signing service is unavailable. Please contact Arveno and do not submit again.' });
  try {
    crmArchived = await saveSignedRecord(db, {
      reference, token, typedName, typedBusinessName, signedAt: new Date().toISOString(), pdf
    });
    if (!crmArchived) return res.status(404).json({ error: 'This agreement is no longer available for signing. Please ask Arveno to send a new link.' });
  } catch (err) {
    console.error('[sign] CRM archive failed:', err?.message || err);
    if (err?.status === 409 || err?.status === 410) return res.status(err.status).json({ error: err.message });
    return res.status(503).json({ error: 'We could not securely save this signed agreement to the client records. Please contact Arveno to complete it safely.' });
  }

  if (crmArchived && db) {
    try {
      const record = await findContractBySigningToken(db, { reference, token });
      if (record) {
        const stripe = stripeClient();
        let customerId = record.stripe_customer_id;
        const setupMode = Number(record.setup_fee) <= 0
          ? 'card_only'
          : record.agreement?.setupPayment === 'threeMonthly' ? 'three_monthly' : 'full';
        if (!customerId && Number(record.monthly_fee) > 0) {
          const customer = await stripe.customers.create({
            name: record.client_business, email: record.client_email,
            metadata: { contract_id: record.id, ...(record.client_id ? { client_id: record.client_id } : {}) }
          }, { idempotencyKey: `ag-customer-${record.id}` });
          customerId = customer.id;
          await dbRequest(db, `contracts?id=eq.${encodeURIComponent(record.id)}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_customer_id: customerId })
          });
          if (record.client_id) await dbRequest(db, `clients?id=eq.${encodeURIComponent(record.client_id)}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_customer_id: customerId })
          });
        }
        const contract = { ...record, stripe_customer_id: customerId || null };
        const origin = process.env.VERCEL_ENV === 'preview'
          ? `https://${process.env.VERCEL_URL}`
          : process.env.PUBLIC_SITE_URL || AGENCY.origin;
        if (Number(record.setup_fee) > 0 || Number(record.monthly_fee) > 0) {
          const setup = await createContractCheckout(stripe, { contract, action: 'setup', setupMode, origin });
          checkoutUrls.setup = setup.session.url || '';
          await dbRequest(db, `contracts?id=eq.${encodeURIComponent(record.id)}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ stripe_setup_checkout_session_id: setup.session.id, stripe_setup_mode: setupMode })
          });
        }
        if (Number(record.monthly_fee) > 0 && Number(record.agreement?.contractVersion || 0) < 7) {
          const monthly = await createContractCheckout(stripe, { contract, action: 'service', origin });
          checkoutUrls.monthly = monthly.session.url || '';
          await dbRequest(db, `contracts?id=eq.${encodeURIComponent(record.id)}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ stripe_service_checkout_session_id: monthly.session.id })
          });
        }
      }
    } catch (error) {
      checkoutWarning = 'The agreement was signed, but payment setup could not be opened. Please contact Arveno to finish billing.';
      console.error('[sign] Stripe Checkout creation failed:', error?.message || error);
    }
  }

  const { subject, html, text } = buildSignedEmail({
    d, typedName, signedAtLong, reference, hasPdf: Boolean(pdf), checkoutUrls
  });

  if (!resendKey && !smtpConfigured) {
    return res.status(200).json({ ok: true, via: null, crmArchived, checkoutUrls, checkoutWarning, emailWarning: 'Email delivery is not configured.' });
  }

  if (resendKey) {
    try {
      await sendViaResend({
        apiKey: resendKey, from: resendFrom, to: recipients, replyTo: office,
        subject, html, text, attachments
      });
      return res.status(200).json({ ok: true, via: 'resend', sentTo: recipients.length, crmArchived, checkoutUrls, checkoutWarning });
    } catch (err) {
      console.error('[sign] Resend send failed:', err?.message || err);
      if (!smtpConfigured) {
        return res.status(200).json({ ok: true, via: null, crmArchived, checkoutUrls, checkoutWarning, emailWarning: 'The signed copy could not be emailed. Save it as a PDF from this page.' });
      }
    }
  }

  try {
    await sendViaSmtp({
      host, port, secure, user, pass, from: smtpFrom, to: recipients, replyTo: office,
      subject, html, text, attachments
    });
    return res.status(200).json({ ok: true, via: 'smtp', sentTo: recipients.length, crmArchived, checkoutUrls, checkoutWarning });
  } catch (err) {
    console.error('[sign] SMTP send failed:', err?.message || err);
    return res.status(200).json({ ok: true, via: null, crmArchived, checkoutUrls, checkoutWarning, emailWarning: 'The signed copy could not be emailed. Save it as a PDF from this page.' });
  }
}
