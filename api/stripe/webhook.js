import Stripe from 'stripe';
import { dbRequest, json, serviceConfig } from '../../lib/crm.js';
import { sendTransactionalEmail } from '../../lib/transactional-email.js';

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

const respond = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
};
const toDollars = (cents) => Math.round(Number(cents || 0)) / 100;
const contractIdFrom = (object) => object?.metadata?.contract_id || object?.subscription_details?.metadata?.contract_id || object?.parent?.subscription_details?.metadata?.contract_id || '';

async function contractById(config, id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  const rows = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(id)}&select=id,reference,client_business,client_contact,client_email,currency,setup_fee,monthly_fee,status,setup_payment_status,setup_installments_paid,setup_completed_at,stripe_customer_id,stripe_subscription_id,stripe_subscription_status,onboarding_status`);
  return rows?.[0] || null;
}

async function updateContract(config, id, fields) {
  await dbRequest(config, `contracts?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(fields)
  });
}

async function recordPayment(config, { contract, objectId, invoiceId = null, paymentIntentId = null, kind, amountCents, currency, paidAt }) {
  const insertedRows = await dbRequest(config, 'crm_payments?on_conflict=stripe_object_id', {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({
      contract_id: contract.id, stripe_object_id: objectId, stripe_invoice_id: invoiceId,
      stripe_payment_intent_id: paymentIntentId, billing_kind: kind,
      amount_paid: toDollars(amountCents), currency: String(currency || contract.currency).toUpperCase(), paid_at: paidAt
    })
  });
  const history = await dbRequest(config, `crm_payments?contract_id=eq.${encodeURIComponent(contract.id)}&select=amount_paid,billing_kind,stripe_invoice_id&order=paid_at.desc&limit=1000`);
  const paidTotal = (history || []).reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);
  const installments = (history || []).filter((item) => item.billing_kind === 'setup_installment' && item.stripe_invoice_id).length;
  return { paidTotal: Math.round(paidTotal * 100) / 100, installments, inserted: Boolean(insertedRows?.length) };
}

async function sendOnboardingEmail(contract, kind) {
  const setupNote = kind === 'setup_installment'
    ? 'Your first setup installment is confirmed. The remaining setup installments will be billed monthly as agreed.'
    : 'Your setup payment is confirmed.';
  const text = `Hi ${contract.client_contact},\n\nWelcome to Arveno Growth. ${setupNote}\n\nOur team will follow up with the kickoff steps, access checklist, and setup timeline. Please reply to this email with any questions.\n\nArveno Growth`;
  const html = `<p>Hi ${String(contract.client_contact || '').replace(/[&<>"']/g, '')},</p><p>Welcome to Arveno Growth. ${setupNote}</p><p>Our team will follow up with the kickoff steps, access checklist, and setup timeline. Please reply to this email with any questions.</p><p>Arveno Growth</p>`;
  return sendTransactionalEmail({ to: [contract.client_email, process.env.MAIL_TO || 'info@arvenogrowth.com'], subject: `Welcome to Arveno Growth, ${contract.client_business}`, text, html });
}

