import nodemailer from 'nodemailer';
import { escapeHtml, shell, shellText, INK, MUTED, LINE } from './email-template.js';
import {
  decodeContract, buildClauses, selectedServices, money, longDate,
  SIGNERS, AGENCY
} from '../src/contract-model.js';

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

/* ============================================================
   RENDERING
   The clause strings carry **bold** runs and "- " list lines. Both
   renderers below understand exactly those two conventions, so the email
   says the same thing as the page the client signed.
   ============================================================ */

const boldToText = (s) => String(s).replace(/\*\*([^*]+)\*\*/g, '$1');

function clauseText(clause) {
  const lines = [`${clause.n}. ${clause.title.toUpperCase()}`, ''];
  for (const p of clause.paras) {
    lines.push(p.startsWith('- ') ? `  * ${boldToText(p.slice(2))}` : boldToText(p));
    lines.push('');
  }
  return lines.join('\n');
}

export function buildSignedEmail({ d, typedName, signedAtLong, reference, signatureCid }) {
  const signer = SIGNERS[d.signerIndex] || SIGNERS[0];
  const clauses = buildClauses(d);
  const services = selectedServices(d).map((s) => s.label);
  const agreementDate = longDate(d.agreementDate) || '-';
  const monthly = money(d.monthlyFee, d.currency);

  const subject = `Signed agreement - ${d.clientBusiness || 'Client'} (${reference})`;

  const rows = [
    ['Client', d.clientBusiness],
    ['Signed by', `${typedName} on ${signedAtLong}`],
    ['Countersigned', `${signer.name} on ${agreementDate}`],
    ['Setup fee', money(d.setupFee, d.currency)],
    ['Monthly fee', monthly ? `${monthly} from setup completion` : ''],
    ['Term', d.term],
    ['Services', services.join(', ')],
    ['Reference', reference]
  ];

  /* The signature is attached with a content_id and referenced as cid:, which
     Resend supports. Clients that block images still read correctly, because
     the typed name and the rule below it are real markup, not part of the
     picture. */
  const signatureHtml =
    `<div style="margin-top:28px;padding-top:20px;border-top:1px solid ${LINE};">`
    + `<div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};margin-bottom:10px;">Signature</div>`
    + `<img src="cid:${signatureCid}" alt="Signed by ${escapeHtml(typedName)}"`
    + ` width="260" style="display:block;max-width:260px;height:auto;border:0;outline:none;" />`
    + `<div style="border-top:1px solid ${INK};width:260px;margin-top:2px;"></div>`
    + `<div style="margin-top:6px;font-size:14px;font-weight:600;color:${INK};">${escapeHtml(typedName)}</div>`
    + `<div style="font-size:13px;color:${MUTED};">`
    + `${escapeHtml(d.clientTitle || '')}${d.clientBusiness ? `, ${escapeHtml(d.clientBusiness)}` : ''}`
    + `</div>`
    + `<div style="margin-top:4px;font-size:13px;color:${MUTED};">${escapeHtml(signedAtLong)}</div>`
    + `</div>`;

  const html = shell({
    heading: 'Signed agreement',
    rows,
    extraHtml: signatureHtml,
    footNote: 'The full agreement is attached as a text file. Keep this email for your records.'
  });

  const text = shellText({
    heading: 'Signed agreement',
    rows,
    extraText: `Signed by ${typedName} on ${signedAtLong}.\nThe full agreement is attached as a text file.`,
    footNote: 'Keep this email for your records.'
  });

  /* The clauses travel as an attachment rather than inline, so the email stays
     short enough to read on a phone while the record stays complete. */
  const agreementText = [
    'MARKETING SERVICES AGREEMENT',
    AGENCY.name,
    '',
    ...rows.map(([k, v]) => `${`${k}:`.padEnd(18, ' ')}${v && String(v).trim() ? v : '-'}`),
    '',
    '='.repeat(70),
    '',
    ...clauses.map(clauseText),
    '='.repeat(70),
    '',
    `For ${AGENCY.name}:  ${signer.name}, ${signer.title}   ${agreementDate}`,
    `For ${d.clientBusiness || 'the Client'}:  ${typedName}   ${signedAtLong}`,
    '',
    'Signed electronically. An electronic signature has the same effect as one in ink.',
    `${AGENCY.name} · ${AGENCY.phone} · ${AGENCY.email}`
  ].join('\n');

  return { subject, html, text, agreementText };
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
  const reference  = clean(body.reference, LIMITS.reference) || 'TLM-AGREEMENT';
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
  const signatureCid = 'tlm-client-signature';

  const { subject, html, text, agreementText } = buildSignedEmail({
    d, typedName, signedAtLong, reference, signatureCid
  });

  const office = process.env.MAIL_TO || AGENCY.email;
  const recipients = [office];
  if (isValidEmail(d.clientEmail)) recipients.push(d.clientEmail);

  const attachments = [
    {
      filename: `signature-${reference}.png`,
      content: m[1],
      content_type: 'image/png',
      content_id: signatureCid
    },
    {
      filename: `agreement-${reference}.txt`,
      content: Buffer.from(agreementText, 'utf8').toString('base64'),
      content_type: 'text/plain'
    }
  ];

  const resendKey  = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || `${AGENCY.name} <${AGENCY.email}>`;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secureEnv = process.env.SMTP_SECURE;
  const secure = secureEnv != null ? secureEnv === 'true' : port === 465;
  const smtpFrom = process.env.MAIL_FROM || 'forms@clinimedia.ca';
  const smtpConfigured = Boolean(host && user && pass);

  if (!resendKey && !smtpConfigured) {
    console.error('[sign] No transport configured: set RESEND_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS');
    return res.status(500).json({
      error: `Email is not configured on our end. Your signature was not sent — please call ${AGENCY.phone}.`
    });
  }

  if (resendKey) {
    try {
      await sendViaResend({
        apiKey: resendKey, from: resendFrom, to: recipients, replyTo: office,
        subject, html, text, attachments
      });
      return res.status(200).json({ ok: true, via: 'resend', sentTo: recipients.length });
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
    return res.status(200).json({ ok: true, via: 'smtp', sentTo: recipients.length });
  } catch (err) {
    console.error('[sign] SMTP send failed:', err?.message || err);
    return res.status(502).json({
      error: `We could not email the signed copy. Please call ${AGENCY.phone} and we will send it manually.`
    });
  }
}
