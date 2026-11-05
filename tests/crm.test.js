import test from 'node:test';
import assert from 'node:assert/strict';
import adminHandler from '../api/admin.js';
import clientsHandler from '../api/admin/clients.js';
import leadsAdminHandler from '../api/admin/leads.js';
import billingHandler from '../api/admin/billing.js';
import leadHandler from '../api/lead.js';
import signHandler from '../api/sign.js';
import { buildClauses, encodeContract } from '../src/contract-model.js';
import { saveSignedRecord, serviceHeaders } from '../lib/crm.js';
import { createContractCheckout, createServiceSubscription, serviceCommitmentCycles, setupInstallments, stripeClient } from '../lib/stripe.js';
import stripeWebhookHandler, { processStripeEvent } from '../api/stripe/webhook.js';

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; }
  };
}

test('homepage audit can be submitted without a business-type field', async () => {
  const originalFetch = globalThis.fetch;
  const saved = { RESEND_API_KEY: process.env.RESEND_API_KEY, RESEND_FROM: process.env.RESEND_FROM, MAIL_TO: process.env.MAIL_TO };
  Object.assign(process.env, { RESEND_API_KEY: 'resend-test-key', RESEND_FROM: 'Arveno <hello@example.com>', MAIL_TO: 'owner@example.com' });
  const sentPayloads = [];
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    sentPayloads.push(payload);
    return new Response(JSON.stringify({ id: `test-email-${sentPayloads.length}` }), { status: 200 });
  };
  try {
    const res = response();
    await leadHandler({
      method: 'POST', headers: {}, body: {
        source: 'audit', name: 'Taylor Client', business: 'Taylor Services',
        email: 'taylor@example.com', phone: '2894891167', services: 'HVAC installation'
      }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.match(sentPayloads[0].subject, /^New lead from website/);
    assert.match(sentPayloads[0].html, /HVAC installation/);
    assert.match(sentPayloads[1].subject, /did not book an appointment/i);
    assert.match(sentPayloads[1].scheduled_at, /T/);
    assert.ok(res.body.bookingFollowupToken);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('homepage lead rejects missing business details before saving or emailing', async () => {
  const originalFetch = globalThis.fetch;
  const saved = Object.fromEntries(['RESEND_API_KEY', 'RESEND_FROM', 'MAIL_TO', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'].map(key => [key, process.env[key]]));
  Object.assign(process.env, { RESEND_API_KEY: 'resend-test-key', RESEND_FROM: 'Arveno <hello@example.com>', MAIL_TO: 'owner@example.com', SUPABASE_URL: 'https://crm-test.supabase.co', SUPABASE_SECRET_KEY: 'service-test-key' });
  const savedLead = [];
  globalThis.fetch = async (input, options = {}) => {
    if (String(input).includes('/rest/v1/crm_leads')) { savedLead.push(JSON.parse(options.body)); return new Response(null, { status: 201 }); }
    return new Response(JSON.stringify({ id: 'test-email-id' }), { status: 200 });
  };
  try {
    const res = response();
    await leadHandler({ method: 'POST', headers: {}, body: { source: 'audit', name: 'Taylor Morgan', email: 'taylor@example.com' } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /business name, phone number, and services are required/i);
    assert.equal(savedLead.length, 0);

    const validRes = response();
    await leadHandler({ method: 'POST', headers: {}, body: { source: 'audit', name: 'Taylor Morgan', email: 'taylor@example.com', business: 'Taylor Services', phone: '2894891167', services: 'HVAC installation' } }, validRes);
    assert.equal(validRes.statusCode, 200);
    assert.equal(validRes.body.crmSaved, true);
    assert.equal(savedLead.length, 1);
    assert.equal(savedLead[0].business, 'Taylor Services');
    assert.equal(savedLead[0].phone, '2894891167');
    assert.equal(savedLead[0].services, 'HVAC installation');
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

const savedEnv = { ...process.env };
const restoreEnv = () => {
  for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CONTRACT_ADMIN_EMAILS', 'RESEND_API_KEY', 'RESEND_FROM', 'MAIL_TO']) {
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

test('CRM can promote a website lead to qualified after creating a client record', async () => {
  Object.assign(process.env, {
    SUPABASE_URL: 'https://crm-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
    SUPABASE_SECRET_KEY: 'server-test-key', CONTRACT_ADMIN_EMAILS: 'owner@example.com'
  });
  const originalFetch = globalThis.fetch;
  const leadId = '0f557ead-f47e-41ae-b6cc-04c8bfcc4201';
  globalThis.fetch = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/auth/v1/user') return new Response(JSON.stringify({ email: 'owner@example.com' }), { status: 200 });
    if (pathname === '/rest/v1/crm_leads' && options.method === 'PATCH') {
      const patch = JSON.parse(options.body);
      return new Response(JSON.stringify([{ id: leadId, stage: patch.stage }]), { status: 200 });
    }
    throw new Error(`Unexpected CRM request: ${pathname}`);
  };
  try {
    const res = response();
    await leadsAdminHandler({ method: 'PATCH', headers: { authorization: 'Bearer valid-token' }, body: { id: leadId, stage: 'qualified' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.lead.id, leadId);
    assert.equal(res.body.lead.stage, 'qualified');
  } finally { globalThis.fetch = originalFetch; restoreEnv(); }
});

test('CRM client records require business and contact details and normalize email', async () => {
  Object.assign(process.env, {
    SUPABASE_URL: 'https://crm-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
    SUPABASE_SECRET_KEY: 'server-test-key', CONTRACT_ADMIN_EMAILS: 'owner@example.com'
  });
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/auth/v1/user') return new Response(JSON.stringify({ email: 'owner@example.com' }), { status: 200 });
    if (pathname === '/rest/v1/clients' && options.method === 'POST') {
      const body = JSON.parse(options.body); requests.push(body);
      return new Response(JSON.stringify([{ id: 'client-record', ...body }]), { status: 201 });
    }
    if (pathname === '/rest/v1/clients' && !options.method) return new Response('[]', { status: 200 });
    throw new Error(`Unexpected CRM request: ${pathname}`);
  };
  try {
    const missing = response();
    await clientsHandler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { firstName: 'Taylor', email: 'taylor@example.com' } }, missing);
    assert.equal(missing.statusCode, 400);
    assert.equal(requests.length, 0);

    const saved = response();
    await clientsHandler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { businessName: 'Taylor Services', firstName: 'Taylor', lastName: 'Morgan', email: 'TAYLOR@EXAMPLE.COM' } }, saved);
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.body.client.business_name, 'Taylor Services');
    assert.equal(requests[0].email, 'taylor@example.com');
  } finally { globalThis.fetch = originalFetch; restoreEnv(); }
});

test('signing API requires signer name, matching business name, and a real signing date', async () => {
  const missingName = response();
  await signHandler({ method: 'POST', headers: {}, body: { token: 'token', typedName: '', typedBusinessName: 'Example Co', signedAt: '2026-10-09', signature: 'data:image/png;base64,AA==' } }, missingName);
  assert.equal(missingName.statusCode, 400);
  assert.match(missingName.body.error, /full name/i);
  const invalidDate = response();
  await signHandler({ method: 'POST', headers: {}, body: { token: 'token', typedName: 'Taylor Morgan', typedBusinessName: 'Example Co', signedAt: '2026-02-31', signature: 'data:image/png;base64,AA==' } }, invalidDate);
  assert.equal(invalidDate.statusCode, 400);
  assert.match(invalidDate.body.error, /valid signing date/i);
  const mismatch = response();
  await signHandler({ method: 'POST', headers: {}, body: { token: encodeContract({ clientBusiness: 'Canonical HVAC' }), typedName: 'Taylor Morgan', typedBusinessName: 'Other HVAC', signedAt: '2026-10-09', signature: 'data:image/png;base64,AA==' } }, mismatch);
  assert.equal(mismatch.statusCode, 400);
  assert.match(mismatch.body.error, /business name exactly/i);
});

test('client CRM requires an authorized session and validates separate client identity fields', async () => {
  Object.assign(process.env, {
    SUPABASE_URL: 'https://crm-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
    SUPABASE_SECRET_KEY: 'server-test-key', CONTRACT_ADMIN_EMAILS: 'owner@example.com'
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new URL(url).pathname.endsWith('/auth/v1/user')
    ? new Response(JSON.stringify({ email: 'owner@example.com' }), { status: 200 })
    : new Response('[]', { status: 200 });
  try {
    const unauthenticated = response();
    await clientsHandler({ method: 'GET', headers: {} }, unauthenticated);
    assert.equal(unauthenticated.statusCode, 401);
    const invalid = response();
    await clientsHandler({ method: 'POST', headers: { authorization: 'Bearer admin-token' }, body: { businessName: 'Example Co', firstName: 'Ari', lastName: '', email: 'bad' } }, invalid);
    assert.equal(invalid.statusCode, 400);
    assert.match(invalid.body.error, /first and last name/i);
  } finally { globalThis.fetch = originalFetch; restoreEnv(); }
});

test('client CRM can edit a client and mark or restore former status without deleting history', async () => {
  Object.assign(process.env, {
    SUPABASE_URL: 'https://crm-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
    SUPABASE_SECRET_KEY: 'server-test-key', CONTRACT_ADMIN_EMAILS: 'owner@example.com'
  });
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ email: 'owner@example.com' }), { status: 200 });
    if (address.includes('/rest/v1/clients?id=')) {
      requests.push(JSON.parse(options.body));
      return new Response(JSON.stringify([{ id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', ...JSON.parse(options.body) }]), { status: 200 });
    }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    const edit = response();
    await clientsHandler({ method: 'PATCH', headers: { authorization: 'Bearer admin-token' }, body: {
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', businessName: 'New Business', firstName: 'Taylor', lastName: 'Morgan', email: 'taylor@example.com', phone: '2895550100'
    } }, edit);
    assert.equal(edit.statusCode, 200);
    assert.equal(edit.body.client.business_name, 'New Business');

    const former = response();
    await clientsHandler({ method: 'PATCH', headers: { authorization: 'Bearer admin-token' }, body: { id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', action: 'former' } }, former);
    assert.equal(former.statusCode, 200);
    assert.ok(former.body.client.former_at);

    const restored = response();
    await clientsHandler({ method: 'PATCH', headers: { authorization: 'Bearer admin-token' }, body: { id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', action: 'restore' } }, restored);
    assert.equal(restored.statusCode, 200);
    assert.equal(restored.body.client.former_at, null);
    assert.equal(requests.length, 3);
  } finally { globalThis.fetch = originalFetch; restoreEnv(); }
});

test('contract created from a CRM client preserves the client link and canonical identity snapshot', async () => {
  const originalResendKey = process.env.RESEND_API_KEY;
  const originalVercelEnv = process.env.VERCEL_ENV;
  process.env.RESEND_API_KEY = 'resend-test-key';
  process.env.VERCEL_ENV = 'production';
  Object.assign(process.env, {
    SUPABASE_URL: 'https://crm-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
    SUPABASE_SECRET_KEY: 'server-test-key', CONTRACT_ADMIN_EMAILS: 'owner@example.com'
  });
  const originalFetch = globalThis.fetch;
  let inserted;
  let invite;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address === 'https://api.resend.com/emails') { invite = JSON.parse(options.body); return new Response(JSON.stringify({ id: 'email-test' }), { status: 200 }); }
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ email: 'owner@example.com' }), { status: 200 });
    if (address.includes('/rest/v1/clients?')) return new Response(JSON.stringify([{
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', business_name: 'Canonical HVAC',
      first_name: 'Taylor', last_name: 'Morgan', email: 'taylor@example.com', phone: '2895550100'
    }]), { status: 200 });
    if (address.endsWith('/rest/v1/contracts?on_conflict=contract_token_hash')) {
      inserted = JSON.parse(options.body);
      return new Response(JSON.stringify([{ ...inserted, id: '1f557ead-f47e-41ae-b6cc-04c8bfcc4201' }]), { status: 201 });
    }
    if (address.includes('/rest/v1/contracts?id=eq.') && options.method === 'PATCH') {
      return new Response(JSON.stringify([{ ...inserted, id: '1f557ead-f47e-41ae-b6cc-04c8bfcc4201', ...JSON.parse(options.body) }]), { status: 200 });
    }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    const res = response();
    await adminHandler({ method: 'POST', headers: { authorization: 'Bearer admin-token' }, body: {
      clientId: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201',
      contract: { clientBusiness: 'Edited Business', clientContact: 'Edited Contact', clientEmail: 'edited@example.com', agreementDate: '2026-10-08', clientPhone: '', setupFee: 100, monthlyFee: 50 }
    } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(inserted.client_id, '0f557ead-f47e-41ae-b6cc-04c8bfcc4201');
    assert.equal(inserted.client_business, 'Canonical HVAC');
    assert.equal(inserted.client_contact, 'Taylor Morgan');
    assert.equal(inserted.client_email, 'taylor@example.com');
    assert.equal(inserted.client_phone, '2895550100');
    assert.equal(inserted.agreement.clientContact, 'Taylor Morgan');
    assert.equal(inserted.status, 'draft');
    assert.equal(inserted.onboarding_status, 'draft');
    assert.equal(inserted.agreement.signingNonce.length > 0, true);
    assert.equal(inserted.signing_url.includes('?a='), true);
    assert.equal(Date.parse(inserted.signing_expires_at) > Date.now(), true);
    assert.equal(res.body.contract.status, 'sent');
    assert.equal(res.body.emailSent, true);
    assert.equal(invite.to[0], 'taylor@example.com');
    assert.match(invite.subject, /Canonical HVAC/);
    assert.match(invite.html, /Review and sign the agreement/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalResendKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalResendKey;
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = originalVercelEnv;
    restoreEnv();
  }
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
      return new Response(JSON.stringify([{ id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', contract_token_hash: hash, status: 'sent', signing_expires_at: new Date(Date.now() + 60_000).toISOString() }]), { status: 200 });
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

test('expired and already signed agreements cannot accept another signature', async () => {
  const originalFetch = globalThis.fetch;
  const agreement = { clientBusiness: 'Expiry HVAC', agreementDate: '2026-10-08', clientContact: 'Alex', clientEmail: 'alex@example.com' };
  const token = encodeContract(agreement);
  let uploads = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/rest/v1/contracts?reference=')) return new Response(JSON.stringify([
      { id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', contract_token_hash: (await import('node:crypto')).createHash('sha256').update(token).digest('hex'), status: 'sent', signing_expires_at: new Date(Date.now() - 1000).toISOString() }
    ]), { status: 200 });
    if (String(url).includes('/storage/v1/object/')) uploads++;
    return new Response(null, { status: 204 });
  };
  try {
    await assert.rejects(saveSignedRecord({ url: 'https://crm-test.supabase.co', service: 'server-test-key' }, {
      reference: 'AG-EXPIRYHVAC-261008', token, typedName: 'Alex', signedAt: new Date().toISOString(), pdf: Buffer.from('%PDF')
    }), /expired/i);
    assert.equal(uploads, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('signing remains compatible while the additive billing migration is pending', async () => {
  const originalFetch = globalThis.fetch;
  const agreement = { clientBusiness: 'Migration Test Co', agreementDate: '2026-10-08', clientContact: 'Alex', clientEmail: 'alex@example.com' };
  const token = encodeContract(agreement);
  let signaturePatchAttempts = 0;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/rest/v1/contracts?reference=')) {
      const hash = (await import('node:crypto')).createHash('sha256').update(token).digest('hex');
      return new Response(JSON.stringify([{ id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', contract_token_hash: hash, status: 'sent', signing_expires_at: new Date(Date.now() + 60_000).toISOString() }]), { status: 200 });
    }
    if (address.includes('/rest/v1/contracts?id=') && options.method === 'PATCH') {
      signaturePatchAttempts += 1;
      const fields = JSON.parse(options.body);
      if (fields.onboarding_status) return new Response('{"message":"column onboarding_status does not exist"}', { status: 400 });
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    const result = await saveSignedRecord({ url: 'https://crm-test.supabase.co', service: 'server-test-key' }, {
      reference: 'AG-MIGRATION-261008', token, typedName: 'Alex', signedAt: '2026-10-08T12:00:00Z', pdf: null
    });
    assert.equal(result, true);
    assert.equal(signaturePatchAttempts, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('new Supabase secret keys are sent only as apikey credentials', () => {
  assert.deepEqual(serviceHeaders({ service: 'sb_secret_test', legacyServiceKey: false }), { apikey: 'sb_secret_test' });
  assert.deepEqual(serviceHeaders({ service: 'legacy-service-role-jwt', legacyServiceKey: true }), {
    apikey: 'legacy-service-role-jwt', Authorization: 'Bearer legacy-service-role-jwt'
  });
});

test('admin can download a signed PDF using the new Supabase secret-key header format', async () => {
  restoreEnv();
  Object.assign(process.env, {
    SUPABASE_URL: 'https://crm-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_test', CONTRACT_ADMIN_EMAILS: 'owner@example.com'
  });
  const originalFetch = globalThis.fetch;
  let storageHeaders;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ email: 'owner@example.com' }), { status: 200 });
    if (address.includes('/rest/v1/contracts?')) return new Response(JSON.stringify([{ signed_pdf_path: 'contract-id/agreement.pdf' }]), { status: 200 });
    if (address.includes('/storage/v1/object/')) {
      storageHeaders = options.headers;
      return new Response('%PDF-test', { status: 200, headers: { 'Content-Type': 'application/pdf' } });
    }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    const res = response();
    await adminHandler({ method: 'GET', query: { pdf: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201' }, headers: { authorization: 'Bearer admin-test-token' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'application/pdf');
    assert.deepEqual(storageHeaders, { apikey: 'sb_secret_test' });
  } finally { globalThis.fetch = originalFetch; restoreEnv(); }
});

test('restoring an archived signed contract preserves signed status and admin cannot forge a signature', async () => {
  restoreEnv();
  Object.assign(process.env, {
    SUPABASE_URL: 'https://crm-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_test', CONTRACT_ADMIN_EMAILS: 'owner@example.com'
  });
  const originalFetch = globalThis.fetch;
  let patchedStatus;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ email: 'owner@example.com' }), { status: 200 });
    if (address.includes('&select=id,signed_at')) return new Response(JSON.stringify([{ id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', signed_at: '2026-10-08T12:00:00Z' }]), { status: 200 });
    if (options.method === 'PATCH') {
      patchedStatus = JSON.parse(options.body).status;
      return new Response(JSON.stringify([{ id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', status: patchedStatus }]), { status: 200 });
    }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    const restore = response();
    await adminHandler({ method: 'PATCH', body: { id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', status: 'sent' }, headers: { authorization: 'Bearer admin-test-token' } }, restore);
    assert.equal(restore.statusCode, 200);
    assert.equal(patchedStatus, 'signed');

    const forged = response();
    await adminHandler({ method: 'PATCH', body: { id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', status: 'signed' }, headers: { authorization: 'Bearer admin-test-token' } }, forged);
    assert.equal(forged.statusCode, 400);
  } finally { globalThis.fetch = originalFetch; restoreEnv(); }
});

test('setup checkout splits exact cents across three monthly cycles', async () => {
  assert.deepEqual(setupInstallments(1000), { totalCents: 100000, installmentCents: 33333, firstAdjustmentCents: 1 });
  let params;
  const stripe = { checkout: { sessions: { create: async (data) => { params = data; return { id: 'cs_test_setup', url: 'https://checkout.stripe.test/setup', status: 'open' }; } } } };
  const result = await createContractCheckout(stripe, {
    contract: { id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', reference: 'AG-TEST-1', client_business: 'Test Services', client_email: 'owner@example.com', currency: 'USD', setup_fee: 1000 },
    action: 'setup', setupMode: 'three_monthly', origin: 'https://www.arvenogrowth.com'
  });
  assert.equal(result.session.id, 'cs_test_setup');
  assert.equal(params.mode, 'subscription');
  assert.equal(params.line_items[0].price_data.unit_amount, 33333);
  assert.equal(params.line_items[0].price_data.recurring.interval, 'month');
  assert.equal(params.line_items[1].price_data.unit_amount, 1);
  assert.equal(params.subscription_data.metadata.billing_role, 'setup_installment');
  assert.equal(params.subscription_data.metadata.installment_count, '3');
  assert.equal(params.subscription_data.payment_settings.save_default_payment_method, 'on_subscription');
});

test('full setup checkout charges now and saves the method for automatic service billing', async () => {
  let params;
  const stripe = { checkout: { sessions: { create: async (data) => { params = data; return { id: 'cs_test_full', url: 'https://checkout.stripe.test/full', status: 'open' }; } } } };
  await createContractCheckout(stripe, {
    contract: { id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', reference: 'AG-TEST-1', client_business: 'Test Services', client_email: 'owner@example.com', currency: 'USD', setup_fee: 1000 },
    action: 'setup', setupMode: 'full', origin: 'https://preview.example.test'
  });
  assert.equal(params.mode, 'payment');
  assert.equal(params.line_items[0].price_data.unit_amount, 100000);
  assert.equal(params.customer_creation, 'always');
  assert.equal(params.payment_intent_data.setup_future_usage, 'off_session');
  assert.equal(params.automatic_tax, undefined, 'Stripe Tax must remain disabled');
});

test('zero setup Checkout saves a card without charging and names the future monthly fee', async () => {
  let params;
  const stripe = { checkout: { sessions: { create: async (data) => { params = data; return { id: 'cs_test_card', url: 'https://checkout.stripe.test/card', status: 'open' }; } } } };
  await createContractCheckout(stripe, {
    contract: { id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', reference: 'AG-TEST-1', client_business: 'Test Services', client_email: 'owner@example.com', stripe_customer_id: 'cus_test', currency: 'CAD', setup_fee: 0, monthly_fee: 400 },
    action: 'setup', setupMode: 'card_only', origin: 'https://preview.example.test'
  });
  assert.equal(params.mode, 'setup');
  assert.equal(params.customer, 'cus_test');
  assert.equal(params.setup_intent_data.usage, 'off_session');
  assert.match(params.custom_text.submit.message, /CAD 400\.00 per month starting when setup is complete/);
});

test('monthly service subscription starts from the saved method after setup completes', async () => {
  let params;
  const stripe = { subscriptions: { create: async (data, options) => { params = { data, options }; return { id: 'sub_test_service', status: 'active' }; } } };
  const contract = {
    id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', reference: 'AG-TEST-1', client_business: 'Test Services',
    currency: 'CAD', setup_fee: 1000, monthly_fee: 400, setup_payment_status: 'partial', setup_installments_paid: 1,
    setup_completed_at: '2026-10-23T12:00:00.000Z', stripe_customer_id: 'cus_test', stripe_payment_method_id: 'pm_test', agreement: { contractVersion: 4, term: '3 months' }
  };
  await createServiceSubscription(stripe, contract);
  assert.equal(params.data.customer, 'cus_test');
  assert.equal(params.data.default_payment_method, 'pm_test');
  assert.equal(params.data.items[0].price_data.unit_amount, 40000);
  assert.equal(params.data.items[0].price_data.recurring.interval, 'month');
  assert.equal(params.data.metadata.billing_role, 'service_monthly');
  assert.equal(params.data.metadata.commitment_months, '3');
  await assert.rejects(() => createServiceSubscription(stripe, { ...contract, setup_payment_status: 'pending', setup_installments_paid: 0 }), /first agreed setup payment/);
});

test('new contract monthly service starts 14 days after first setup payment and does not enable Stripe Tax', async () => {
  let params;
  const stripe = { subscriptions: { create: async (data, options) => { params = { data, options }; return { id: 'sub_test_trial', status: 'trialing' }; } } };
  const completedAt = '2026-11-01T12:00:00.000Z';
  const contract = {
    id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', reference: 'AG-TEST-7', client_business: 'Test Services',
    currency: 'USD', monthly_fee: 297, setup_fee: 1000, setup_payment_status: 'paid', setup_installments_paid: 0,
    setup_completed_at: completedAt, stripe_customer_id: 'cus_test', stripe_payment_method_id: 'pm_test',
    agreement: { contractVersion: 7, term: '12 months' }
  };
  const firstSetupPaymentAt = '2026-11-01T15:30:00.000Z';
  await createServiceSubscription(stripe, contract, { trialStartAt: firstSetupPaymentAt });
  assert.equal(params.data.trial_end, Date.parse(firstSetupPaymentAt) / 1000 + 14 * 24 * 60 * 60);
  assert.equal(params.data.collection_method, 'charge_automatically');
  assert.equal(params.data.metadata.commitment_months, '12');
  assert.equal(params.data.automatic_tax, undefined);
});

test('delayed setup webhook starts billing immediately once the 14-day date has passed', async () => {
  let params;
  const stripe = { subscriptions: { create: async (data) => { params = data; return { id: 'sub_delayed', status: 'incomplete' }; } } };
  const contract = {
    id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', reference: 'AG-DELAYED-7', client_business: 'Test Services',
    currency: 'USD', monthly_fee: 297, setup_fee: 1000, setup_payment_status: 'paid',
    stripe_customer_id: 'cus_delayed', stripe_payment_method_id: 'pm_delayed',
    agreement: { contractVersion: 7, term: '3 months' }
  };
  await createServiceSubscription(stripe, contract, { trialStartAt: '2026-09-01T12:00:00.000Z' });
  assert.equal(params.collection_method, 'charge_automatically');
  assert.equal(params.trial_end, undefined, 'a past trial end should not prevent Stripe from creating the subscription');
});

test('first setup payment starts Stripe trial and creates a setup deadline review task', async () => {
  const originalFetch = globalThis.fetch;
  const paidAt = '2026-11-01T15:30:00.000Z';
  let subscriptionData;
  let contractFields = [];
  let task;
  const stripe = { subscriptions: { create: async (data) => {
    subscriptionData = data;
    return { id: 'sub_v7_trial', status: 'trialing', trial_end: Date.parse(paidAt) / 1000 + 14 * 86400 };
  } } };
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/rest/v1/contracts?id=') && !options.method) return new Response(JSON.stringify([{
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', client_id: 'client-v7', reference: 'AG-TEST-7',
      client_business: 'Test Services', client_contact: 'Alex', client_email: 'alex@example.com', currency: 'USD',
      setup_fee: 1000, monthly_fee: 297, status: 'signed', agreement: { contractVersion: 7, term: '12 months' },
      setup_payment_status: 'pending', setup_installments_paid: 0, setup_completed_at: null,
      stripe_customer_id: null, stripe_payment_method_id: null, stripe_subscription_id: null,
      stripe_subscription_status: null, stripe_subscription_end_at: null, onboarding_status: 'contract_signed'
    }]), { status: 200 });
    if (address.includes('/rest/v1/crm_payments?on_conflict=')) return new Response(JSON.stringify([{ id: 'payment-v7' }]), { status: 201 });
    if (address.includes('/rest/v1/crm_payments?contract_id=')) return new Response(JSON.stringify([{
      amount_paid: 1000, billing_kind: 'setup_full', stripe_invoice_id: null, paid_at: paidAt
    }]), { status: 200 });
    if (address.includes('/rest/v1/crm_tasks?title=')) return new Response('[]', { status: 200 });
    if (address.endsWith('/rest/v1/crm_tasks') && options.method === 'POST') { task = JSON.parse(options.body); return new Response(null, { status: 201 }); }
    if (options.method === 'PATCH' && address.includes('/rest/v1/contracts?id=')) { contractFields.push(JSON.parse(options.body)); return new Response(null, { status: 204 }); }
    if (options.method === 'PATCH' && address.includes('/rest/v1/clients?id=')) return new Response(null, { status: 204 });
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent(stripe, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'payment_intent.succeeded', created: Date.parse(paidAt) / 1000, data: { object: {
        id: 'pi_v7_setup', amount: 100000, amount_received: 100000, currency: 'usd', created: Date.parse(paidAt) / 1000 - 86400,
        customer: 'cus_v7', payment_method: 'pm_v7', metadata: { contract_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', billing_role: 'setup_full' }
      } }
    });
    assert.equal(subscriptionData.trial_end, Date.parse(paidAt) / 1000 + 14 * 86400);
    assert.equal(subscriptionData.metadata.commitment_months, '12');
    assert.equal(contractFields[1].stripe_subscription_id, 'sub_v7_trial');
    assert.equal(contractFields[1].stripe_subscription_status, 'trialing');
    assert.equal(task.priority, 'high');
    assert.equal(task.due_at, '2026-11-15');
    assert.match(task.details, /billing remains scheduled automatically/);
  } finally { globalThis.fetch = originalFetch; }
});

test('zero-dollar trial invoice does not count as a contracted monthly payment', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify([{
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', client_id: null, reference: 'AG-TRIAL-7',
      client_business: 'Test Services', client_contact: 'Alex', client_email: 'alex@example.com', currency: 'USD',
      setup_fee: 1000, monthly_fee: 297, status: 'signed', agreement: { contractVersion: 7, term: '3 months' },
      setup_payment_status: 'paid', setup_installments_paid: 0, setup_started_at: '2026-10-01T12:00:00.000Z',
      setup_due_at: '2026-10-15T12:00:00.000Z', setup_completed_at: null, stripe_customer_id: 'cus_trial',
      stripe_payment_method_id: 'pm_trial', stripe_subscription_id: 'sub_trial', stripe_subscription_status: 'trialing',
      stripe_subscription_end_at: null, stripe_latest_invoice_id: null, onboarding_status: 'onboarding'
    }]), { status: 200 });
  };
  try {
    await processStripeEvent({ subscriptions: { retrieve: async () => ({
      id: 'sub_trial', customer: 'cus_trial', metadata: { contract_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', billing_role: 'service_monthly', commitment_months: '3' }
    }) } }, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'invoice.paid', data: { object: {
        id: 'in_trial_zero', subscription: 'sub_trial', amount_paid: 0, amount_due: 0, currency: 'usd', billing_reason: 'subscription_create'
      } }
    });
    assert.equal(requests.length, 1, 'the contract is read, but no payment or contract write is made');
    assert.match(requests[0].url, /contracts\?id=/);
  } finally { globalThis.fetch = originalFetch; }
});

test('zero-fee contract starts its 14-day billing trial after Stripe saves the card', async () => {
  const originalFetch = globalThis.fetch;
  const savedAt = '2026-11-01T16:00:00.000Z';
  let subscriptionData;
  let contractFields;
  const stripe = {
    setupIntents: { retrieve: async () => ({ id: 'seti_v7', status: 'succeeded', payment_method: 'pm_v7', created: Date.parse(savedAt) / 1000 - 3600 }) },
    subscriptions: { create: async (data) => { subscriptionData = data; return { id: 'sub_v7_card', status: 'trialing' }; } }
  };
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/rest/v1/contracts?id=') && !options.method) return new Response(JSON.stringify([{
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', client_id: null, reference: 'AG-CARD-7', client_business: 'Test Services',
      client_contact: 'Alex', client_email: 'alex@example.com', currency: 'USD', setup_fee: 0, monthly_fee: 297,
      status: 'signed', agreement: { contractVersion: 7, term: '12 months' }, setup_payment_status: 'not_required',
      setup_installments_paid: 0, setup_completed_at: null, stripe_customer_id: null, stripe_payment_method_id: null,
      stripe_subscription_id: null, stripe_subscription_status: null, stripe_subscription_end_at: null, onboarding_status: 'contract_signed'
    }]), { status: 200 });
    if (address.includes('/rest/v1/contracts?id=') && options.method === 'PATCH') { contractFields = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    if (address.includes('/rest/v1/crm_tasks?title=')) return new Response('[]', { status: 200 });
    if (address.endsWith('/rest/v1/crm_tasks') && options.method === 'POST') return new Response(null, { status: 201 });
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent(stripe, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'checkout.session.completed', created: Date.parse(savedAt) / 1000, data: { object: {
        id: 'cs_card_v7', mode: 'setup', status: 'complete', customer: 'cus_v7', setup_intent: 'seti_v7',
        metadata: { contract_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201' }
      } }
    });
    assert.equal(subscriptionData.trial_end, Date.parse(savedAt) / 1000 + 14 * 86400);
    assert.equal(contractFields.stripe_payment_method_id, 'pm_v7');
    assert.equal(contractFields.stripe_subscription_status, 'trialing');
  } finally { globalThis.fetch = originalFetch; }
});

test('service payment count follows signed contract commitment and month-to-month remains ongoing', () => {
  assert.equal(serviceCommitmentCycles({ agreement: { contractVersion: 4, term: '3 months' } }), 3);
  assert.equal(serviceCommitmentCycles({ agreement: { contractVersion: 4, term: '6 months' } }), 6);
  assert.equal(serviceCommitmentCycles({ agreement: { contractVersion: 4, term: '12 months' } }), 12);
  assert.equal(serviceCommitmentCycles({ agreement: { contractVersion: 4, term: 'Month-to-month' } }), null);
  assert.equal(serviceCommitmentCycles({ agreement: { contractVersion: 3, term: '12 months' } }), null);
  assert.throws(() => serviceCommitmentCycles({ agreement: { contractVersion: 4, term: 'To be agreed in writing' } }), /Choose the signed monthly commitment/);
});

test('new fixed-term contract tells both parties when Stripe billing stops and requires a signed renewal', () => {
  const clauses = buildClauses({
    contractVersion: 4, clientBusiness: 'Test Services', clientContact: 'Alex', clientEmail: 'alex@example.com',
    agreementDate: '2026-10-09', setupStart: '2026-10-09', setupFee: '1000', monthlyFee: '797',
    currency: 'USD', setupPayment: 'threeMonthly', term: '6 months', services: ['ads'], customServices: [],
    packageName: 'Lead Engine', minAdSpend: 500, adSpendCurrency: 'USD', guarantee: 'none'
  });
  const fees = clauses.find((clause) => clause.title === 'Fees, Setup, and Term');
  const text = fees.paras.join(' ');
  assert.match(text, /Monthly billing stops after the final monthly payment in this committed term/);
  assert.match(text, /Renewal requires a new written agreement/);
  assert.match(text, /setup fee is waived or refunded/);
});

test('version 7 agreement states the 14-day billing start and setup deadline', () => {
  const clauses = buildClauses({
    contractVersion: 7, clientBusiness: 'Test Services', clientContact: 'Alex', clientEmail: 'alex@example.com',
    agreementDate: '2026-11-01', setupStart: '2026-11-01', setupFee: '1000', monthlyFee: '297',
    currency: 'USD', setupPayment: 'full', term: '3 months', services: ['ads'], customServices: [],
    packageName: 'Lead Engine', minAdSpend: 500, adSpendCurrency: 'USD', guarantee: 'none'
  });
  const fees = clauses.find((clause) => clause.title === 'Fees, Setup, and Term').paras.join(' ');
  assert.match(fees, /starting 14 calendar days after first successful setup payment/);
  assert.match(fees, /Setup will be completed within 14 calendar days/);
  assert.match(fees, /this review does not delay the separately authorized monthly billing schedule/);
});

test('Stripe stops a three-installment setup subscription after its third successful invoice', async () => {
  const originalFetch = globalThis.fetch;
  let canceledAtPeriodEnd = false;
  let invoiceFields;
  const stripe = {
    subscriptions: {
      retrieve: async (id) => ({ id, status: 'active', customer: 'cus_test', cancel_at_period_end: false, metadata: { contract_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', billing_role: 'setup_installment' } }),
      update: async (_id, values) => { canceledAtPeriodEnd = values.cancel_at_period_end === true; }
    }
  };
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/crm_payments?on_conflict=')) return new Response(JSON.stringify([{ id: 'payment-id' }]), { status: 201 });
    if (address.includes('/crm_payments?contract_id=')) return new Response(JSON.stringify([
      { amount_paid: 333.33, billing_kind: 'setup_installment', stripe_invoice_id: 'in_1' },
      { amount_paid: 333.33, billing_kind: 'setup_installment', stripe_invoice_id: 'in_2' },
      { amount_paid: 333.34, billing_kind: 'setup_installment', stripe_invoice_id: 'in_3' }
    ]), { status: 200 });
    if (address.includes('/rest/v1/contracts?id=') && !options.method) return new Response(JSON.stringify([{
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', reference: 'AG-TEST-1', client_business: 'Test Services', client_contact: 'Alex', client_email: 'alex@example.com', currency: 'USD', setup_fee: 1000, monthly_fee: 997, status: 'signed', setup_payment_status: 'partial', setup_installments_paid: 2, setup_completed_at: null, stripe_customer_id: null, stripe_subscription_id: null, stripe_subscription_status: 'active', onboarding_status: 'onboarding'
    }]), { status: 200 });
    if (address.includes('/rest/v1/contracts?id=') && options.method === 'PATCH') { invoiceFields = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent(stripe, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'invoice.paid', data: { object: { id: 'in_3', subscription: 'sub_setup', amount_paid: 33334, currency: 'usd', payment_intent: 'pi_3', created: 1791489600 } }
    });
    assert.equal(canceledAtPeriodEnd, true);
    assert.equal(invoiceFields.stripe_setup_subscription_id, 'sub_setup');
    assert.equal(invoiceFields.stripe_setup_subscription_status, 'active');
    assert.equal(invoiceFields.stripe_subscription_id, undefined);
  } finally { globalThis.fetch = originalFetch; }
});

test('Stripe stops service billing at the end of the committed third paid month', async () => {
  const originalFetch = globalThis.fetch;
  let cancellationRequest;
  let updatedFields;
  const stripe = {
    subscriptions: {
      retrieve: async (id) => ({
        id, status: 'active', customer: 'cus_test', default_payment_method: 'pm_test',
        current_period_end: 1800000000, cancel_at_period_end: false,
        metadata: { contract_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', billing_role: 'service_monthly', commitment_months: '3' }
      }),
      update: async (id, values) => { cancellationRequest = { id, values }; return { id, status: 'active', current_period_end: 1800000000, cancel_at: 1800000000 }; }
    }
  };
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/crm_payments?on_conflict=')) return new Response(JSON.stringify([{ id: 'payment-3' }]), { status: 201 });
    if (address.includes('/crm_payments?contract_id=')) return new Response(JSON.stringify([
      { amount_paid: 997, billing_kind: 'service_monthly', stripe_invoice_id: 'in_service_1' },
      { amount_paid: 997, billing_kind: 'service_monthly', stripe_invoice_id: 'in_service_2' },
      { amount_paid: 997, billing_kind: 'service_monthly', stripe_invoice_id: 'in_service_3' }
    ]), { status: 200 });
    if (address.includes('/rest/v1/contracts?id=') && !options.method) return new Response(JSON.stringify([{
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', client_id: null, reference: 'AG-TEST-1',
      client_business: 'Test Services', client_contact: 'Alex', client_email: 'alex@example.com', currency: 'USD',
      setup_fee: 1000, monthly_fee: 997, status: 'signed', setup_payment_status: 'paid', setup_installments_paid: 0,
      setup_completed_at: '2026-10-08T12:00:00.000Z', stripe_customer_id: 'cus_test', stripe_payment_method_id: 'pm_test',
      stripe_subscription_id: 'sub_service', stripe_subscription_status: 'active', stripe_subscription_end_at: null,
      onboarding_status: 'active'
    }]), { status: 200 });
    if (options.method === 'PATCH' && address.includes('/rest/v1/contracts?id=')) { updatedFields = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent(stripe, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'invoice.paid', data: { object: { id: 'in_service_3', subscription: 'sub_service', amount_paid: 99700, currency: 'usd', payment_intent: 'pi_service_3', created: 1791489600 } }
    });
    assert.deepEqual(cancellationRequest, { id: 'sub_service', values: { cancel_at_period_end: true } });
    assert.equal(updatedFields.stripe_subscription_status, 'active');
    assert.equal(updatedFields.stripe_subscription_end_at, new Date(1800000000 * 1000).toISOString());
  } finally { globalThis.fetch = originalFetch; }
});

test('a canceled setup installment subscription cannot overwrite an active service subscription', async () => {
  const originalFetch = globalThis.fetch;
  let updatedFields;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/rest/v1/contracts?id=') && !options.method) return new Response(JSON.stringify([{
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', client_id: null, reference: 'AG-TEST-1',
      client_business: 'Test Services', client_contact: 'Alex', client_email: 'alex@example.com', currency: 'CAD',
      setup_fee: 1000, monthly_fee: 997, status: 'signed', setup_payment_status: 'paid', setup_installments_paid: 3,
      setup_completed_at: '2026-10-08T12:00:00.000Z', stripe_customer_id: 'cus_test',
      stripe_subscription_id: 'sub_monthly', stripe_subscription_status: 'active', onboarding_status: 'active'
    }]), { status: 200 });
    if (options.method === 'PATCH' && address.includes('/rest/v1/contracts?id=')) { updatedFields = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent({}, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'customer.subscription.deleted', data: { object: {
        id: 'sub_setup', customer: 'cus_test', status: 'canceled',
        metadata: { contract_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', billing_role: 'setup_installment' }
      } }
    });
    assert.deepEqual(updatedFields, {
      stripe_setup_subscription_id: 'sub_setup', stripe_setup_subscription_status: 'canceled'
    });
  } finally { globalThis.fetch = originalFetch; }
});

test('a later setup installment never restarts a canceled monthly service subscription', async () => {
  const originalFetch = globalThis.fetch;
  let createdServiceSubscriptions = 0;
  let contractPatch;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/rest/v1/contracts?id=') && !options.method) return new Response(JSON.stringify([{
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', client_id: null, reference: 'AG-CANCEL-7', client_business: 'Test Services',
      client_contact: 'Alex', client_email: 'alex@example.com', currency: 'USD', setup_fee: 900, monthly_fee: 297,
      status: 'signed', agreement: { contractVersion: 7, term: '3 months' }, setup_payment_status: 'partial',
      setup_installments_paid: 1, stripe_customer_id: 'cus_test', stripe_payment_method_id: 'pm_test',
      stripe_setup_subscription_id: 'sub_setup', stripe_subscription_id: 'sub_service_canceled',
      stripe_subscription_status: 'canceled', stripe_subscription_end_at: '2026-10-10T12:00:00.000Z',
      onboarding_status: 'inactive'
    }]), { status: 200 });
    if (address.includes('/rest/v1/crm_payments?on_conflict=')) return new Response(JSON.stringify([{ id: 'payment-installment-2' }]), { status: 201 });
    if (address.includes('/rest/v1/crm_payments?contract_id=')) return new Response(JSON.stringify([
      { amount_paid: 300, billing_kind: 'setup_installment', stripe_invoice_id: 'in_setup_1', paid_at: '2026-10-01T12:00:00.000Z' },
      { amount_paid: 300, billing_kind: 'setup_installment', stripe_invoice_id: 'in_setup_2', paid_at: '2026-10-15T12:00:00.000Z' }
    ]), { status: 200 });
    if (address.includes('/rest/v1/contracts?id=') && options.method === 'PATCH') { contractPatch = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent({
      subscriptions: {
        retrieve: async () => ({ id: 'sub_setup', status: 'active', customer: 'cus_test', default_payment_method: 'pm_test', metadata: { contract_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', billing_role: 'setup_installment' } }),
        create: async () => { createdServiceSubscriptions++; throw new Error('Canceled service must not restart.'); }
      }
    }, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'invoice.paid', data: { object: { id: 'in_setup_2', subscription: 'sub_setup', amount_paid: 30000, currency: 'usd', payment_intent: 'pi_setup_2', created: 1792080000 } }
    });
    assert.equal(createdServiceSubscriptions, 0);
    assert.equal(contractPatch.stripe_subscription_id, undefined);
    assert.equal(contractPatch.onboarding_status, 'inactive');
  } finally { globalThis.fetch = originalFetch; }
});

test('failed recurring invoice is visible to Admin so billing can recover without Resend', async () => {
  const originalFetch = globalThis.fetch;
  let updatedFields;
  const stripe = { subscriptions: { retrieve: async () => ({
    id: 'sub_monthly', customer: 'cus_test', status: 'past_due',
    metadata: { contract_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', billing_role: 'service_monthly' }
  }) } };
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/rest/v1/contracts?id=') && !options.method) return new Response(JSON.stringify([{
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', client_id: null, reference: 'AG-TEST-1',
      client_business: 'Test Services', client_contact: 'Alex', client_email: 'alex@example.com', currency: 'CAD',
      setup_fee: 1000, monthly_fee: 997, status: 'signed', setup_payment_status: 'paid',
      stripe_customer_id: 'cus_test', stripe_subscription_id: 'sub_monthly', stripe_subscription_status: 'active',
      stripe_latest_invoice_id: null, onboarding_status: 'active'
    }]), { status: 200 });
    if (options.method === 'PATCH' && address.includes('/rest/v1/contracts?id=')) { updatedFields = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent(stripe, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'invoice.payment_failed', data: { object: {
        id: 'in_failed', subscription: 'sub_monthly', amount_due: 99700, currency: 'cad',
        hosted_invoice_url: 'https://invoice.stripe.test/retry', created: 1791489600
      } }
    });
    assert.equal(updatedFields.stripe_latest_invoice_id, 'in_failed');
    assert.equal(updatedFields.stripe_latest_invoice_url, 'https://invoice.stripe.test/retry');
    assert.equal(updatedFields.stripe_subscription_status, 'past_due');
    assert.equal(updatedFields.onboarding_status, 'payment_issue');
  } finally { globalThis.fetch = originalFetch; }
});

test('recurring invoice authentication requirement is flagged and emailed with its secure invoice link', async () => {
  const originalFetch = globalThis.fetch;
  const saved = { RESEND_API_KEY: process.env.RESEND_API_KEY, RESEND_FROM: process.env.RESEND_FROM, MAIL_TO: process.env.MAIL_TO };
  Object.assign(process.env, { RESEND_API_KEY: 'resend-test-key', RESEND_FROM: 'Arveno <hello@example.com>', MAIL_TO: 'owner@example.com' });
  let updatedFields;
  let emailPayload;
  const stripe = { subscriptions: { retrieve: async () => ({
    id: 'sub_monthly', customer: 'cus_test', status: 'incomplete',
    metadata: { contract_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', billing_role: 'service_monthly' }
  }) } };
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/rest/v1/contracts?id=') && !options.method) return new Response(JSON.stringify([{
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', client_id: null, reference: 'AG-TEST-AUTH',
      client_business: 'Test Services', client_contact: 'Alex', client_email: 'alex@example.com', currency: 'USD',
      setup_fee: 1000, monthly_fee: 997, status: 'signed', setup_payment_status: 'paid', stripe_customer_id: 'cus_test',
      stripe_subscription_id: 'sub_monthly', stripe_subscription_status: 'active', stripe_latest_invoice_id: null, onboarding_status: 'active'
    }]), { status: 200 });
    if (options.method === 'PATCH' && address.includes('/rest/v1/contracts?id=')) { updatedFields = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    if (address === 'https://api.resend.com/emails') { emailPayload = JSON.parse(options.body); return new Response(JSON.stringify({ id: 'email-test' }), { status: 200 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent(stripe, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'invoice.payment_action_required', data: { object: {
        id: 'in_auth_required', subscription: 'sub_monthly', amount_due: 99700, currency: 'usd',
        hosted_invoice_url: 'https://invoice.stripe.test/authenticate', created: 1791489600
      } }
    });
    assert.equal(updatedFields.stripe_subscription_status, 'incomplete');
    assert.equal(updatedFields.onboarding_status, 'payment_issue');
    assert.equal(updatedFields.stripe_latest_invoice_url, 'https://invoice.stripe.test/authenticate');
    assert.match(emailPayload.subject, /Action required/);
    assert.match(emailPayload.text, /authenticate this payment/i);
    assert.match(emailPayload.html, /https:\/\/invoice\.stripe\.test\/authenticate/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('Stripe charge success attaches its hosted receipt to the recorded client payment', async () => {
  const originalFetch = globalThis.fetch;
  let patched;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/rest/v1/crm_payments?stripe_payment_intent_id=') && !options.method) {
      return new Response(JSON.stringify([{ id: 'pay_test' }]), { status: 200 });
    }
    if (address.includes('/rest/v1/crm_payments?stripe_payment_intent_id=') && options.method === 'PATCH') {
      patched = JSON.parse(options.body); return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent({}, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'charge.succeeded', data: { object: {
        id: 'ch_test', payment_intent: 'pi_test', receipt_url: 'https://pay.stripe.com/receipts/test'
      } }
    });
    assert.deepEqual(patched, { receipt_url: 'https://pay.stripe.com/receipts/test' });
  } finally { globalThis.fetch = originalFetch; }
});

test('Stripe subscription updates keep its current monthly amount beside the signed amount', async () => {
  const originalFetch = globalThis.fetch;
  let updated;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/rest/v1/contracts?id=') && !options.method) return new Response(JSON.stringify([{
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', client_id: null, reference: 'AG-TEST-1',
      client_business: 'Test Services', client_contact: 'Alex', client_email: 'alex@example.com', currency: 'USD',
      setup_fee: 500, monthly_fee: 400, status: 'signed', agreement: { contractVersion: 7, term: '3 months' },
      stripe_customer_id: 'cus_test', stripe_subscription_id: 'sub_test', stripe_subscription_status: 'active',
      stripe_latest_invoice_id: null, onboarding_status: 'active'
    }]), { status: 200 });
    if (options.method === 'PATCH' && address.includes('/rest/v1/contracts?id=')) { updated = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent({}, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'customer.subscription.updated', data: { object: {
        id: 'sub_test', customer: 'cus_test', status: 'active', metadata: {
          contract_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', billing_role: 'service_monthly'
        }, items: { data: [{ quantity: 2, price: { unit_amount: 50000, recurring: { interval: 'month' } } }] }
      } }
    });
    assert.equal(updated.stripe_current_monthly_fee, 1000);
  } finally { globalThis.fetch = originalFetch; }
});

test('CRM billing history returns receipt links for the client payment ledger', async () => {
  restoreEnv();
  Object.assign(process.env, {
    SUPABASE_URL: 'https://crm-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
    SUPABASE_SECRET_KEY: 'server-test-key', CONTRACT_ADMIN_EMAILS: 'owner@example.com'
  });
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    const address = String(url);
    if (new URL(url).pathname.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ email: 'owner@example.com' }), { status: 200 });
    requestedUrl = address;
    return new Response(JSON.stringify([{ id: 'pay_test', contract_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', receipt_url: 'https://pay.stripe.com/receipts/test' }]), { status: 200 });
  };
  try {
    const res = response();
    await billingHandler({ method: 'GET', headers: { authorization: 'Bearer admin-test-token' }, query: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.match(requestedUrl, /receipt_url/);
    assert.equal(res.body.payments[0].receipt_url, 'https://pay.stripe.com/receipts/test');
  } finally { globalThis.fetch = originalFetch; restoreEnv(); }
});

test('reservation deposit success is recorded against the CRM client from verified Stripe metadata', async () => {
  const originalFetch = globalThis.fetch;
  const writes = [];
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/crm_reservation_deposits?id=') && options.method === 'PATCH') { writes.push(JSON.parse(options.body)); return new Response(null, { status: 204 }); }
    if (address.includes('/crm_reservation_deposits?id=')) return new Response(JSON.stringify([{ id: 'e2b641a2-7c95-498e-a6c7-63b9e9e8b230', amount: 250, currency: 'USD', status: 'checkout_pending' }]), { status: 200 });
    if (address.includes('/clients?id=') && options.method === 'PATCH') { writes.push(JSON.parse(options.body)); return new Response(null, { status: 204 }); }
    if (address.includes('/contracts?client_id=') && options.method === 'PATCH') { writes.push(JSON.parse(options.body)); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent({}, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'payment_intent.succeeded', created: 1791651600, data: { object: {
        id: 'pi_reservation_test', amount: 25000, amount_received: 25000, currency: 'usd', customer: 'cus_reservation_test',
        metadata: { billing_role: 'reservation_deposit', reservation_deposit_id: 'e2b641a2-7c95-498e-a6c7-63b9e9e8b230', client_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201' }
      } }
    });
    assert.deepEqual(writes[0], { status: 'paid', stripe_payment_intent_id: 'pi_reservation_test', paid_at: new Date(1791651600 * 1000).toISOString() });
    assert.deepEqual(writes[1], { stripe_customer_id: 'cus_reservation_test' });
    assert.deepEqual(writes[2], { stripe_customer_id: 'cus_reservation_test' });
  } finally { globalThis.fetch = originalFetch; }
});

test('reservation deposit refuses mismatched Stripe amounts instead of marking the client paid', async () => {
  const originalFetch = globalThis.fetch;
  let patched = false;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/crm_reservation_deposits?id=') && options.method === 'PATCH') patched = true;
    if (address.includes('/crm_reservation_deposits?id=')) return new Response(JSON.stringify([{ id: 'e2b641a2-7c95-498e-a6c7-63b9e9e8b230', amount: 250, currency: 'USD', status: 'checkout_pending' }]), { status: 200 });
    if (options.method === 'PATCH') patched = true;
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await assert.rejects(processStripeEvent({}, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'payment_intent.succeeded', data: { object: {
        id: 'pi_reservation_wrong_amount', amount: 10000, currency: 'usd',
        metadata: { billing_role: 'reservation_deposit', reservation_deposit_id: 'e2b641a2-7c95-498e-a6c7-63b9e9e8b230', client_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201' }
      } }
    }), /does not match/);
    assert.equal(patched, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('Stripe refunds update a separate reservation deposit without touching contract revenue', async () => {
  const originalFetch = globalThis.fetch;
  let refundPatch;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/crm_reservation_deposits?stripe_payment_intent_id=') && !options.method) return new Response(JSON.stringify([{ id: 'e2b641a2-7c95-498e-a6c7-63b9e9e8b230', status: 'refund_pending' }]), { status: 200 });
    if (address.includes('/crm_reservation_deposits?id=') && options.method === 'PATCH') { refundPatch = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent({}, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'charge.refunded', data: { object: { payment_intent: 'pi_reservation_test', amount: 50000, amount_refunded: 50000 } }
    });
    assert.equal(refundPatch.status, 'refunded');
    assert.ok(refundPatch.refunded_at);
  } finally { globalThis.fetch = originalFetch; }
});

test('out-of-order refund webhook is reconciled before a delayed success event can mark deposit paid', async () => {
  const originalFetch = globalThis.fetch;
  const writes = [];
  const stripe = { charges: { retrieve: async (id) => ({ id, amount: 25000, amount_refunded: 25000, refunds: { data: [{ created: 1791651700 }] } }) } };
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/crm_reservation_deposits?id=') && options.method === 'PATCH') { writes.push(JSON.parse(options.body)); return new Response(null, { status: 204 }); }
    if (address.includes('/crm_reservation_deposits?id=')) return new Response(JSON.stringify([{ id: 'e2b641a2-7c95-498e-a6c7-63b9e9e8b230', amount: 250, currency: 'USD', status: 'checkout_pending' }]), { status: 200 });
    if (address.includes('/clients?id=') && options.method === 'PATCH') return new Response(null, { status: 204 });
    if (address.includes('/contracts?client_id=') && options.method === 'PATCH') return new Response(null, { status: 204 });
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent(stripe, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'payment_intent.succeeded', data: { object: {
        id: 'pi_out_of_order', latest_charge: 'ch_already_refunded', amount: 25000, amount_received: 25000, currency: 'usd',
        metadata: { billing_role: 'reservation_deposit', reservation_deposit_id: 'e2b641a2-7c95-498e-a6c7-63b9e9e8b230', client_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201' }
      } }
    });
    assert.equal(writes[0].status, 'refunded');
    assert.equal(writes[0].stripe_payment_intent_id, 'pi_out_of_order');
    assert.ok(writes[0].refunded_at);
  } finally { globalThis.fetch = originalFetch; }
});

test('expired reservation Checkout link moves to a recoverable state only for its matching session', async () => {
  const originalFetch = globalThis.fetch;
  let written;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/crm_reservation_deposits?id=') && options.method === 'PATCH') { written = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent({}, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'checkout.session.expired', data: { object: { id: 'cs_expired', metadata: { billing_role: 'reservation_deposit', reservation_deposit_id: 'e2b641a2-7c95-498e-a6c7-63b9e9e8b230' } } }
    });
    assert.deepEqual(written, { status: 'checkout_expired' });
  } finally { globalThis.fetch = originalFetch; }
});

test('delayed reservation Checkout failure is recorded without changing contract billing', async () => {
  const originalFetch = globalThis.fetch;
  let written;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/crm_reservation_deposits?id=') && options.method === 'PATCH') { written = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent({}, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'checkout.session.async_payment_failed', data: { object: { id: 'cs_failed', metadata: { billing_role: 'reservation_deposit', reservation_deposit_id: 'e2b641a2-7c95-498e-a6c7-63b9e9e8b230' } } }
    });
    assert.deepEqual(written, { status: 'payment_failed' });
  } finally { globalThis.fetch = originalFetch; }
});

test('delayed successful Checkout payment follows PaymentIntent verification and records the deposit', async () => {
  const originalFetch = globalThis.fetch;
  let paymentWrite;
  const stripe = { paymentIntents: { retrieve: async () => ({
    id: 'pi_async_reservation', amount: 25000, amount_received: 25000, currency: 'usd', created: 1791651600,
    customer: 'cus_async', metadata: { billing_role: 'reservation_deposit', reservation_deposit_id: 'e2b641a2-7c95-498e-a6c7-63b9e9e8b230', client_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201' }
  }) } };
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/crm_reservation_deposits?id=') && options.method === 'PATCH') { paymentWrite = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    if (address.includes('/crm_reservation_deposits?id=')) return new Response(JSON.stringify([{ id: 'e2b641a2-7c95-498e-a6c7-63b9e9e8b230', amount: 250, currency: 'USD', status: 'checkout_pending' }]), { status: 200 });
    if (options.method === 'PATCH' && (address.includes('/clients?id=') || address.includes('/contracts?client_id='))) return new Response(null, { status: 204 });
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent(stripe, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'checkout.session.async_payment_succeeded', data: { object: { mode: 'payment', payment_status: 'paid', payment_intent: 'pi_async_reservation' } }
    });
    assert.equal(paymentWrite.status, 'paid');
    assert.equal(paymentWrite.stripe_payment_intent_id, 'pi_async_reservation');
  } finally { globalThis.fetch = originalFetch; }
});

test('Stripe failed refund restores the reservation deposit to its prior recoverable state', async () => {
  const originalFetch = globalThis.fetch;
  let written;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/crm_reservation_deposits?id=') && !options.method) return new Response(JSON.stringify([{ id: 'e2b641a2-7c95-498e-a6c7-63b9e9e8b230', refund_previous_status: 'partially_refunded' }]), { status: 200 });
    if (address.includes('/crm_reservation_deposits?id=') && options.method === 'PATCH') { written = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent({}, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'refund.failed', data: { object: { id: 're_failed', status: 'failed', metadata: { billing_role: 'reservation_deposit', reservation_deposit_id: 'e2b641a2-7c95-498e-a6c7-63b9e9e8b230' } } }
    });
    assert.deepEqual(written, { status: 'partially_refunded', refund_previous_status: null });
  } finally { globalThis.fetch = originalFetch; }
});

test('new agreement installment wording matches the Stripe first-invoice adjustment while old links retain their terms', () => {
  const feeTerms = (contractVersion) => buildClauses({
    contractVersion, clientBusiness: 'Test Services', clientContact: 'Alex', clientEmail: 'alex@example.com',
    agreementDate: '2026-10-08', setupStart: '2026-10-08', setupFee: '1000', monthlyFee: '997',
    currency: 'USD', setupPayment: 'threeMonthly', term: 'Month-to-month', services: [], customServices: [],
    signerIndex: 0, guarantee: 'none', minAdSpend: 500, adSpendCurrency: 'USD'
  }).find((clause) => clause.title === 'Fees, Setup, and Term').paras;
  const setupText = (contractVersion) => feeTerms(contractVersion)[0];
  assert.match(setupText(2), /US\$333\.33, US\$333\.33, US\$333\.34/);
  assert.match(setupText(3), /US\$333\.34, US\$333\.33, US\$333\.33/);
  assert.match(feeTerms(5)[1], /billing begins when setup is complete/);
  assert.match(feeTerms(6)[1], /completes the separate monthly Stripe Checkout/);
  assert.match(feeTerms(6)[3], /two separate Stripe Checkouts/);
});

test('monthly service Checkout can be created separately before setup is complete', async () => {
  let params;
  const stripe = { checkout: { sessions: { create: async (data) => { params = data; return { id: 'cs_test_service', url: 'https://checkout.stripe.test/monthly', status: 'open' }; } } } };
  await createContractCheckout(stripe, {
    contract: { id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', reference: 'AG-TEST-1', client_business: 'Test Services', client_email: 'owner@example.com', currency: 'USD', monthly_fee: 297, setup_fee: 0, setup_payment_status: 'not_required', setup_completed_at: null, stripe_customer_id: 'cus_test', agreement: { contractVersion: 6, term: '12 months' } },
    action: 'service', origin: 'https://www.arvenogrowth.com'
  });
  assert.equal(params.mode, 'subscription');
  assert.equal(params.subscription_data.metadata.commitment_months, '12');
  assert.equal(params.subscription_data.payment_settings.save_default_payment_method, 'on_subscription');
  assert.match(params.custom_text.submit.message, /stop after 12 successful monthly payments/);
});

test('monthly service checkout uses a recurring monthly price and reuses the client Stripe customer', async () => {
  let params;
  const stripe = { checkout: { sessions: { create: async (data) => { params = data; return { id: 'cs_test_monthly', url: 'https://checkout.stripe.test/monthly', status: 'open' }; } } } };
  await createContractCheckout(stripe, {
    contract: {
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', reference: 'AG-TEST-1', client_business: 'Test Services',
      client_email: 'owner@example.com', currency: 'CAD', monthly_fee: 997, setup_fee: 1000,
      setup_payment_status: 'paid', setup_completed_at: '2026-10-08T12:00:00.000Z', stripe_customer_id: 'cus_test_client'
    },
    action: 'service', origin: 'https://preview.example.test'
  });
  assert.equal(params.mode, 'subscription');
  assert.equal(params.customer, 'cus_test_client');
  assert.equal(params.customer_email, undefined);
  assert.equal(params.line_items[0].price_data.unit_amount, 99700);
  assert.deepEqual(params.line_items[0].price_data.recurring, { interval: 'month' });
  assert.equal(params.subscription_data.metadata.billing_role, 'service_monthly');
  assert.equal(params.subscription_data.payment_settings.save_default_payment_method, 'on_subscription');
});

test('Stripe checkout links the verified customer back to the reusable CRM client', async () => {
  const originalFetch = globalThis.fetch;
  const patched = [];
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/rest/v1/contracts?id=') && !options.method) return new Response(JSON.stringify([{
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', client_id: '1f557ead-f47e-41ae-b6cc-04c8bfcc4201',
      reference: 'AG-TEST-1', client_business: 'Test Services', client_contact: 'Alex Morgan', client_email: 'alex@example.com',
      currency: 'CAD', setup_fee: 1000, monthly_fee: 997, status: 'draft', setup_payment_status: 'not_started',
      setup_installments_paid: 0, setup_completed_at: null, stripe_customer_id: null,
      stripe_subscription_id: null, stripe_subscription_status: 'not_started', onboarding_status: 'draft'
    }]), { status: 200 });
    if (options.method === 'PATCH' && address.includes('/rest/v1/contracts?id=')) { patched.push(['contract', JSON.parse(options.body)]); return new Response(null, { status: 204 }); }
    if (options.method === 'PATCH' && address.includes('/rest/v1/clients?id=')) { patched.push(['client', JSON.parse(options.body)]); return new Response(null, { status: 204 }); }
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent({}, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'checkout.session.completed', data: { object: { mode: 'payment', customer: 'cus_test_client', metadata: { contract_id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201' } } }
    });
    assert.deepEqual(patched, [
      ['contract', { stripe_customer_id: 'cus_test_client' }],
      ['client', { stripe_customer_id: 'cus_test_client' }]
    ]);
  } finally { globalThis.fetch = originalFetch; }
});

test('live Stripe billing stays disabled until it is explicitly enabled', () => {
  const previous = { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY, STRIPE_LIVE_MODE_ENABLED: process.env.STRIPE_LIVE_MODE_ENABLED };
  process.env.STRIPE_SECRET_KEY = 'sk_live_placeholder';
  delete process.env.STRIPE_LIVE_MODE_ENABLED;
  try { assert.throws(() => stripeClient(), /Live Stripe billing is disabled/); }
  finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('Vercel Preview rejects live Stripe keys even if live mode is enabled', () => {
  const previous = { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY, STRIPE_LIVE_MODE_ENABLED: process.env.STRIPE_LIVE_MODE_ENABLED, VERCEL_ENV: process.env.VERCEL_ENV };
  Object.assign(process.env, { STRIPE_SECRET_KEY: 'sk_live_placeholder', STRIPE_LIVE_MODE_ENABLED: 'true', VERCEL_ENV: 'preview' });
  try { assert.throws(() => stripeClient(), /Preview billing only accepts Stripe test-mode keys/); }
  finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});

test('Stripe webhook rejects an invalid signature before touching CRM data', async () => {
  const previous = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY
  };
  Object.assign(process.env, {
    STRIPE_SECRET_KEY: 'sk_test_placeholder', STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
    SUPABASE_URL: 'https://crm-test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_placeholder'
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('No Supabase request should be made for an invalid signature.'); };
  try {
    const res = response();
    await stripeWebhookHandler({ method: 'POST', headers: { 'stripe-signature': 'invalid' }, body: Buffer.from('{"type":"invoice.paid"}') }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /signature/i);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
