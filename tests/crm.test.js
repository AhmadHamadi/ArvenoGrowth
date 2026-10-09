import test from 'node:test';
import assert from 'node:assert/strict';
import adminHandler from '../api/admin.js';
import clientsHandler from '../api/admin/clients.js';
import leadHandler from '../api/lead.js';
import { buildClauses, encodeContract } from '../src/contract-model.js';
import { saveSignedRecord, serviceHeaders } from '../lib/crm.js';
import { createContractCheckout, setupInstallments, stripeClient } from '../lib/stripe.js';
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
  let sentPayload;
  globalThis.fetch = async (_url, options) => {
    sentPayload = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: 'test-email-id' }), { status: 200 });
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
    assert.match(sentPayload.html, /HVAC installation/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

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

test('contract created from a CRM client preserves the client link and canonical identity snapshot', async () => {
  Object.assign(process.env, {
    SUPABASE_URL: 'https://crm-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
    SUPABASE_SECRET_KEY: 'server-test-key', CONTRACT_ADMIN_EMAILS: 'owner@example.com'
  });
  const originalFetch = globalThis.fetch;
  let inserted;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ email: 'owner@example.com' }), { status: 200 });
    if (address.includes('/rest/v1/clients?')) return new Response(JSON.stringify([{
      id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', business_name: 'Canonical HVAC',
      first_name: 'Taylor', last_name: 'Morgan', email: 'taylor@example.com', phone: '2895550100'
    }]), { status: 200 });
    if (address.endsWith('/rest/v1/contracts?on_conflict=contract_token_hash')) {
      inserted = JSON.parse(options.body);
      return new Response(JSON.stringify([{ ...inserted, id: '1f557ead-f47e-41ae-b6cc-04c8bfcc4201' }]), { status: 201 });
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

test('signing remains compatible while the additive billing migration is pending', async () => {
  const originalFetch = globalThis.fetch;
  const agreement = { clientBusiness: 'Migration Test Co', agreementDate: '2026-10-08', clientContact: 'Alex', clientEmail: 'alex@example.com' };
  const token = encodeContract(agreement);
  let signaturePatchAttempts = 0;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('/rest/v1/contracts?reference=')) {
      const hash = (await import('node:crypto')).createHash('sha256').update(token).digest('hex');
      return new Response(JSON.stringify([{ id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', contract_token_hash: hash, status: 'sent' }]), { status: 200 });
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
});

test('Stripe stops a three-installment setup subscription after its third successful invoice', async () => {
  const originalFetch = globalThis.fetch;
  let canceledAtPeriodEnd = false;
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
    if (address.includes('/rest/v1/contracts?id=') && options.method === 'PATCH') return new Response(null, { status: 204 });
    throw new Error(`Unexpected test request: ${address}`);
  };
  try {
    await processStripeEvent(stripe, { url: 'https://crm-test.supabase.co', service: 'server-test-key', legacyServiceKey: false }, {
      type: 'invoice.paid', data: { object: { id: 'in_3', subscription: 'sub_setup', amount_paid: 33334, currency: 'usd', payment_intent: 'pi_3', created: 1791489600 } }
    });
    assert.equal(canceledAtPeriodEnd, true);
  } finally { globalThis.fetch = originalFetch; }
});

test('new agreement installment wording matches the Stripe first-invoice adjustment while old links retain their terms', () => {
  const setupText = (contractVersion) => buildClauses({
    contractVersion, clientBusiness: 'Test Services', clientContact: 'Alex', clientEmail: 'alex@example.com',
    agreementDate: '2026-10-08', setupStart: '2026-10-08', setupFee: '1000', monthlyFee: '997',
    currency: 'USD', setupPayment: 'threeMonthly', term: 'Month-to-month', services: [], customServices: [],
    signerIndex: 0, guarantee: 'none', minAdSpend: 500, adSpendCurrency: 'USD'
  }).find((clause) => clause.title === 'Fees, Setup, and Term').paras[0];
  assert.match(setupText(2), /US\$333\.33, US\$333\.33, US\$333\.34/);
  assert.match(setupText(3), /US\$333\.34, US\$333\.33, US\$333\.33/);
});

test('monthly service checkout cannot start before setup is complete', async () => {
  const stripe = { checkout: { sessions: { create: async () => { throw new Error('Must not create a session'); } } } };
  await assert.rejects(() => createContractCheckout(stripe, {
    contract: { id: '0f557ead-f47e-41ae-b6cc-04c8bfcc4201', reference: 'AG-TEST-1', client_business: 'Test Services', client_email: 'owner@example.com', currency: 'USD', monthly_fee: 997, setup_fee: 1000, setup_payment_status: 'paid', setup_completed_at: null },
    action: 'service', origin: 'https://www.arvenogrowth.com'
  }), /Mark setup complete/);
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
