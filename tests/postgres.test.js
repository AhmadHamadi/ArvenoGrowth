// Runs the portal API against a real Postgres (embedded, temporary) instead of mocks.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const port = 55000 + Math.floor(Math.random() * 5000);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arveno-pg-test-'));
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'test', password: 'test', port, persistent: false, onLog: () => {}, onError: () => {} });

let db, crm, auth, adminHandler, clientsHandler, tasksHandler, leadsAdminHandler, leadHandler;
const ADMIN = 'owner@example.com';
const PASSWORD = 'correct horse battery staple';

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    end() { return this; }
  };
}
async function call(handler, req) {
  const res = response();
  await handler({ headers: {}, query: {}, ...req }, res);
  return res;
}
let token;
const authed = (req) => ({ ...req, headers: { authorization: `Bearer ${token}`, ...(req.headers || {}) } });

before(async () => {
  await server.initialise();
  await server.start();
  await server.createDatabase('portal');
  Object.assign(process.env, {
    DATABASE_URL: `postgres://test:test@127.0.0.1:${port}/portal`,
    ADMIN_SESSION_SECRET: 'test-secret-'.padEnd(48, 'x'),
    CONTRACT_ADMIN_EMAILS: ADMIN
  });
  delete process.env.SUPABASE_URL;
  db = await import('../lib/db.js');
  crm = await import('../lib/crm.js');
  auth = await import('../lib/portal-auth.js');
  adminHandler = (await import('../api/admin.js')).default;
  clientsHandler = (await import('../api/admin/clients.js')).default;
  tasksHandler = (await import('../api/admin/tasks.js')).default;
  leadsAdminHandler = (await import('../api/admin/leads.js')).default;
  leadHandler = (await import('../api/lead.js')).default;
  const ran = await db.migrate(path.resolve('db/migrations'));
  assert.ok(ran.length >= 19, `expected all migrations to run, got ${ran.length}`);
});

