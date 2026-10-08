import nodemailer from 'nodemailer';
import { escapeHtml, shell, INK, MUTED } from './email-template.js';
import { decodeContract, money, AGENCY, longDate } from '../src/contract-model.js';
import { buildContractPdf } from './contract-pdf.js';
import { saveSignedRecord, serviceConfig } from '../lib/crm.js';

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

const LIMITS = { typedName: 120, reference: 60, signedAt: 20, token: 12_000 };

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

export function buildSignedEmail({ d, typedName, signedAtLong, reference, hasPdf = true }) {
  const setup = money(d.setupFee, d.currency);
  const monthly = money(d.monthlyFee, d.currency);
  const business = d.clientBusiness || 'Client';

  const subject = `Signed agreement - ${business} (${reference})`;

  const line1 = `${business} signed on ${signedAtLong} by ${typedName}.`;
  const terms = [
    setup ? `${setup} setup` : null,
    monthly ? `${monthly} a month from setup completion` : null,
    d.term ? d.term.toLowerCase() : null
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
      + `<p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED};">${escapeHtml(closing)}</p>`,
    footNote: `Reference ${reference}`
  });

  const text = [
    'SIGNED AGREEMENT',
    '',
    line1,
    ...(sentence ? [sentence] : []),
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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
  const reference  = clean(body.reference, LIMITS.reference) || 'AG-AGREEMENT';
  const signedAt   = clean(body.signedAt, LIMITS.signedAt);
  const signature  = String(body.signature || '');

  if (!token) return res.status(400).json({ error: 'This signing link is missing its agreement.' });
  if (typedName.length < 2) return res.status(400).json({ error: 'Please type your full name.' });

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

  const signedAtLong = longDate(signedAt) || longDate(new Date().toISOString().slice(0, 10));

  let pdf;
  try {
    pdf = await buildContractPdf({
      d, typedName, signedAtLong, reference, signaturePngBase64: m[1]
    });
  } catch (err) {
    // A failed render must not cost the client their signature, so send the
    // note anyway and flag it in the log rather than returning an error.
    console.error('[sign] PDF render failed:', err?.message || err);
  }

  const { subject, html, text } = buildSignedEmail({
    d, typedName, signedAtLong, reference, hasPdf: Boolean(pdf)
  });

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

  if (!resendKey && !smtpConfigured) {
    console.error('[sign] No transport configured: set RESEND_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS');
    return res.status(500).json({
      error: `Email is not configured on our end. Your signature was not sent — please call ${AGENCY.phone}.`
    });
  }

  let crmArchived = false;
  const db = serviceConfig();
  if (db) {
    try {
      crmArchived = await saveSignedRecord(db, {
        reference, token, typedName, signedAt: new Date().toISOString(), pdf
      });
    } catch (err) {
      console.error('[sign] CRM archive failed:', err?.message || err);
      return res.status(503).json({ error: 'We could not securely save this signed agreement to the client records. Please contact Arveno so we can complete it safely.' });
    }
  }

  if (resendKey) {
    try {
      await sendViaResend({
        apiKey: resendKey, from: resendFrom, to: recipients, replyTo: office,
        subject, html, text, attachments
      });
      return res.status(200).json({ ok: true, via: 'resend', sentTo: recipients.length, crmArchived });
    } catch (err) {
      console.error('[sign] Resend send failed:', err?.message || err);
      if (!smtpConfigured) {
        return res.status(502).json({
          error: `We could not email the signed copy. Please call ${AGENCY.phone} and we will send it manually.`
        });
      }
    }
  }

  try {
    await sendViaSmtp({
      host, port, secure, user, pass, from: smtpFrom, to: recipients, replyTo: office,
      subject, html, text, attachments
    });
    return res.status(200).json({ ok: true, via: 'smtp', sentTo: recipients.length, crmArchived });
  } catch (err) {
    console.error('[sign] SMTP send failed:', err?.message || err);
    return res.status(502).json({
      error: `We could not email the signed copy. Please call ${AGENCY.phone} and we will send it manually.`
    });
  }
}
