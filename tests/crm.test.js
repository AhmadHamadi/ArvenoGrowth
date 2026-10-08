import test from 'node:test';
import assert from 'node:assert/strict';
import adminHandler from '../api/admin.js';
import { encodeContract } from '../src/contract-model.js';
import { saveSignedRecord } from '../lib/crm.js';

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; }
  };
}

const savedEnv = { ...process.env };
const restoreEnv = () => {
  for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CONTRACT_ADMIN_EMAILS']) {
    if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
  }
};

test('CRM API fails closed when database and admin configuration are missing', async () => {
  restoreEnv();
  for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CONTRACT_ADMIN_EMAILS']) delete process.env[key];
  const res = response();
  await adminHandler({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /not configured/i);
});

test('CRM API requires a verified admin bearer token', async () => {
  Object.assign(process.env, {
    SUPABASE_URL: 'https://crm-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
    SUPABASE_SECRET_KEY: 'server-test-key', CONTRACT_ADMIN_EMAILS: 'owner@example.com'
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new URL(url).pathname.endsWith('/auth/v1/user')
    ? new Response(JSON.stringify({ email: 'other@example.com' }), { status: 200 })
    : new Response('[]', { status: 200 });
  try {
    const noToken = response();
    await adminHandler({ method: 'GET', headers: {} }, noToken);
    assert.equal(noToken.statusCode, 401);
    const notAllowed = response();
    await adminHandler({ method: 'GET', headers: { authorization: 'Bearer test-token' } }, notAllowed);
    assert.equal(notAllowed.statusCode, 403);
  } finally { globalThis.fetch = originalFetch; restoreEnv(); }
});

test('signed agreement is archived only when token hash matches the saved contract', async () => {
  const originalFetch = globalThis.fetch;
  const agreement = { clientBusiness: 'Test Plumbing', agreementDate: '2026-10-08', clientContact: 'Alex', clientEmail: 'alex@example.com' };
  const token = encodeContract(agreement);
  let uploaded = false;
  let patched = false;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/rest/v1/contracts?reference=')) {
      const hash = (await import('node:crypto')).createHash('sha256').update(token).digest('hex');
      return new Response(JSON.stringify([{ id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', contract_token_hash: hash, status: 'sent' }]), { status: 200 });
    }
    if (address.includes('/storage/v1/object/')) { uploaded = options.method === 'POST'; return new Response('{}', { status: 200 }); }
    if (address.includes('/rest/v1/contracts?id=')) { patched = options.method === 'PATCH'; return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    const mismatch = await saveSignedRecord({ url: 'https://crm-test.supabase.co', service: 'server-test-key' }, {
      reference: 'AG-TESTPL-261008', token: `${token}tampered`, typedName: 'Alex', signedAt: '2026-10-08T12:00:00Z', pdf: Buffer.from('%PDF')
    });
    assert.equal(mismatch, false);
    assert.equal(uploaded, false);
    const archived = await saveSignedRecord({ url: 'https://crm-test.supabase.co', service: 'server-test-key' }, {
      reference: 'AG-TESTPL-261008', token, typedName: 'Alex', signedAt: '2026-10-08T12:00:00Z', pdf: Buffer.from('%PDF')
    });
    assert.equal(archived, true);
    assert.equal(uploaded, true);
    assert.equal(patched, true);
  } finally { globalThis.fetch = originalFetch; }
});
