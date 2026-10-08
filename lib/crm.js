const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

export function json(res, status, body) {
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  return res.status(status).json(body);
}

export function serviceConfig() {
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return { url: url.replace(/\/$/, ''), service };
}

export async function requireAdmin(req) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const allowlist = (process.env.CONTRACT_ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!url || !anon || !service || !allowlist.length) throw Object.assign(new Error('CRM is not configured. Add the Supabase and admin environment variables.'), { status: 503 });
  const authorization = String(req.headers?.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || token.length > 8192) throw Object.assign(new Error('Sign in to continue.'), { status: 401 });
  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw Object.assign(new Error('Your session has expired. Sign in again.'), { status: 401 });
  const user = await response.json();
  if (!allowlist.includes(String(user.email || '').toLowerCase())) throw Object.assign(new Error('This account is not authorized to view the contract CRM.'), { status: 403 });
  return { url: url.replace(/\/$/, ''), anon, service, user };
}

export async function dbRequest(config, path, options = {}) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.service,
      Authorization: `Bearer ${config.service}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Database request failed (${response.status}). ${raw.slice(0, 240)}`);
  return raw ? JSON.parse(raw) : null;
}

export async function saveSignedRecord(config, { reference, token, typedName, signedAt, pdf }) {
  const { createHash } = await import('node:crypto');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const matches = await dbRequest(config, `contracts?reference=eq.${encodeURIComponent(reference)}&contract_token_hash=eq.${tokenHash}&select=id,contract_token_hash,status`);
  const record = matches?.[0];
  // Existing signing URLs predate the CRM. Only link a signature when the exact
  // agreement was saved by an authorized admin, so a modified URL cannot mark
  // someone else's record as signed.
  if (!record || record.contract_token_hash !== tokenHash) return false;
  let signedPdfPath = null;
  if (pdf) {
    signedPdfPath = `${record.id}/${reference}.pdf`;
    const upload = await fetch(`${config.url}/storage/v1/object/signed-contracts/${signedPdfPath}`, {
      method: 'POST', headers: { apikey: config.service, Authorization: `Bearer ${config.service}`, 'Content-Type': 'application/pdf', 'x-upsert': 'true' }, body: pdf
    });
    if (!upload.ok) throw new Error(`Could not archive the signed PDF (${upload.status}).`);
  }
  await dbRequest(config, `contracts?id=eq.${encodeURIComponent(record.id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'signed', signed_by: String(typedName).slice(0, 120), signed_at: signedAt, signed_pdf_path: signedPdfPath })
  });
  return true;
}

export function handlerError(res, error) {
  return json(res, error.status || 500, { error: error.status ? error.message : 'The CRM request could not be completed.' });
}
