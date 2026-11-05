import { readBookingFollowupToken } from '../lib/booking-followup.js';

const ALLOWED_EVENTS = new Set(['booking_confirmed']);
const WINDOW_MS = 15 * 60 * 1000;
const MAX_EVENTS_PER_WINDOW = 6;
const hits = new Map();

function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded) && forwarded.length) return String(forwarded[0]).trim();
  return req?.headers?.['x-real-ip'] || req?.socket?.remoteAddress || '';
}

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (!times.some((time) => now - time < WINDOW_MS)) hits.delete(key);
    }
  }
  return recent.length > MAX_EVENTS_PER_WINDOW;
}

export default async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://www.arvenogrowth.com';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (req.headers?.origin !== allowedOrigin) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > 1000) return res.status(413).json({ error: 'Payload too large' });
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const event = String(body?.event || '');
  if (!ALLOWED_EVENTS.has(event)) {
    return res.status(400).json({ error: 'Unsupported booking event.' });
  }

  if (isRateLimited(getClientIp(req))) {
    return res.status(429).json({ error: 'Booking notifications are temporarily limited.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const emailId = readBookingFollowupToken(body?.bookingFollowupToken, apiKey);
  if (!apiKey || !emailId) return res.status(200).json({ ok: true, cancelled: false });

  try {
    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(emailId)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      // A reminder that already sent or was already canceled needs no further action.
      if (response.status === 400 || response.status === 404) return res.status(200).json({ ok: true, cancelled: false });
      const detail = await response.text().catch(() => '');
      throw new Error(`Resend cancellation failed (${response.status}): ${detail.slice(0, 180)}`);
    }
    return res.status(200).json({ ok: true, cancelled: true });
  } catch (error) {
    console.error('[booking-event] Notification failed:', error?.message || String(error));
    return res.status(502).json({ error: 'Booking notification could not be delivered.' });
  }
}
