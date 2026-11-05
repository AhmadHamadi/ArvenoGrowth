import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/admin/meetings.js';

function response() {
  return {
    code: null, payload: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

const envKeys = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'CONTRACT_ADMIN_EMAILS', 'CALENDLY_ACCESS_TOKEN'];
const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
function setupEnv(token = 'calendly-test-token') {
  Object.assign(process.env, {
    SUPABASE_URL: 'https://crm-test.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
    SUPABASE_SECRET_KEY: 'server-test-key',
    CONTRACT_ADMIN_EMAILS: 'owner@example.com'
  });
  if (token) process.env.CALENDLY_ACCESS_TOKEN = token;
  else delete process.env.CALENDLY_ACCESS_TOKEN;
}
function restoreEnv() {
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
}

test('meetings endpoint requires an authorized CRM session before Calendly access', async () => {
  setupEnv();
  const originalFetch = globalThis.fetch;
  let calendlyCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes('api.calendly.com')) calendlyCalls += 1;
    return new Response(JSON.stringify({ email: 'other@example.com' }), { status: 200 });
  };
  try {
    const res = response();
    await handler({ method: 'GET', headers: { authorization: 'Bearer admin-token' } }, res);
    assert.equal(res.code, 403);
    assert.equal(calendlyCalls, 0);
  } finally { globalThis.fetch = originalFetch; restoreEnv(); }
});

test('meetings endpoint returns upcoming and past events with active invitee details privately', async () => {
  setupEnv();
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ url: url.href, authorization: init.headers?.Authorization });
    if (url.pathname === '/auth/v1/user') return new Response(JSON.stringify({ email: 'owner@example.com' }), { status: 200 });
    assert.equal(init.headers?.Authorization, 'Bearer calendly-test-token');
    if (url.pathname === '/users/me') return new Response(JSON.stringify({ resource: { uri: 'https://api.calendly.com/users/OWNER' } }), { status: 200 });
    if (url.pathname === '/scheduled_events') {
      assert.equal(url.searchParams.get('user'), 'https://api.calendly.com/users/OWNER');
      assert.equal(url.searchParams.get('status'), 'active');
      const past = url.searchParams.has('max_start_time');
      if (past) {
        assert.equal(url.searchParams.get('sort'), 'start_time:desc');
        assert.ok(url.searchParams.get('max_start_time'));
      } else {
        assert.equal(url.searchParams.get('sort'), 'start_time:asc');
        assert.ok(url.searchParams.get('min_start_time'));
      }
      return new Response(JSON.stringify({ collection: [{
        uri: `https://api.calendly.com/scheduled_events/${past ? 'EVENT_PAST' : 'EVENT_FUTURE'}`,
        name: past ? 'Past Growth Consultation' : 'Growth Consultation',
        status: 'active', start_time: past ? '2000-10-20T15:00:00Z' : '2099-10-20T15:00:00Z',
        end_time: past ? '2000-10-20T15:45:00Z' : '2099-10-20T15:45:00Z',
        location: { kind: 'google_conference', join_url: 'https://meet.google.com/test-room' }
      }], pagination: {} }), { status: 200 });
    }
    if (/^\/scheduled_events\/EVENT_(PAST|FUTURE)\/invitees$/.test(url.pathname)) {
      return new Response(JSON.stringify({ collection: [{
        name: 'Taylor Morgan', email: 'taylor@example.com', timezone: 'America/Toronto', status: 'active',
        cancel_url: 'https://calendly.com/cancellations/test', reschedule_url: 'https://calendly.com/reschedulings/test'
      }] }), { status: 200 });
    }
    throw new Error(`Unexpected test request: ${url.href}`);
  };
  try {
    const res = response();
    await handler({ method: 'GET', headers: { authorization: 'Bearer admin-token' } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.payload.configured, true);
    assert.equal(res.payload.meetings.length, 2);
    const pastMeeting = res.payload.meetings.find((meeting) => meeting.id === 'EVENT_PAST');
    const upcomingMeeting = res.payload.meetings.find((meeting) => meeting.id === 'EVENT_FUTURE');
    assert.equal(pastMeeting.name, 'Past Growth Consultation');
    assert.equal(pastMeeting.invitees[0].email, 'taylor@example.com');
    assert.equal(upcomingMeeting.name, 'Growth Consultation');
    assert.equal(upcomingMeeting.location, 'https://meet.google.com/test-room');
    assert.ok(res.headers['Cache-Control'].includes('no-store'));
    assert.ok(requests.every((request) => request.url.startsWith('https://crm-test.supabase.co/') || request.url.startsWith('https://api.calendly.com/')));
  } finally { globalThis.fetch = originalFetch; restoreEnv(); }
});

test('meetings endpoint reports missing Calendly token without failing other CRM data', async () => {
  setupEnv('');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ email: 'owner@example.com' }), { status: 200 });
  try {
    const res = response();
    await handler({ method: 'GET', headers: { authorization: 'Bearer admin-token' } }, res);
    assert.equal(res.code, 503);
    assert.equal(res.payload.configured, false);
    assert.match(res.payload.error, /CALENDLY_ACCESS_TOKEN/);
  } finally { globalThis.fetch = originalFetch; restoreEnv(); }
});
