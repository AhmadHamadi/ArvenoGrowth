import { dbRequest, handlerError, json } from './crm.js';
import { stripeClient } from './stripe.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const amountCents = (amount) => Math.round(Number(amount) * 100);

function origin() {
  if (process.env.VERCEL_ENV === 'preview') {
    if (!process.env.VERCEL_URL) throw Object.assign(new Error('Preview billing URL is unavailable.'), { status: 503 });
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.PUBLIC_SITE_URL || 'https://www.arvenogrowth.com';
}

async function makeCheckout(deposit, client) {
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', customer: client.stripe_customer_id || undefined,
    customer_email: client.stripe_customer_id ? undefined : client.email,
    customer_creation: client.stripe_customer_id ? undefined : 'always',
    line_items: [{ price_data: {
      currency: deposit.currency.toLowerCase(), unit_amount: amountCents(deposit.amount),
      product_data: {
        name: `Refundable reservation deposit — ${client.business_name}`,
        description: 'Fully refundable on request to the original payment method. This reservation deposit is separate from any signed setup fee; applying it toward setup requires a signed agreement or amendment.'
      }
    }, quantity: 1 }],
    metadata: { billing_role: 'reservation_deposit', reservation_deposit_id: deposit.id, client_id: client.id },
    payment_intent_data: { metadata: { billing_role: 'reservation_deposit', reservation_deposit_id: deposit.id, client_id: client.id } },
    success_url: `${origin()}/admin?reservation=success`,
    cancel_url: `${origin()}/admin?reservation=cancelled`
  }, { idempotencyKey: `ag-reservation-${deposit.id}-${deposit.checkout_attempt}` });
  await dbRequest(deposit.config, `crm_reservation_deposits?id=eq.${encodeURIComponent(deposit.id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ stripe_checkout_session_id: session.id, checkout_url: session.url, status: 'checkout_pending' })
  });
  return { ...deposit, stripe_checkout_session_id: session.id, checkout_url: session.url, status: 'checkout_pending' };
}

export async function reservationDepositsHandler(req, res, config) {
  try {
    if (req.method === 'GET') {
      const query = req.query?.clientId ? `&client_id=eq.${encodeURIComponent(req.query.clientId)}` : '';
      const deposits = await dbRequest(config, `crm_reservation_deposits?select=*&order=created_at.desc&limit=1000${query}`);
      return json(res, 200, { deposits: deposits || [] });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return json(res, 405, { error: 'Method not allowed.' });
    }

    const action = String(req.body?.action || '');
    if (action === 'create') {
      const clientId = String(req.body?.clientId || '');
      const amount = Number(req.body?.amount);
      const currency = String(req.body?.currency || 'USD').toUpperCase();
      if (!UUID.test(clientId)) return json(res, 400, { error: 'Choose a saved CRM client.' });
      if (!Number.isFinite(amount) || amount < 1 || amount > 100000 || Math.round(amount * 100) / 100 !== amount || !Number.isSafeInteger(amountCents(amount))) return json(res, 400, { error: 'Enter a deposit between 1 and 100,000 with no more than two decimal places.' });
      if (!['USD', 'CAD'].includes(currency)) return json(res, 400, { error: 'Choose USD or CAD.' });
      const clients = await dbRequest(config, `clients?id=eq.${encodeURIComponent(clientId)}&select=id,business_name,email,stripe_customer_id,former_at&limit=1`);
      const client = clients?.[0];
      if (!client) return json(res, 404, { error: 'Client not found.' });
      if (client.former_at) return json(res, 409, { error: 'Restore this former client before creating a reservation deposit.' });

      const rows = await dbRequest(config, 'crm_reservation_deposits', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ client_id: client.id, amount, currency, status: 'checkout_pending' })
      });
      const deposit = rows?.[0];
      if (!deposit) throw new Error('Could not create the reservation record.');
      try { return json(res, 200, { deposit: await makeCheckout({ ...deposit, config }, client) }); }
      catch (error) {
        await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(deposit.id)}&status=eq.checkout_pending`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'checkout_failed' })
        }).catch(() => {});
        throw error;
      }
    }

    if (action === 'renew') {
      const id = String(req.body?.depositId || '');
      if (!UUID.test(id)) return json(res, 400, { error: 'Choose a valid deposit.' });
      const found = await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(id)}&select=id,client_id,amount,currency,status,checkout_attempt&limit=1`);
      const previous = found?.[0];
      if (!previous || !['checkout_expired', 'checkout_failed', 'payment_failed'].includes(previous.status)) return json(res, 409, { error: 'Only an expired or failed Checkout link can be renewed.' });
      const clientRows = await dbRequest(config, `clients?id=eq.${encodeURIComponent(previous.client_id)}&select=id,business_name,email,stripe_customer_id,former_at&limit=1`);
      const client = clientRows?.[0];
      if (!client || client.former_at) return json(res, 409, { error: 'Restore the client before renewing this reservation link.' });
      const claimed = await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(id)}&status=eq.${previous.status}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'checkout_pending', checkout_attempt: Number(previous.checkout_attempt || 1) + 1 })
      });
      if (!claimed?.[0]) return json(res, 409, { error: 'This deposit changed while the link was being renewed. Refresh and try again.' });
      try { return json(res, 200, { deposit: await makeCheckout({ ...claimed[0], config }, client) }); }
      catch (error) {
        await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(id)}&status=eq.checkout_pending`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'checkout_failed' })
        }).catch(() => {});
        throw error;
      }
    }

    if (action === 'refund') {
      const id = String(req.body?.depositId || '');
      if (!UUID.test(id)) return json(res, 400, { error: 'Choose a valid deposit.' });
      const existing = await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(id)}&select=id,status,refund_attempt&limit=1`);
      const previous = existing?.[0];
      if (!previous || !['paid', 'partially_refunded'].includes(previous.status)) return json(res, 409, { error: 'This deposit is not refundable in its current state or a refund has already started.' });
      // Claim the full refund before calling Stripe. The conditional update
      // prevents two admins from issuing competing refunds.
      const claimed = await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(id)}&status=eq.${previous.status}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'refund_pending', refund_previous_status: previous.status, refund_attempt: Number(previous.refund_attempt || 0) + 1 })
      });
      const deposit = claimed?.[0];
      if (!deposit) return json(res, 409, { error: 'This deposit is not paid or a refund has already started.' });
      if (!deposit.stripe_payment_intent_id) {
        await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(id)}&status=eq.refund_pending`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: previous.status, refund_previous_status: null })
        });
        return json(res, 409, { error: 'Stripe has not confirmed the payment intent yet. Refresh and try again.' });
      }
      try {
        const refund = await stripeClient().refunds.create({
          payment_intent: deposit.stripe_payment_intent_id,
          metadata: { billing_role: 'reservation_deposit', reservation_deposit_id: deposit.id }
        }, { idempotencyKey: `ag-reservation-refund-${deposit.id}-${deposit.refund_attempt}` });
        const refundFailed = ['failed', 'canceled'].includes(refund.status);
        const status = refund.status === 'succeeded' ? 'refunded' : refundFailed ? previous.status : 'refund_pending';
        await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ stripe_refund_id: refund.id, status, refund_previous_status: status === 'refund_pending' ? previous.status : null, ...(status === 'refunded' ? { refunded_at: new Date().toISOString() } : {}) })
        });
        return json(res, 200, { refundStatus: refund.status || 'pending' });
      } catch (error) {
        await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(id)}&status=eq.refund_pending`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: previous.status, refund_previous_status: null })
        }).catch(() => {});
        throw error;
      }
    }
    return json(res, 400, { error: 'Choose create or refund.' });
  } catch (error) { return handlerError(res, error); }
}
