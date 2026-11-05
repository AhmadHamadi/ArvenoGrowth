import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;

function signature(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createBookingFollowupToken(emailId, secret, now = Date.now()) {
  if (!emailId || !secret) return null;
  const payload = Buffer.from(JSON.stringify({ id: String(emailId), exp: now + TOKEN_LIFETIME_MS })).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export function readBookingFollowupToken(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string' || token.length > 1200) return null;
  const [payload, supplied, extra] = token.split('.');
  if (!payload || !supplied || extra) return null;
  const expected = signature(payload, secret);
  const actualBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof value.id !== 'string' || !value.id || !Number.isFinite(value.exp) || value.exp < now || value.exp > now + TOKEN_LIFETIME_MS + 60_000) return null;
    return value.id;
  } catch {
    return null;
  }
}
