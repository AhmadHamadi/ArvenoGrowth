// Portal sign-in for the plain Postgres backend.
// Passwords are scrypt hashes in crm_admin_users; sessions are short-lived
// HMAC-signed tokens. CONTRACT_ADMIN_EMAILS stays the final allowlist.
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { query } from './db.js';

const scrypt = promisify(scryptCb);
const N = 16384, R = 8, P = 1, KEYLEN = 64;
export const SESSION_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function allowlist() {
  return (process.env.CONTRACT_ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  if (secret.length < 32) throw Object.assign(new Error('Portal sign-in is not configured. Set ADMIN_SESSION_SECRET (32+ characters).'), { status: 503 });
  return secret;
}

export async function hashPassword(password) {
  if (String(password).length < 12) throw new Error('Use a password with at least 12 characters.');
  const salt = randomBytes(16);
  const key = await scrypt(String(password), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${b64url(salt)}$${b64url(key)}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(String(password), Buffer.from(salt, 'base64url'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Changes whenever the password changes, so a reset signs out every old session.
const passwordVersion = (hash) => createHash('sha256').update(String(hash || '')).digest('base64url').slice(0, 16);

export function signSession(email, now = Date.now(), pv = '') {
  const payload = b64url(JSON.stringify({ sub: email, pv, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + SESSION_HOURS * 3600 }));
  const sig = b64url(createHmac('sha256', sessionSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifySession(token, now = Date.now()) {
  const [payload, sig, extra] = String(token || '').split('.');
  if (!payload || !sig || extra !== undefined) return null;
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.sub || !Number.isFinite(data.exp) || data.exp * 1000 <= now) return null;
    return data;
  } catch {
    return null;
  }
}

export async function setAdminPassword(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw new Error('A valid email is required.');
  const hash = await hashPassword(password);
  await query(
    `insert into crm_admin_users (email, password_hash) values ($1, $2)
     on conflict (email) do update set password_hash = excluded.password_hash, failed_attempts = 0, locked_until = null`,
    [normalized, hash]
  );
  return normalized;
}

const fail = (message, status) => Object.assign(new Error(message), { status });

/** Check email + password. Returns a session token or throws a 4xx error. */
export async function login(email, password) {
  sessionSecret();
  const normalized = String(email || '').trim().toLowerCase().slice(0, 254);
  const generic = 'Email or password was not accepted.';
  if (!normalized || !password || String(password).length > 1024) throw fail(generic, 401);
  const { rows } = await query('select email, password_hash, failed_attempts, locked_until from crm_admin_users where email = $1', [normalized]);
  const user = rows[0];
  if (user?.locked_until && Date.parse(user.locked_until) > Date.now()) throw fail('Too many attempts. Try again in a few minutes.', 429);
  // Hash even for unknown users so timing does not reveal which emails exist.
  const ok = await verifyPassword(password, user?.password_hash || 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86));
  if (!user || !ok) {
    if (user) {
      const failed = user.failed_attempts + 1;
      await query(
        `update crm_admin_users set failed_attempts = $2::int, locked_until = case when $2::int >= $3::int then now() + make_interval(mins => $4::int) else null end where email = $1`,
        [normalized, failed, MAX_FAILED, LOCK_MINUTES]
      );
    }
    throw fail(generic, 401);
  }
  if (!allowlist().includes(normalized)) throw fail('This account is not authorized to view the contract CRM.', 403);
  await query('update crm_admin_users set failed_attempts = 0, locked_until = null, last_login_at = now() where email = $1', [normalized]);
  return { token: signSession(normalized, Date.now(), passwordVersion(user.password_hash)), email: normalized, expiresInHours: SESSION_HOURS };
}

/** Resolve the signed-in admin from a bearer token. */
export async function adminFromToken(token) {
  const session = verifySession(token);
  if (!session) throw fail('Your session has expired. Sign in again.', 401);
  const email = String(session.sub).toLowerCase();
  if (!allowlist().includes(email)) throw fail('This account is not authorized to view the contract CRM.', 403);
  const { rows } = await query('select email, password_hash from crm_admin_users where email = $1', [email]);
  if (!rows[0] || session.pv !== passwordVersion(rows[0].password_hash)) throw fail('Your session has expired. Sign in again.', 401);
  return { email };
}
