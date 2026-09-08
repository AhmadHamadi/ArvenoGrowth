import nodemailer from 'nodemailer';
import { escapeHtml, shell, shellText } from './email-template.js';

/**
 * POST /api/lead
 *
 * Single handler for every form on the marketing site:
 *   /            → the free-audit contact form   (body.source omitted / "audit")
 *   /apply       → kept for anything that still posts source === "apply";
 *                  the page itself now books through Calendly instead.
 *
 * Delivery: Resend first, SMTP as the fallback. The from address is chosen by
 * whichever transport actually sends, because Resend can only send from a
 * domain verified on the account (tradeleadsmarketing.com) while the SMTP
 * mailbox can only send as itself (forms@clinimedia.ca). Inheriting one
 * transport's from address into the other breaks every form.
 *
 * Required env vars for Resend (preferred):
 *   RESEND_API_KEY    re_...
 * Optional:
 *   RESEND_FROM       default: "Trade Leads Marketing <info@tradeleadsmarketing.com>"
 *
 * Required env vars for the SMTP fallback:
 *   SMTP_HOST         e.g. smtp.clinimedia.ca
 *   SMTP_PORT         587 or 465
 *   SMTP_USER         forms@clinimedia.ca
 *   SMTP_PASS         <password>
 * Optional:
 *   SMTP_SECURE       "true" | "false"  (default: true if port=465)
 *   MAIL_FROM         default: forms@clinimedia.ca     (SMTP transport only)
 *   MAIL_TO           default: info@tradeleadsmarketing.com
 *   ALLOWED_ORIGIN    default: https://www.tradeleadsmarketing.com
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Per-field input limits (defense against abuse)
const LIMITS = {
  name: 120,
  business: 160,
  email: 200,
  phone: 40,
  city: 120,
  service: 120,
  message: 4000,
  website: 200, // honeypot
  // extra fields a landing page may send
  source: 40,
  trade: 120,
  budget: 60,
  siteUrl: 200
};

// Rate limit: how many submissions one visitor may send, and over what window.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const clean = (v, max) => String(v ?? '').replace(/[\0-\b\v-\x1f\x7f]/g, '').trim().slice(0, max);

const isValidEmail = (e) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length >= 5 && e.length <= LIMITS.email;

// 10 digits, or 11 starting with a country code of 1.
const isValidPhone = (p) => {
  const n = String(p ?? '').replace(/\D/g, '');
  return n.length === 10 || (n.length === 11 && n[0] === '1');
};

/* ============================================================
   RATE LIMITING
   Best-effort, per warm serverless instance. It stops a single
   visitor hammering submit; it is not a substitute for a shared
   store if this ever needs to be strict.
   ============================================================ */
const hits = new Map(); // ip -> number[] (timestamps)

function rateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);

  // Keep the map from growing without bound on a long-lived instance.
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

/**
 * A lead from any form on the site. One template covers them all; the
 * subject line names where it came from so they stay easy to tell apart
 * in an inbox.
 */