export async function processStripeEvent(stripe, config, event) {
  const object = event.data?.object || {};
  if (event.type === 'checkout.session.async_payment_succeeded') {
    if (object.payment_status !== 'paid' || object.mode !== 'payment' || !object.payment_intent) return;
    const paymentIntent = await stripe.paymentIntents.retrieve(typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent.id);
    await processStripeEvent(stripe, config, { type: 'payment_intent.succeeded', data: { object: paymentIntent } });
    return;
  }
  if (event.type === 'checkout.session.async_payment_failed') {
    const contract = await contractById(config, contractIdFrom(object));
    if (!contract) return;
    const role = object.metadata?.billing_role;
    if (['setup_full', 'setup_installment'].includes(role)) {
      await updateContract(config, contract.id, { setup_payment_status: 'failed', onboarding_status: 'payment_issue' });
    } else if (role === 'service_monthly') {
      await updateContract(config, contract.id, { onboarding_status: 'payment_issue' });
    }
    return;
  }
  if (event.type === 'payment_intent.succeeded') {
    if (object.metadata?.billing_role !== 'setup_full') return;
    const contract = await contractById(config, contractIdFrom(object));
    if (!contract) throw new Error('Contract for setup payment was not found.');
    const recorded = await recordPayment(config, {
      contract, objectId: object.id, paymentIntentId: object.id, kind: 'setup_full',
      amountCents: object.amount_received || object.amount, currency: object.currency,
      paidAt: new Date((object.created || Math.floor(Date.now() / 1000)) * 1000).toISOString()
    });
    await updateContract(config, contract.id, {
      stripe_customer_id: typeof object.customer === 'string' ? object.customer : contract.stripe_customer_id,
      setup_payment_status: 'paid', stripe_paid_total: recorded.paidTotal,
      stripe_last_payment_at: new Date().toISOString(), onboarding_status: 'onboarding'
    });
    if (recorded.inserted) {
      try { await sendOnboardingEmail(contract, 'setup_full'); } catch (error) { console.error('[stripe-webhook] onboarding email failed:', error?.message || error); }
    }
    return;
  }

  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    const subscriptionId = object.subscription || object.parent?.subscription_details?.subscription;
    if (!subscriptionId) return;
    const subscription = await stripe.subscriptions.retrieve(typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id);
    const metadata = subscription.metadata || {};
    const contract = await contractById(config, metadata.contract_id);
    if (!contract) return;
    const role = metadata.billing_role;
    if (event.type === 'invoice.payment_failed') {
      await updateContract(config, contract.id, { stripe_subscription_id: subscription.id, stripe_subscription_status: 'past_due', onboarding_status: 'payment_issue' });
      const due = Number(object.amount_due || 0) / 100;
      const currency = String(object.currency || contract.currency).toUpperCase();
      const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(due);
      try {
        await sendTransactionalEmail({
          to: [contract.client_email, process.env.MAIL_TO || 'info@arvenogrowth.com'],
          subject: `Payment needs attention for ${contract.client_business}`,
          text: `Hi ${contract.client_contact},\n\nStripe could not collect ${amount} for your Arveno Growth agreement. Please use the invoice link to update payment details: ${object.hosted_invoice_url || 'reply to this email and our team will help.'}\n\nArveno Growth`,
          html: `<p>Hi ${String(contract.client_contact || '').replace(/[&<>"']/g, '')},</p><p>Stripe could not collect ${amount} for your Arveno Growth agreement. Please use the invoice link to update payment details: <a href="${String(object.hosted_invoice_url || '#').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">Review invoice</a>.</p><p>Arveno Growth</p>`
        });
      } catch (error) { console.error('[stripe-webhook] payment notice failed:', error?.message || error); }
      return;
    }
    if (!['setup_installment', 'service_monthly'].includes(role)) return;
    const invoiceId = object.id;
    const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id || null;
    const recorded = await recordPayment(config, {
      contract, objectId: invoiceId, invoiceId, paymentIntentId,
      kind: role, amountCents: object.amount_paid, currency: object.currency,
      paidAt: new Date((object.created || Math.floor(Date.now() / 1000)) * 1000).toISOString()
    });
    const fields = {
      stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : contract.stripe_customer_id,
      stripe_subscription_id: subscription.id, stripe_subscription_status: subscription.status,
      stripe_paid_total: recorded.paidTotal, stripe_last_payment_at: new Date().toISOString()
    };
    if (role === 'setup_installment') {
      fields.setup_installments_paid = Math.min(3, recorded.installments);
      fields.setup_payment_status = recorded.installments >= 3 ? 'paid' : 'partial';
      fields.onboarding_status = 'onboarding';
      if (recorded.installments >= 3 && subscription.status === 'active' && !subscription.cancel_at_period_end) {
        await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });
      }
      if (recorded.installments === 1) {
        try { await sendOnboardingEmail(contract, 'setup_installment'); } catch (error) { console.error('[stripe-webhook] onboarding email failed:', error?.message || error); }
      }
    } else {
      fields.onboarding_status = 'active';
      fields.setup_completed_at = contract.setup_completed_at || new Date().toISOString();
    }
    await updateContract(config, contract.id, fields);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const id = contractIdFrom(object);
    const contract = await contractById(config, id);
    if (!contract) return;
    const fields = {};
    if (typeof object.customer === 'string') fields.stripe_customer_id = object.customer;
    if (object.mode === 'subscription' && typeof object.subscription === 'string') {
      fields.stripe_subscription_id = object.subscription;
      fields.stripe_subscription_status = 'pending_payment';
    }
    if (Object.keys(fields).length) await updateContract(config, contract.id, fields);
    return;
  }

  if (event.type === 'charge.refunded') {
    const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
    if (!paymentIntentId) return;
    const sourceRows = await dbRequest(config, `crm_payments?stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&select=contract_id,billing_kind,stripe_invoice_id&limit=1`);
    const source = sourceRows?.[0];
    const contract = source ? await contractById(config, source.contract_id) : null;
    if (!contract) return;
    const priorRefunds = await dbRequest(config, `crm_payments?contract_id=eq.${encodeURIComponent(contract.id)}&stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&billing_kind=eq.refund&select=amount_paid&limit=100`);
    const alreadyRefundedCents = Math.round((priorRefunds || []).reduce((sum, row) => sum + Math.abs(Number(row.amount_paid || 0)), 0) * 100);
    const deltaCents = Math.max(0, Number(object.amount_refunded || 0) - alreadyRefundedCents);
    if (!deltaCents) return;
    const recorded = await recordPayment(config, {
      contract, objectId: `refund:${event.id}`, invoiceId: source.stripe_invoice_id,
      paymentIntentId, kind: 'refund', amountCents: -deltaCents, currency: object.currency,
      paidAt: new Date().toISOString()
    });
    const fullyRefunded = Number(object.amount_refunded || 0) >= Number(object.amount || 0);
    await updateContract(config, contract.id, {
      stripe_paid_total: recorded.paidTotal, stripe_last_payment_at: new Date().toISOString(),
      ...(fullyRefunded && source.billing_kind === 'setup_full' ? { setup_payment_status: 'refunded', onboarding_status: 'payment_issue' } : {})
    });
    return;
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const contract = await contractById(config, contractIdFrom(object));
    if (!contract) return;
    const status = event.type === 'customer.subscription.deleted' ? 'canceled' : object.status;
    const role = object.metadata?.billing_role;
    await updateContract(config, contract.id, {
      stripe_subscription_id: object.id,
      stripe_subscription_status: status,
      ...(status === 'past_due' ? { onboarding_status: 'payment_issue' } : {}),
      ...(status === 'active' && role === 'service_monthly' ? { onboarding_status: 'active' } : {}),
      ...(status === 'canceled' && role === 'service_monthly' ? { onboarding_status: 'inactive' } : {})
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respond(res, 405, { error: 'Method not allowed.' });
  }
  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const config = serviceConfig();
  if (!signingSecret || !secretKey || !config) return respond(res, 503, { error: 'Stripe webhook is not configured.' });
  if (/^(sk|rk)_live_/.test(secretKey) && process.env.STRIPE_LIVE_MODE_ENABLED !== 'true') return respond(res, 503, { error: 'Live Stripe processing is disabled.' });
  const signature = req.headers?.['stripe-signature'];
  if (!signature) return respond(res, 400, { error: 'Missing Stripe signature.' });

  const stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 15000 });
  let event;
  try { event = stripe.webhooks.constructEvent(await rawBody(req), signature, signingSecret); }
  catch { return respond(res, 400, { error: 'Invalid webhook signature.' }); }

  const supported = new Set([
    'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed',
    'payment_intent.succeeded', 'invoice.paid', 'invoice.payment_failed',
    'customer.subscription.updated', 'customer.subscription.deleted', 'charge.refunded'
  ]);
  if (!supported.has(event.type)) return respond(res, 200, { received: true, ignored: true });

  try {
    const claimed = await dbRequest(config, 'crm_stripe_events?on_conflict=event_id', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ event_id: event.id, event_type: event.type })
    });
    if (!claimed?.length) return respond(res, 200, { received: true, duplicate: true });
    try { await processStripeEvent(stripe, config, event); }
    catch (error) {
      await dbRequest(config, `crm_stripe_events?event_id=eq.${encodeURIComponent(event.id)}`, { method: 'DELETE' }).catch(() => {});
      throw error;
    }
    return respond(res, 200, { received: true });
  } catch (error) {
    console.error('[stripe-webhook] event processing failed:', error?.message || error);
    return respond(res, 500, { error: 'Webhook event could not be processed.' });
  }
}
