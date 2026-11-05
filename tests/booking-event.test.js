import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/booking-event.js';
import { createBookingFollowupToken, readBookingFollowupToken } from '../lib/booking-followup.js';

function response() {
  return {
    code: null, payload: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { return this; }
  };
}

function request({ method = 'POST', origin = 'https://www.arvenogrowth.com', body, ip = '198.51.100.11' } = {}) {
  return { method, headers: { origin, 'x-forwarded-for': ip }, body };
}

test('booking confirmation cancels only a valid signed scheduled reminder', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'resend-test-key';
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ id: 'scheduled-email-id' }), { status: 200 });
  };
  try {
    const token = createBookingFollowupToken('scheduled-email-id', process.env.RESEND_API_KEY);
    assert.equal(readBookingFollowupToken(token, process.env.RESEND_API_KEY), 'scheduled-email-id');
    assert.equal(readBookingFollowupToken(token, 'different-key'), null);

    const badOrigin = response();
    await handler(request({ origin: 'https://attacker.example', body: { event: 'booking_confirmed', bookingFollowupToken: token } }), badOrigin);
    assert.equal(badOrigin.code, 403);
    assert.equal(calls.length, 0);

    const unsupported = response();
    await handler(request({ body: { event: 'scheduler_opened', bookingFollowupToken: token }, ip: '198.51.100.12' }), unsupported);
    assert.equal(unsupported.code, 400);
    assert.equal(calls.length, 0);

    const confirmed = response();
    await handler(request({ body: { event: 'booking_confirmed', bookingFollowupToken: token }, ip: '198.51.100.13' }), confirmed);
    assert.equal(confirmed.code, 200);
    assert.equal(confirmed.payload.cancelled, true);
    assert.match(calls[0].url, /emails\/scheduled-email-id\/cancel$/);
    assert.equal(calls[0].options.method, 'POST');

    const missingToken = response();
    await handler(request({ body: { event: 'booking_confirmed' }, ip: '198.51.100.14' }), missingToken);
    assert.equal(missingToken.code, 200);
    assert.equal(missingToken.payload.cancelled, false);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  }
});

test('booking cancellation route handles unsupported methods and OPTIONS', async () => {
  const options = response();
  await handler(request({ method: 'OPTIONS' }), options);
  assert.equal(options.code, 204);

  const method = response();
  await handler(request({ method: 'GET' }), method);
  assert.equal(method.code, 405);
});