export function buildAuditEmail(f) {
  const { name, business, email, phone, city, service, message, source, trade, budget, siteUrl } = f;
  const from = source === 'apply' ? 'Apply page' : 'Website form';

  const subject = `${from} - ${name}${business ? ` (${business})` : ''}${city ? `, ${city}` : ''}`;

  const site = siteUrl ? (/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`) : null;

  const rows = [
    ['Name', name],
    ['Business', business],
    ['Email', email, email ? `mailto:${email}` : null],
    ['Phone', phone, phone ? `tel:${phone}` : null],
    ['City', city],
    ['Interested in', service || trade],
    ['Budget', budget],
    ['Website', siteUrl, site]
  ];

  const parts = {
    heading: `New lead from the ${from.toLowerCase()}`,
    rows,
    message,
    messageLabel: 'What they said'
  };
  return { subject, html: shell(parts), text: shellText(parts) };
}

/* ============================================================
   TRANSPORTS
   ============================================================ */

/**
 * Resend. From address must be on a domain verified on the Resend account
 * (tradeleadsmarketing.com), which is why it is not read from MAIL_FROM.
 */
export async function sendViaResend({ apiKey, from, to, replyTo, subject, html, text }) {
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      reply_to: replyTo,
      subject,
      html,
      text
    })
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend responded ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}

/** Nodemailer over the clinimedia.ca mailbox — the original delivery path. */
export async function sendViaSmtp({ host, port, secure, user, pass, from, to, replyTo, subject, html, text }) {
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 8000
  });

  return transporter.sendMail({
    from: `"Trade Leads Marketing Form" <${from}>`,
    to,
    replyTo,
    subject,
    html,
    text
  });
}

/* ============================================================
   HANDLER
   ============================================================ */
export default async function handler(req, res) {
  // CORS — only allow same origin (or override via env)
  // The live site is the .com; the .ca only redirects to it.
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://www.tradeleadsmarketing.com';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse + size guard
  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > 16_000) return res.status(413).json({ error: 'Payload too large' });
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot — silently accept and discard
  if (body.website) return res.status(200).json({ ok: true });

  // Rate limit — a real person gets told; nothing is emailed either way
  if (rateLimited(clientIp(req))) {
    return res.status(429).json({
      error: `You've already sent that a few times. Give us a moment to reply, or call (289) 489-1167.`
    });
  }

  const source   = clean(body.source,   LIMITS.source).toLowerCase();
  const isApply  = source === 'apply';

  const name     = clean(body.name,     LIMITS.name);
  const business = clean(body.business, LIMITS.business);
  const email    = clean(body.email,    LIMITS.email);
  const phone    = clean(body.phone,    LIMITS.phone);
  const city     = clean(body.city,     LIMITS.city);
  const service  = clean(body.service,  LIMITS.service);
  const message  = clean(body.message,  LIMITS.message);
  // /apply-only fields
  const trade       = clean(body.trade,       LIMITS.trade);
  const budget      = clean(body.budget,      LIMITS.budget);
  const siteUrl     = clean(body.siteUrl,     LIMITS.siteUrl);

  if (!name || !email || !city) {
    return res.status(400).json({ error: 'Name, email, and city are required.' });
  }
  if (name.length < 2) {
    return res.status(400).json({ error: 'Please enter your name.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  // The application funnel promises a phone call, so the number has to be real.
  if (isApply && !isValidPhone(phone)) {
    return res.status(400).json({ error: 'Please enter a valid phone number.' });
  }

  const fields = { name, business, email, phone, city, service, message, trade, budget, siteUrl };
  const { subject, html, text } = buildAuditEmail({ ...fields, source });

  const to = process.env.MAIL_TO || 'info@tradeleadsmarketing.com';

  // --- Transport 1: Resend ---
  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || 'Trade Leads Marketing <info@tradeleadsmarketing.com>';

  // --- Transport 2: SMTP fallback ---
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secureEnv = process.env.SMTP_SECURE;
  const secure = secureEnv != null ? secureEnv === 'true' : port === 465;
  const smtpFrom = process.env.MAIL_FROM || 'forms@clinimedia.ca';
  const smtpConfigured = Boolean(host && user && pass);

  if (!resendKey && !smtpConfigured) {
    console.error('[lead] No transport configured: set RESEND_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS');
    return res.status(500).json({
      error: 'Email service not configured. Please email info@tradeleadsmarketing.com directly.'
    });
  }

  let resendError = null;

  if (resendKey) {
    try {
      await sendViaResend({
        apiKey: resendKey,
        from: resendFrom,
        to,
        replyTo: email,
        subject, html, text
      });
      return res.status(200).json({ ok: true, via: 'resend' });
    } catch (err) {
      resendError = err?.message || String(err);
      console.error('[lead] Resend send failed:', resendError);
      if (!smtpConfigured) {
        return res.status(502).json({
          error: 'Could not deliver your message right now. Please email info@tradeleadsmarketing.com directly.'
        });
      }
    }
  }

  try {
    await sendViaSmtp({
      host, port, secure, user, pass,
      from: smtpFrom,
      to,
      replyTo: email,
      subject, html, text
    });
    return res.status(200).json({ ok: true, via: 'smtp' });
  } catch (err) {
    console.error('[lead] SMTP send failed:', err?.message || err, resendError ? `(after Resend: ${resendError})` : '');
    return res.status(502).json({
      error: 'Could not deliver your message right now. Please email info@tradeleadsmarketing.com directly.'
    });
  }
}
