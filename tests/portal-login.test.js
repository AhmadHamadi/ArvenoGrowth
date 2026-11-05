// Legacy Supabase mode: the portal login now goes through /api/admin instead of the browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import adminHandler from '../api/admin.js';

const res = () => ({ statusCode: 200, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });

test('login proxies to Supabase password grant when DATABASE_URL is not set', async () => {
  delete process.env.DATABASE_URL;
  Object.assign(process.env, { SUPABASE_URL: 'https://crm-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'pub-key' });
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push([String(url), opts]);
    const body = JSON.parse(opts.body);
    if (body.password === 'right') return new Response(JSON.stringify({ access_token: 'tok-123', user: { email: 'owner@example.com' } }), { status: 200 });
    return new Response(JSON.stringify({ msg: 'Invalid login credentials' }), { status: 400 });
  };
  try {
    const ok = res();
    await adminHandler({ method: 'POST', headers: {}, body: { action: 'login', email: 'owner@example.com', password: 'right' } }, ok);
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.body.token, 'tok-123');
    assert.match(calls[0][0], /\/auth\/v1\/token\?grant_type=password$/);
    assert.equal(calls[0][1].headers.apikey, 'pub-key');
    const bad = res();
    await adminHandler({ method: 'POST', headers: {}, body: { action: 'login', email: 'owner@example.com', password: 'wrong' } }, bad);
    assert.equal(bad.statusCode, 401);
  } finally {
    globalThis.fetch = original;
  }
});
