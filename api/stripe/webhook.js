import Stripe from 'stripe';
import { dbRequest, json, serviceConfig } from '../../lib/crm.js';
import { sendTransactionalEmail } from '../../lib/transactional-email.js';
import { createServiceSubscription } from '../../lib/stripe.js';

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
  const rows = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(id)}&select=id,client_id,reference,client_business,client_contact,client_email,currency,setup_fee,monthly_fee,status,agreement,setup_payment_status,setup_installments_paid,setup_started_at,setup_due_at,setup_completed_at,stripe_customer_id,stripe_payment_method_id,stripe_setup_checkout_session_id,stripe_setup_subscription_id,stripe_setup_subscription_status,stripe_subscription_id,stripe_subscription_status,stripe_subscription_end_at,stripe_current_monthly_fee,stripe_latest_invoice_id,onboarding_status`);
  return rows?.[0] || null;
}

async function updateContract(config, id, fields) {
  await dbRequest(config, `contracts?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(fields)
  });
}

async function syncStripeCustomer(config, contract, customerId) {
  if (!customerId || !contract.client_id) return;
  await dbRequest(config, `clients?id=eq.${encodeURIComponent(contract.client_id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_customer_id: customerId })
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
  const history = await dbRequest(config, `crm_payments?contract_id=eq.${encodeURIComponent(contract.id)}&select=amount_paid,billing_kind,stripe_invoice_id,paid_at&order=paid_at.desc&limit=1000`);
  const paidTotal = (history || []).reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);
  const installments = (history || []).filter((item) => item.billing_kind === 'setup_installment' && item.stripe_invoice_id).length;
  const firstSetupPaidAt = (history || []).filter((item) => ['setup_full', 'setup_installment'].includes(item.billing_kind)).map((item) => item.paid_at).filter(Boolean).sort()[0] || paidAt;
  const servicePayments = (history || []).filter((item) => item.billing_kind === 'service_monthly' && item.stripe_invoice_id).length;
  return { paidTotal: Math.round(paidTotal * 100) / 100, installments, firstSetupPaidAt, servicePayments, inserted: Boolean(insertedRows?.length) };
}

async function sendOnboardingEmail(contract, kind) {
  const setupNote = kind === 'setup_installment'
    ? 'Your first setup installment is confirmed. The remaining setup installments will be billed monthly as agreed.'
    : 'Your setup payment is confirmed.';
  const text = `Hi ${contract.client_contact},\n\nWelcome to Arveno Growth. ${setupNote}\n\nOur team will follow up with the kickoff steps, access checklist, and setup timeline. Please reply to this email with any questions.\n\nArveno Growth`;
  const html = `<p>Hi ${String(contract.client_contact || '').replace(/[&<>"']/g, '')},</p><p>Welcome to Arveno Growth. ${setupNote}</p><p>Our team will follow up with the kickoff steps, access checklist, and setup timeline. Please reply to this email with any questions.</p><p>Arveno Growth</p>`;
  return sendTransactionalEmail({ to: [contract.client_email, process.env.MAIL_TO || 'info@arvenogrowth.com'], subject: `Welcome to Arveno Growth, ${contract.client_business}`, text, html });
}

async function startAutomaticServiceBilling(stripe, config, contract, { customerId, paymentMethodId, paidAt }) {
  if (Number(contract.agreement?.contractVersion || 0) < 7 || Number(contract.monthly_fee || 0) <= 0) return null;
  // A later setup installment must never silently resurrect a service
  // subscription the client or admin already canceled.
  if (contract.stripe_subscription_id && contract.stripe_subscription_status === 'canceled') return null;
  if (!customerId || !paymentMethodId) throw new Error('The signed contract is missing its saved Stripe customer or payment method.');
  const subscription = await createServiceSubscription(stripe, {
    ...contract,
    stripe_customer_id: customerId,
    stripe_payment_method_id: paymentMethodId,
    setup_payment_status: Number(contract.setup_fee || 0) <= 0 ? 'not_required' : contract.setup_payment_status,
    setup_installments_paid: Math.max(Number(contract.setup_installments_paid || 0), Number(contract.setup_fee || 0) > 0 ? 1 : 0)
  }, { trialStartAt: paidAt });
  const setupStartedAt = contract.setup_started_at || new Date(paidAt).toISOString();
  const setupDueAt = contract.setup_due_at || new Date(Date.parse(setupStartedAt) + 14 * 24 * 60 * 60 * 1000).toISOString();
  await updateContract(config, contract.id, {
    stripe_customer_id: customerId,
    stripe_payment_method_id: paymentMethodId,
    stripe_subscription_id: subscription.id,
    stripe_subscription_status: subscription.status,
    setup_started_at: setupStartedAt,
    setup_due_at: setupDueAt,
    onboarding_status: 'onboarding'
  });
  await syncStripeCustomer(config, contract, customerId);

  const addDays = (days) => {
    const date = new Date(Date.parse(setupStartedAt) + days * 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };
  const reminders = [
    { title: `Setup progress check — ${contract.client_business || contract.reference}`, due_at: addDays(7), priority: 'normal', details: `Contract ${contract.reference}: check access, kickoff items, and progress before the 14-day setup deadline. Started ${setupStartedAt}.` },
    { title: `Review setup deadline — ${contract.client_business || contract.reference}`, due_at: addDays(14), priority: 'high', details: `Contract ${contract.reference}: confirm setup completion within 14 days of the first successful setup payment. Monthly billing remains scheduled automatically and is not blocked by this review. Subscription ${subscription.id}.` }
  ];
  for (const reminder of reminders) {
    const match = await dbRequest(config, `crm_tasks?title=eq.${encodeURIComponent(reminder.title)}&details=eq.${encodeURIComponent(reminder.details)}&select=id&limit=1`);
    if (!match?.length) await dbRequest(config, 'crm_tasks', {
      method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(reminder)
    });
  }
  return subscription;
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
    if (object.metadata?.billing_role === 'reservation_deposit') {
      const depositId = object.metadata?.reservation_deposit_id;
      if (depositId && object.id) await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(depositId)}&stripe_checkout_session_id=eq.${encodeURIComponent(object.id)}&status=eq.checkout_pending`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'payment_failed' })
      });
      return;
    }
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
  if (event.type === 'checkout.session.expired') {
    if (object.metadata?.billing_role === 'reservation_deposit' && object.metadata?.reservation_deposit_id && object.id) {
      await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(object.metadata.reservation_deposit_id)}&stripe_checkout_session_id=eq.${encodeURIComponent(object.id)}&status=eq.checkout_pending`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'checkout_expired' })
      });
    }
    if (['setup_full', 'setup_installment'].includes(object.metadata?.billing_role)) {
      const contract = await contractById(config, contractIdFrom(object));
      if (contract?.stripe_setup_checkout_session_id === object.id) {
        await updateContract(config, contract.id, { stripe_setup_checkout_session_id: null, onboarding_status: 'signed' });
      }
    }
    return;
  }
  if (event.type === 'payment_intent.succeeded') {
    if (object.metadata?.billing_role === 'reservation_deposit') {
      const depositId = object.metadata?.reservation_deposit_id;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(depositId || ''))) throw new Error('Reservation deposit metadata is invalid.');
      const deposit = await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(depositId)}&client_id=eq.${encodeURIComponent(object.metadata.client_id || '')}&select=id,amount,currency,status&limit=1`);
      if (!deposit?.[0]) throw new Error('Reservation deposit for Stripe payment was not found.');
      const row = deposit[0];
      if (Math.round(Number(object.amount_received || object.amount || 0)) !== Math.round(Number(row.amount) * 100)
        || String(object.currency || '').toUpperCase() !== row.currency) throw new Error('Stripe reservation amount does not match the CRM deposit.');
      let depositStatus = 'paid';
      let refundedAt = null;
      const chargeId = typeof object.latest_charge === 'string' ? object.latest_charge : object.latest_charge?.id;
      if (chargeId) {
        const charge = await stripe.charges.retrieve(chargeId);
        if (Number(charge.amount_refunded || 0) >= Number(charge.amount || 0)) {
          depositStatus = 'refunded';
          refundedAt = new Date(Number(charge.refunds?.data?.at(-1)?.created || Date.now() / 1000) * 1000).toISOString();
        } else if (Number(charge.amount_refunded || 0) > 0) depositStatus = 'partially_refunded';
      }
      await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(row.id)}&status=in.(checkout_pending,paid,checkout_expired,checkout_failed)`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: depositStatus, stripe_payment_intent_id: object.id, paid_at: new Date(Number(event.created || object.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(), ...(refundedAt ? { refunded_at: refundedAt } : {}) })
      });
      const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;
      if (customerId && object.metadata.client_id) {
        await dbRequest(config, `clients?id=eq.${encodeURIComponent(object.metadata.client_id)}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_customer_id: customerId })
        });
        // A contract may have been drafted before the deposit completed. Link
        // the new customer only where no Stripe customer has been assigned yet.
        await dbRequest(config, `contracts?client_id=eq.${encodeURIComponent(object.metadata.client_id)}&stripe_customer_id=is.null`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_customer_id: customerId })
        });
      }
      return;
    }
    if (object.metadata?.billing_role !== 'setup_full') return;
    const contract = await contractById(config, contractIdFrom(object));
    if (!contract) throw new Error('Contract for setup payment was not found.');
    const paidAt = new Date(Number(event.created || object.created || Math.floor(Date.now() / 1000)) * 1000).toISOString();
    const recorded = await recordPayment(config, {
      contract, objectId: object.id, paymentIntentId: object.id, kind: 'setup_full',
      amountCents: object.amount_received || object.amount, currency: object.currency,
      paidAt
    });
    const customerId = typeof object.customer === 'string' ? object.customer : contract.stripe_customer_id;
    const paymentMethodId = typeof object.payment_method === 'string' ? object.payment_method : object.payment_method?.id;
    await updateContract(config, contract.id, {
      stripe_customer_id: customerId,
      ...(paymentMethodId ? { stripe_payment_method_id: paymentMethodId } : {}),
      setup_payment_status: 'paid', stripe_paid_total: recorded.paidTotal,
      stripe_last_payment_at: new Date().toISOString(),
      onboarding_status: contract.stripe_subscription_status === 'canceled' ? 'inactive' : 'onboarding'
    });
    await syncStripeCustomer(config, contract, customerId);
    await startAutomaticServiceBilling(stripe, config, {
      ...contract, setup_payment_status: 'paid', setup_installments_paid: Math.max(1, Number(contract.setup_installments_paid || 0))
    }, { customerId, paymentMethodId, paidAt });
    if (recorded.inserted) {
      try { await sendOnboardingEmail(contract, 'setup_full'); } catch (error) { console.error('[stripe-webhook] onboarding email failed:', error?.message || error); }
    }
    return;
  }

  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed' || event.type === 'invoice.payment_action_required') {
    const subscriptionId = object.subscription || object.parent?.subscription_details?.subscription;
    if (!subscriptionId) return;
    const subscription = await stripe.subscriptions.retrieve(typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id);
    const metadata = subscription.metadata || {};
    const contract = await contractById(config, metadata.contract_id);
    if (!contract) return;
    const role = metadata.billing_role;
    if (event.type === 'invoice.payment_failed' || event.type === 'invoice.payment_action_required') {
      await updateContract(config, contract.id, {
        ...(role === 'setup_installment'
          ? { stripe_setup_subscription_id: subscription.id, stripe_setup_subscription_status: subscription.status }
          : { stripe_subscription_id: subscription.id, stripe_subscription_status: subscription.status }),
        stripe_latest_invoice_id: object.id,
        stripe_latest_invoice_url: object.hosted_invoice_url || null,
        onboarding_status: 'payment_issue'
      });
      const due = Number(object.amount_due || 0) / 100;
      const currency = String(object.currency || contract.currency).toUpperCase();
      const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(due);
      const needsAuthentication = event.type === 'invoice.payment_action_required';
      const paymentInstruction = needsAuthentication
        ? 'Stripe needs you to authenticate this payment. Open the secure invoice link to complete the required verification.'
        : 'Stripe could not collect this payment. Open the secure invoice link to retry or update your payment method.';
      try {
        await sendTransactionalEmail({
          to: [contract.client_email, process.env.MAIL_TO || 'info@arvenogrowth.com'],
          subject: `${needsAuthentication ? 'Action required' : 'Payment needs attention'} for ${contract.client_business}`,
          text: `Hi ${contract.client_contact},\n\n${paymentInstruction} Amount due: ${amount}. ${object.hosted_invoice_url || 'Reply to this email and our team will help.'}\n\nArveno Growth`,
          html: `<p>Hi ${String(contract.client_contact || '').replace(/[&<>"']/g, '')},</p><p>${paymentInstruction} Amount due: ${amount}. <a href="${String(object.hosted_invoice_url || '#').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">Open secure Stripe invoice</a>.</p><p>Arveno Growth</p>`
        });
      } catch (error) { console.error('[stripe-webhook] payment notice failed:', error?.message || error); }
      return;
    }
    if (!['setup_installment', 'service_monthly'].includes(role)) return;
    // Stripe marks the initial zero-dollar invoice for a trial as paid. It
    // starts the trial, but it is not one of the contracted monthly charges.
    if (role === 'service_monthly' && Number(object.amount_paid || 0) === 0 && object.billing_reason === 'subscription_create') return;
    const invoiceId = object.id;
    const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id || null;
    const recorded = await recordPayment(config, {
      contract, objectId: invoiceId, invoiceId, paymentIntentId,
      kind: role, amountCents: object.amount_paid, currency: object.currency,
      paidAt: new Date(Number(object.status_transitions?.paid_at || event.created || object.created || Math.floor(Date.now() / 1000)) * 1000).toISOString()
    });
    const fields = {
      stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : contract.stripe_customer_id,
      ...(typeof subscription.default_payment_method === 'string'
        ? { stripe_payment_method_id: subscription.default_payment_method }
        : subscription.default_payment_method?.id
          ? { stripe_payment_method_id: subscription.default_payment_method.id }
          : {}),
      stripe_paid_total: recorded.paidTotal, stripe_last_payment_at: new Date().toISOString(),
      ...(contract.stripe_latest_invoice_id === invoiceId ? { stripe_latest_invoice_id: null, stripe_latest_invoice_url: null } : {})
    };
    if (role === 'setup_installment') {
      fields.stripe_setup_subscription_id = subscription.id;
      fields.stripe_setup_subscription_status = subscription.status;
      fields.setup_installments_paid = Math.min(3, recorded.installments);
      fields.setup_payment_status = recorded.installments >= 3 ? 'paid' : 'partial';
      fields.onboarding_status = contract.stripe_subscription_status === 'canceled' ? 'inactive' : 'onboarding';
      if (recorded.installments >= 3 && subscription.status === 'active' && !subscription.cancel_at_period_end) {
        await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });
      }
      if (recorded.installments === 1) {
        try { await sendOnboardingEmail(contract, 'setup_installment'); } catch (error) { console.error('[stripe-webhook] onboarding email failed:', error?.message || error); }
      }
      const paymentMethodId = typeof subscription.default_payment_method === 'string'
        ? subscription.default_payment_method : subscription.default_payment_method?.id;
      await startAutomaticServiceBilling(stripe, config, {
        ...contract, setup_payment_status: 'partial', setup_installments_paid: Math.max(1, recorded.installments)
      }, {
        customerId: typeof subscription.customer === 'string' ? subscription.customer : contract.stripe_customer_id,
        paymentMethodId,
        paidAt: recorded.firstSetupPaidAt
      });
    } else {
      fields.stripe_subscription_id = subscription.id;
      fields.stripe_subscription_status = subscription.status;
      fields.onboarding_status = 'active';
      const commitmentMonths = Number(metadata.commitment_months || 0);
      if (commitmentMonths > 0 && recorded.servicePayments >= commitmentMonths && subscription.status === 'active' && !subscription.cancel_at_period_end) {
        const ending = await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });
        const endAt = ending.cancel_at || ending.current_period_end || subscription.current_period_end;
        fields.stripe_subscription_end_at = endAt ? new Date(Number(endAt) * 1000).toISOString() : null;
      }
    }
    await updateContract(config, contract.id, fields);
    await syncStripeCustomer(config, contract, fields.stripe_customer_id);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const id = contractIdFrom(object);
    const contract = await contractById(config, id);
    if (!contract) return;
    const fields = {};
    let completedSetupIntent = null;
    if (typeof object.customer === 'string') fields.stripe_customer_id = object.customer;
    const setupIntentId = typeof object.setup_intent === 'string' ? object.setup_intent : object.setup_intent?.id;
    if (object.mode === 'setup' && setupIntentId) {
      completedSetupIntent = await stripe.setupIntents.retrieve(setupIntentId);
      const paymentMethodId = typeof completedSetupIntent.payment_method === 'string' ? completedSetupIntent.payment_method : completedSetupIntent.payment_method?.id;
      if (completedSetupIntent.status === 'succeeded' && paymentMethodId) fields.stripe_payment_method_id = paymentMethodId;
      if (Number(contract.setup_fee || 0) <= 0) fields.setup_payment_status = 'not_required';
    }
    if (object.mode === 'subscription' && typeof object.subscription === 'string') {
      if (object.metadata?.billing_role === 'setup_installment') {
        const subscription = await stripe.subscriptions.retrieve(object.subscription);
        const paymentMethodId = typeof subscription.default_payment_method === 'string'
          ? subscription.default_payment_method : subscription.default_payment_method?.id;
        fields.stripe_setup_subscription_id = object.subscription;
        fields.stripe_setup_subscription_status = 'pending_payment';
        if (paymentMethodId) fields.stripe_payment_method_id = paymentMethodId;
      } else {
        fields.stripe_subscription_id = object.subscription;
        fields.stripe_subscription_status = 'pending_payment';
      }
    }
    if (Object.keys(fields).length) await updateContract(config, contract.id, fields);
    await syncStripeCustomer(config, contract, fields.stripe_customer_id);
    if (object.mode === 'setup' && object.status === 'complete' && fields.stripe_payment_method_id && Number(contract.setup_fee || 0) <= 0) {
      const paidAt = new Date(Number(event.created || completedSetupIntent?.created || Math.floor(Date.now() / 1000)) * 1000).toISOString();
      await startAutomaticServiceBilling(stripe, config, {
        ...contract, setup_payment_status: 'not_required', setup_installments_paid: 0
      }, {
        customerId: fields.stripe_customer_id || contract.stripe_customer_id,
        paymentMethodId: fields.stripe_payment_method_id,
        paidAt
      });
    }
    return;
  }

  if (event.type === 'charge.refunded') {
    const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
    if (!paymentIntentId) return;
    const depositRows = await dbRequest(config, `crm_reservation_deposits?stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&select=id,status&limit=1`);
    if (depositRows?.[0]) {
      const fullyRefunded = Number(object.amount_refunded || 0) >= Number(object.amount || 0);
      await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(depositRows[0].id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: fullyRefunded ? 'refunded' : 'partially_refunded', refund_previous_status: null, ...(fullyRefunded ? { refunded_at: new Date().toISOString() } : {}) })
      });
      return;
    }
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
    await syncStripeCustomer(config, contract, typeof object.customer === 'string' ? object.customer : '');
    return;
  }

  if (['refund.failed', 'refund.updated'].includes(event.type)
    && ['failed', 'canceled'].includes(object.status)
    && object.metadata?.billing_role === 'reservation_deposit' && object.metadata?.reservation_deposit_id) {
    const id = object.metadata.reservation_deposit_id;
    const deposits = await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(id)}&status=eq.refund_pending&select=id,refund_previous_status`);
    const deposit = deposits?.[0];
    if (deposit) await dbRequest(config, `crm_reservation_deposits?id=eq.${encodeURIComponent(id)}&status=eq.refund_pending`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: deposit.refund_previous_status || 'paid', refund_previous_status: null })
    });
    return;
  }

  if (event.type === 'charge.succeeded') {
    const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
    if (!paymentIntentId || !object.receipt_url) return;
    const matching = await dbRequest(config, `crm_payments?stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&select=id&limit=1`);
    if (matching?.length) {
      await dbRequest(config, `crm_payments?stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ receipt_url: object.receipt_url })
      });
      return;
    }
    const deposit = await dbRequest(config, `crm_reservation_deposits?stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&select=id&limit=1`);
    if (!deposit?.length) throw new Error(`Payment record for Stripe PaymentIntent ${paymentIntentId} is not ready for receipt sync.`);
    await dbRequest(config, `crm_reservation_deposits?stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ receipt_url: object.receipt_url })
    });
    return;
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const contract = await contractById(config, contractIdFrom(object));
    if (!contract) return;
    const status = event.type === 'customer.subscription.deleted' ? 'canceled' : object.status;
    const role = object.metadata?.billing_role;
    const currentMonthlyFee = (object.items?.data || []).reduce((total, item) => {
      const interval = item.price?.recurring?.interval || item.plan?.interval;
      if (interval !== 'month') return total;
      const unitAmount = item.price?.unit_amount ?? item.plan?.amount;
      return total + (Number(unitAmount || 0) * Number(item.quantity || 1)) / 100;
    }, 0);
    await updateContract(config, contract.id, {
        ...(role === 'setup_installment'
        ? { stripe_setup_subscription_id: object.id, stripe_setup_subscription_status: status }
        : {
          stripe_subscription_id: object.id, stripe_subscription_status: status,
          stripe_subscription_end_at: status === 'canceled'
            ? (object.canceled_at ? new Date(Number(object.canceled_at) * 1000).toISOString() : contract.stripe_subscription_end_at)
            : object.cancel_at_period_end && (object.cancel_at || object.current_period_end)
              ? new Date(Number(object.cancel_at || object.current_period_end) * 1000).toISOString()
              : null
        }),
      ...(role === 'service_monthly' && currentMonthlyFee > 0 ? { stripe_current_monthly_fee: Math.round(currentMonthlyFee * 100) / 100 } : {}),
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
    'checkout.session.completed', 'checkout.session.expired', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed',
    'payment_intent.succeeded', 'invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required',
    'customer.subscription.updated', 'customer.subscription.deleted', 'charge.succeeded', 'charge.refunded', 'refund.failed', 'refund.updated'
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