after(async () => {
  await db?.closePool();
  await server.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('migrations are idempotent and the backend reports postgres', async () => {
  assert.deepEqual(await db.migrate(path.resolve('db/migrations')), []);
  assert.equal(crm.dbMode(), 'postgres');
  assert.deepEqual(crm.serviceConfig(), { mode: 'postgres' });
});

test('REST-style requests map to parameterized SQL', async () => {
  const config = { mode: 'postgres' };
  const [a] = await crm.dbRequest(config, 'clients', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ business_name: '100% Roofing_Co', first_name: 'A', last_name: 'B', email: 'a@x.com' }) });
  await crm.dbRequest(config, 'clients', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ business_name: '1000 Roofing Co', first_name: 'C', last_name: 'D', email: 'c@x.com', phone: null }]) });
  assert.match(a.id, /^[0-9a-f-]{36}$/);
  assert.match(a.created_at, /^\d{4}-\d{2}-\d{2}T.*Z$/, 'timestamps come back as ISO strings');

  // ilike treats % and _ literally; * is the wildcard
  const literal = await crm.dbRequest(config, `clients?business_name=ilike.${encodeURIComponent('100% roofing_co')}&select=id`);
  assert.equal(literal.length, 1);
  const wild = await crm.dbRequest(config, `clients?business_name=ilike.${encodeURIComponent('*roofing*')}&select=business_name&order=business_name.asc`);
  assert.deepEqual(wild.map((r) => r.business_name).sort(), ['1000 Roofing Co', '100% Roofing_Co'].sort());

  const sel = await crm.dbRequest(config, `clients?email=in.(a@x.com,c@x.com)&phone=is.null&select=email&order=email.desc&limit=1`);
  assert.deepEqual(sel, [{ email: 'c@x.com' }]);
  const neq = await crm.dbRequest(config, `clients?email=neq.a@x.com&select=email`);
  assert.deepEqual(neq, [{ email: 'c@x.com' }]);

  const patched = await crm.dbRequest(config, `clients?id=eq.${a.id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ phone: '555' }) });
  assert.equal(patched[0].phone, '555');
  assert.equal(await crm.dbRequest(config, `clients?id=eq.${a.id}`, { method: 'PATCH', body: JSON.stringify({ phone: '556' }) }), null);

  await assert.rejects(crm.dbRequest(config, 'clients', { method: 'PATCH', body: '{"phone":"1"}' }), /without a filter/);
  await assert.rejects(crm.dbRequest(config, 'clients?select=id;drop table clients', {}), /Invalid database identifier/);
  await assert.rejects(crm.dbRequest(config, `clients?id=eq.${a.id}`, { method: 'PATCH', body: JSON.stringify({ not_a_column: 1 }) }), /column .* does not exist/);
});

test('upserts, jsonb and numeric columns behave like Supabase REST', async () => {
  const config = { mode: 'postgres' };
  const first = await crm.dbRequest(config, 'crm_stripe_events?on_conflict=event_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ event_id: 'evt_1', event_type: 'invoice.paid' }) });
  const dup = await crm.dbRequest(config, 'crm_stripe_events?on_conflict=event_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ event_id: 'evt_1', event_type: 'invoice.paid' }) });
  assert.equal(first.length, 1);
  assert.equal(dup.length, 0, 'duplicate claim returns no rows');
  await crm.dbRequest(config, 'crm_stripe_events?event_id=eq.evt_1', { method: 'DELETE' });
  assert.deepEqual(await crm.dbRequest(config, 'crm_stripe_events?select=*'), []);

  const agreement = { contractVersion: 7, services: ['Google Ads', 'GBP'], nested: { ok: true } };
  const [contract] = await crm.dbRequest(config, 'contracts?on_conflict=contract_token_hash', {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ reference: 'AG-TEST-261104', contract_token_hash: 'h1', client_business: 'Test Co', client_contact: 'Pat', client_email: 'pat@x.com', currency: 'USD', setup_fee: 1000.5, monthly_fee: 997, agreement, signing_expires_at: new Date(Date.now() + 3600e3).toISOString() })
  });
  assert.deepEqual(contract.agreement, agreement);
  assert.equal(typeof contract.setup_fee, 'number');
  assert.equal(contract.setup_fee, 1000.5);
});

test('portal sign-in: login, bad password, lockout, tampered token, allowlist', async () => {
  await auth.setAdminPassword(ADMIN, PASSWORD);
  const bad = await call(adminHandler, { method: 'POST', body: { action: 'login', email: ADMIN, password: 'wrong password!!' } });
  assert.equal(bad.statusCode, 401);
  const ok = await call(adminHandler, { method: 'POST', body: { action: 'login', email: ' Owner@Example.com ', password: PASSWORD } });
  assert.equal(ok.statusCode, 200);
  token = ok.body.token;
  assert.ok(token);

  const list = await call(adminHandler, authed({ method: 'GET' }));
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.adminEmail, ADMIN);
  assert.ok(list.body.integrations.some((i) => i.id === 'database' && i.status === 'connected'));

  const tampered = await call(adminHandler, { method: 'GET', headers: { authorization: `Bearer ${token.slice(0, -2)}xx` } });
  assert.equal(tampered.statusCode, 401);
  const none = await call(adminHandler, { method: 'GET' });
  assert.equal(none.statusCode, 401);

  await auth.setAdminPassword('intruder@example.com', 'another long password');
  const outsider = await call(adminHandler, { method: 'POST', body: { action: 'login', email: 'intruder@example.com', password: 'another long password' } });
  assert.equal(outsider.statusCode, 403);
  const forged = auth.signSession('intruder@example.com');
  assert.equal((await call(adminHandler, { method: 'GET', headers: { authorization: `Bearer ${forged}` } })).statusCode, 403);
  const stale = auth.signSession(ADMIN);
  assert.equal((await call(adminHandler, { method: 'GET', headers: { authorization: `Bearer ${stale}` } })).statusCode, 401, 'token without the current password version is rejected');

  await auth.setAdminPassword('locked@example.com', 'locked long password');
  for (let i = 0; i < 5; i++) await call(adminHandler, { method: 'POST', body: { action: 'login', email: 'locked@example.com', password: 'nope nope nope' } });
  const locked = await call(adminHandler, { method: 'POST', body: { action: 'login', email: 'locked@example.com', password: 'locked long password' } });
  assert.equal(locked.statusCode, 429);

  // Resetting the password signs out old sessions.
  const before = token;
  await auth.setAdminPassword(ADMIN, 'a brand new long password');
  assert.equal((await call(adminHandler, { method: 'GET', headers: { authorization: `Bearer ${before}` } })).statusCode, 401);
  await auth.setAdminPassword(ADMIN, PASSWORD);
  token = (await call(adminHandler, { method: 'POST', body: { action: 'login', email: ADMIN, password: PASSWORD } })).body.token;
});

test('clients, tasks and leads work end to end on Postgres', async () => {
  const created = await call(clientsHandler, authed({ method: 'POST', body: { businessName: 'Seven Test Landscape', firstName: 'Sam', lastName: 'Lee', email: 'SAM@test.com', phone: '2895550100' } }));
  assert.equal(created.statusCode, 200);
  const again = await call(clientsHandler, authed({ method: 'POST', body: { businessName: 'seven test landscape', firstName: 'Sam', lastName: 'Lee', email: 'sam@test.com' } }));
  assert.equal(again.body.existing, true);
  const former = await call(clientsHandler, authed({ method: 'PATCH', body: { id: created.body.client.id, action: 'former' } }));
  assert.ok(former.body.client.former_at);
  const one = await call(clientsHandler, authed({ method: 'GET', query: { id: created.body.client.id } }));
  assert.equal(one.body.clients.length, 1);

  const task = await call(tasksHandler, authed({ method: 'POST', body: { title: 'Call Sam', dueAt: '2026-11-20', priority: 'high' } }));
  assert.equal(task.statusCode, 201);
  assert.equal(task.body.task.due_at, '2026-11-20', 'date columns stay date-only');
  const nodate = await call(tasksHandler, authed({ method: 'POST', body: { title: 'No date' } }));
  const tasks = await call(tasksHandler, authed({ method: 'GET' }));
  assert.deepEqual(tasks.body.tasks.map((t) => t.title), ['Call Sam', 'No date'], 'nulls sort last');
  const done = await call(tasksHandler, authed({ method: 'PATCH', body: { id: task.body.task.id, status: 'done' } }));
  assert.equal(done.body.task.status, 'done');
  await call(tasksHandler, authed({ method: 'DELETE', query: { id: nodate.body.task.id } }));
  assert.equal((await call(tasksHandler, authed({ method: 'GET' }))).body.tasks.length, 1);

  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { RESEND_API_KEY: 'resend-test-key', RESEND_FROM: 'Arveno <hello@example.com>', MAIL_TO: 'owner@example.com' });
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 'email' }), { status: 200 });
  try {
    const lead = await call(leadHandler, { method: 'POST', body: { source: 'audit', name: 'Taylor Morgan', email: 'taylor@example.com', business: 'Taylor Services', phone: '2894891167', services: 'HVAC installation', message: 'Need more calls' } });
    assert.equal(lead.statusCode, 200);
    assert.equal(lead.body.crmSaved, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
  const leads = await call(leadsAdminHandler, authed({ method: 'GET' }));
  assert.equal(leads.body.leads[0].message, 'Need more calls');
  const contacted = await call(leadsAdminHandler, authed({ method: 'PATCH', body: { id: leads.body.leads[0].id, stage: 'contacted' } }));
  assert.ok(contacted.body.lead.last_contacted_at);
});

test('signed PDFs are stored in Postgres and downloadable by the admin', async () => {
  const config = crm.serviceConfig();
  const { createHash } = await import('node:crypto');
  const signingToken = 'signing-token-123';
  const hash = createHash('sha256').update(signingToken).digest('hex');
  const [row] = await crm.dbRequest(config, 'contracts', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ reference: 'AG-PDF-261104', contract_token_hash: hash, client_business: 'Pdf Co', client_contact: 'Jo', client_email: 'jo@x.com', currency: 'USD', setup_fee: 0, monthly_fee: 297, agreement: { contractVersion: 7 }, signing_expires_at: new Date(Date.now() + 3600e3).toISOString() })
  });
  const pdf = Buffer.from('%PDF-1.7 test document');
  const saved = await crm.saveSignedRecord(config, { reference: 'AG-PDF-261104', token: signingToken, typedName: 'Jo Smith', typedBusinessName: 'Pdf Co', signedAt: new Date().toISOString(), pdf });
  assert.equal(saved, true);
  await assert.rejects(crm.saveSignedRecord(config, { reference: 'AG-PDF-261104', token: signingToken, typedName: 'Jo', signedAt: new Date().toISOString(), pdf }), /already been signed/);

  const download = await call(adminHandler, authed({ method: 'GET', query: { pdf: row.id } }));
  assert.equal(download.statusCode, 200);
  assert.equal(download.headers['Content-Type'], 'application/pdf');
  assert.equal(Buffer.compare(download.body, pdf), 0);
});
