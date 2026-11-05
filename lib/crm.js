import { getFile, pgRequest, putFile } from './db.js';
import { adminFromToken, login as portalLogin } from './portal-auth.js';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

export function json(res, status, body) {
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  return res.status(status).json(body);
}

// Postgres (DATABASE_URL) is the portal database. Supabase REST is kept only as
// a legacy fallback until production data has been moved (scripts/db.js import-supabase).
export function dbMode() {
  if (process.env.DATABASE_URL) return 'postgres';
  if (process.env.SUPABASE_URL) return 'supabase';
  return null;
}

export function serviceConfig() {
  if (dbMode() === 'postgres') return { mode: 'postgres' };
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return { mode: 'supabase', url: url.replace(/\/$/, ''), service, legacyServiceKey: !process.env.SUPABASE_SECRET_KEY };
}

const bearer = (req) => {
  const authorization = String(req.headers?.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || token.length > 8192) throw Object.assign(new Error('Sign in to continue.'), { status: 401 });
  return token;
};

export async function requireAdmin(req) {
  const allowlist = (process.env.CONTRACT_ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (dbMode() === 'postgres') {
    if (!allowlist.length || !process.env.ADMIN_SESSION_SECRET) throw Object.assign(new Error('CRM is not configured. Add DATABASE_URL, ADMIN_SESSION_SECRET and CONTRACT_ADMIN_EMAILS.'), { status: 503 });
    const user = await adminFromToken(bearer(req));
    return { mode: 'postgres', user };
  }
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service || !allowlist.length) throw Object.assign(new Error('CRM is not configured. Add DATABASE_URL (or the legacy Supabase variables) and the admin environment variables.'), { status: 503 });
  const token = bearer(req);
  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw Object.assign(new Error('Your session has expired. Sign in again.'), { status: 401 });
  const user = await response.json();
  if (!allowlist.includes(String(user.email || '').toLowerCase())) throw Object.assign(new Error('This account is not authorized to view the contract CRM.'), { status: 403 });
  return { mode: 'supabase', url: url.replace(/\/$/, ''), anon, service, user, legacyServiceKey: !process.env.SUPABASE_SECRET_KEY };
}

/** Email + password sign-in for the portal. Returns { token, email }. */
export async function signIn(email, password) {
  if (dbMode() === 'postgres') return portalLogin(email, password);
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw Object.assign(new Error('The admin portal is waiting for its database connection.'), { status: 503 });
  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: String(email || '').trim(), password: String(password || '') })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw Object.assign(new Error('Email or password was not accepted.'), { status: 401 });
  return { token: data.access_token, email: data.user?.email || String(email || '').trim() };
}

export function serviceHeaders(config) {
  return {
    apikey: config.service,
    ...(config.legacyServiceKey ? { Authorization: `Bearer ${config.service}` } : {})
  };
}

export async function dbRequest(config, path, options = {}) {
  if (config?.mode === 'postgres') return pgRequest(path, options);
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...serviceHeaders(config),
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Database request failed (${response.status}). ${raw.slice(0, 240)}`);
  return raw ? JSON.parse(raw) : null;
}

export async function saveSignedRecord(config, { reference, token, typedName, typedBusinessName, signedAt, pdf }) {
  const { createHash } = await import('node:crypto');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const matches = await dbRequest(config, `contracts?reference=eq.${encodeURIComponent(reference)}&contract_token_hash=eq.${tokenHash}&select=id,contract_token_hash,status,signing_expires_at,signed_at,agreement`);
  const record = matches?.[0];
  // Existing signing URLs predate the CRM. Only link a signature when the exact
  // agreement was saved by an authorized admin, so a modified URL cannot mark
  // someone else's record as signed.
  if (!record || record.contract_token_hash !== tokenHash) return false;
  if (record.signed_at || record.status === 'signed' || record.status === 'archived') throw Object.assign(new Error('This agreement has already been signed.'), { status: 409 });
  const expiresAt = Date.parse(record.signing_expires_at || '');
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw Object.assign(new Error('This signing link has expired. Please ask Arveno to send a new link.'), { status: 410 });
  let signedPdfPath = null;
  if (pdf) {
    signedPdfPath = `${record.id}/${reference}.pdf`;
    await putSignedPdf(config, signedPdfPath, pdf);
  }
  const signedRecordPath = `contracts?id=eq.${encodeURIComponent(record.id)}`;
  const signedFields = { status: 'signed', signed_by: String(typedName).slice(0, 120), signed_by_business: String(typedBusinessName || '').slice(0, 160), signed_at: signedAt, signed_pdf_path: signedPdfPath };
  try {
    await dbRequest(config, signedRecordPath, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...signedFields, onboarding_status: 'signed' })
    });
  } catch (error) {
    if (!/onboarding_status|PGRST204|42703|column .* does not exist/i.test(error.message || '')) throw error;
    await dbRequest(config, signedRecordPath, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(signedFields)
    });
  }
  return true;
}

export async function findContractBySigningToken(config, { reference, token }) {
  const { createHash } = await import('node:crypto');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const rows = await dbRequest(config, `contracts?reference=eq.${encodeURIComponent(reference)}&contract_token_hash=eq.${tokenHash}&select=*`);
  return rows?.[0] || null;
}

export async function putSignedPdf(config, path, pdf) {
  if (config?.mode === 'postgres') return putFile('signed-contracts', path, Buffer.from(pdf), 'application/pdf');
  const upload = await fetch(`${config.url}/storage/v1/object/signed-contracts/${path}`, {
    method: 'POST', headers: { ...serviceHeaders(config), 'Content-Type': 'application/pdf', 'x-upsert': 'true' }, body: pdf
  });
  if (!upload.ok) throw new Error(`Could not archive the signed PDF (${upload.status}).`);
}

/** Returns the archived signed PDF as a Buffer, or null when it can't be found. */
export async function getSignedPdf(config, path) {
  if (config?.mode === 'postgres') return (await getFile('signed-contracts', path))?.bytes || null;
  const file = await fetch(`${config.url}/storage/v1/object/signed-contracts/${path}`, { headers: serviceHeaders(config) });
  if (!file.ok) return null;
  return Buffer.from(await file.arrayBuffer());
}

export function handlerError(res, error) {
  return json(res, error.status || 500, { error: error.status ? error.message : 'The CRM request could not be completed.' });
}
