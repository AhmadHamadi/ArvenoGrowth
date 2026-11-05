import { dbRequest, handlerError, json, requireAdmin } from '../../lib/crm.js';
import { createContractCheckout, createServiceSubscription, stripeClient } from '../../lib/stripe.js';
import { sendTransactionalEmail } from '../../lib/transactional-email.js';
import { reservationDepositsHandler } from '../../lib/reservation-deposits.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const centsText = (amount, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount || 0));

async function otherActiveService(config, contract) {
  if (!contract.client_id) return null;
  const rows = await dbRequest(config, `contracts?client_id=eq.${encodeURIComponent(contract.client_id)}&stripe_subscription_status=in.(active,trialing)&select=id,reference&limit=10`);
  return (rows || []).find((row) => row.id !== contract.id) || null;
}

function billingOrigin() {
  if (process.env.VERCEL_ENV === 'preview') {
    if (!process.env.VERCEL_URL) throw Object.assign(new Error('Preview billing URL is unavailable.'), { status: 503 });
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.PUBLIC_SITE_URL || 'https://www.arvenogrowth.com';
}

async function completeSetupTasks(config, reference) {
  const filter = encodeURIComponent(`*Contract ${reference}:*`);
  const tasks = await dbRequest(config, `crm_tasks?details=ilike.${filter}&status=neq.done&select=id`);
  for (const task of tasks || []) await dbRequest(config, `crm_tasks?id=eq.${encodeURIComponent(task.id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'done', completed_at: new Date().toISOString() })
  });
}

export default async function handler(req, res) {
  try {
    const config = await requireAdmin(req);
    if (req.query?.resource === 'deposits') return reservationDepositsHandler(req, res, config);
    if (req.method === 'GET') {
      const query = req.query?.contractId ? `&contract_id=eq.${encodeURIComponent(req.query.contractId)}` : '';
      const payments = await dbRequest(config, `crm_payments?select=id,contract_id,stripe_object_id,stripe_payment_intent_id,stripe_invoice_id,billing_kind,amount_paid,currency,paid_at,receipt_url&order=paid_at.desc&limit=1000${query}`);
      return json(res, 200, { payments: payments || [] });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return json(res, 405, { error: 'Method not allowed.' });
    }

    const contractId = String(req.body?.contractId || '');
    const action = String(req.body?.action || '');
    if (!UUID.test(contractId)) return json(res, 400, { error: 'A valid contract is required.' });
    const found = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(contractId)}&select=*`);
    const contract = found?.[0];
    if (!contract) return json(res, 404, { error: 'Contract not found.' });
    if (contract.status !== 'signed') return json(res, 409, { error: 'A client must sign the agreement before billing can be started.' });

    if (action === 'mark_setup_complete') {
      if (contract.setup_completed_at) return json(res, 409, { error: 'Setup is already marked complete.' });
      const version = Number(contract.agreement?.contractVersion || 0);
      const noSetupFee = Number(contract.setup_fee || 0) <= 0;
      const hasSetupPayment = ['paid', 'partial', 'not_required'].includes(contract.setup_payment_status)
        || (noSetupFee && Boolean(contract.stripe_payment_method_id));
      if (!contract.setup_started_at && !hasSetupPayment) return json(res, 409, { error: 'Setup can be marked complete after the first setup payment or saved-card setup.' });
      const setupPayments = contract.setup_started_at ? [] : await dbRequest(config, `crm_payments?contract_id=eq.${encodeURIComponent(contractId)}&billing_kind=in.(setup_full,setup_installment)&order=paid_at.asc&select=paid_at&limit=1`);
      const setupStartedAt = contract.setup_started_at || (setupPayments?.[0]?.paid_at) || contract.stripe_last_payment_at || new Date().toISOString();
      const setupDueAt = contract.setup_due_at || new Date(Date.parse(setupStartedAt) + 14 * 24 * 60 * 60 * 1000).toISOString();
      if (version < 7) {
        const existingService = Number(contract.monthly_fee || 0) > 0 ? await otherActiveService(config, contract) : null;
        if (existingService) return json(res, 409, { error: `This client already has active monthly billing on ${existingService.reference || 'another signed agreement'}. Resolve that subscription before starting another to avoid duplicate charges.` });
      }
      const completedAt = contract.setup_completed_at || new Date().toISOString();
      const updated = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(contractId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ setup_payment_status: noSetupFee ? 'not_required' : contract.setup_payment_status, setup_started_at: setupStartedAt, setup_due_at: setupDueAt, setup_completed_at: completedAt, onboarding_status: version >= 7 ? 'setup_complete' : 'onboarding' })
      });
      await completeSetupTasks(config, contract.reference);
      if (version >= 7) return json(res, 200, { contract: updated?.[0], setupComplete: true, setupCompletedAt: completedAt, billingScheduled: Boolean(contract.stripe_subscription_id) });
      if (Number(contract.monthly_fee || 0) > 0 && version < 6) {
        const service = await createServiceSubscription(stripeClient(), { ...contract, setup_completed_at: completedAt });
        await dbRequest(config, `contracts?id=eq.${encodeURIComponent(contractId)}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ stripe_subscription_id: service.id, stripe_subscription_status: service.status })
        });
        return json(res, 200, { contract: { ...updated?.[0], stripe_subscription_id: service.id, stripe_subscription_status: service.status }, billingStarted: true, subscriptionStatus: service.status });
      }
      return json(res, 200, { contract: updated?.[0], setupComplete: true, setupCompletedAt: completedAt, billingStarted: false, monthlyCheckoutRequired: version >= 6 && Number(contract.monthly_fee || 0) > 0 });
    }

    if (!['setup', 'service', 'payment_method'].includes(action)) return json(res, 400, { error: 'Choose setup billing, payment method setup, or monthly service billing.' });
    if (action === 'service') {
      if (Number(contract.agreement?.contractVersion || 0) >= 7) return json(res, 409, { error: 'This agreement starts recurring billing automatically 14 days after the first successful setup payment (or saved-card setup when no setup fee is due). Do not create a separate monthly checkout.' });
      if (Number(contract.agreement?.contractVersion || 0) >= 6) {
        if (contract.stripe_subscription_status === 'active') return json(res, 409, { error: 'Monthly service billing is already active.' });
        const existingService = await otherActiveService(config, contract);
        if (existingService) return json(res, 409, { error: `This client already has active monthly billing on ${existingService.reference || 'another signed agreement'}. Resolve that subscription before starting another to avoid duplicate charges.` });
      } else {
      if (!contract.setup_completed_at) return json(res, 409, { error: 'Mark setup complete before starting monthly billing.' });
      if (contract.stripe_subscription_status === 'active') return json(res, 409, { error: 'Monthly service billing is already active.' });
      const existingService = await otherActiveService(config, contract);
      if (existingService) return json(res, 409, { error: `This client already has active monthly billing on ${existingService.reference || 'another signed agreement'}. Resolve that subscription before starting another to avoid duplicate charges.` });
      const service = await createServiceSubscription(stripeClient(), contract);
      await dbRequest(config, `contracts?id=eq.${encodeURIComponent(contractId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ stripe_subscription_id: service.id, stripe_subscription_status: service.status })
      });
      return json(res, 200, { billingStarted: true, subscriptionStatus: service.status });
      }
    }
    const setupMode = action === 'setup' ? String(req.body?.setupMode || '') : undefined;
    if (action === 'payment_method' && (Number(contract.setup_fee || 0) !== 0 || Number(contract.monthly_fee || 0) <= 0)) return json(res, 409, { error: 'Payment method setup is only needed when the contract has no setup fee and a monthly fee.' });
    if (action === 'setup' && !['full', 'three_monthly'].includes(setupMode)) return json(res, 400, { error: 'Choose full payment or three monthly installments.' });
    const agreedSetupMode = contract.agreement?.setupPayment === 'threeMonthly' ? 'three_monthly' : 'full';
    if (action === 'setup' && setupMode !== agreedSetupMode) return json(res, 409, { error: 'The checkout option must match the setup schedule in the signed agreement.' });
    if (action === 'setup' && Number(contract.setup_fee) <= 0) return json(res, 409, { error: 'This contract has no setup fee to collect.' });
    if (action === 'setup' && ['paid', 'not_required'].includes(contract.setup_payment_status)) return json(res, 409, { error: 'The setup fee is already marked as paid.' });
    if (action === 'setup' && contract.setup_payment_status === 'partial') return json(res, 409, { error: 'Setup installments are already in progress. Do not create another setup checkout.' });
    const stripe = stripeClient();
    let checkoutContract = contract;
    const sharedCustomerRequired = Number(contract.agreement?.contractVersion || 0) >= 6 && ['setup', 'service'].includes(action);
    if ((action === 'payment_method' || sharedCustomerRequired) && !contract.stripe_customer_id) {
      const customer = await stripe.customers.create({
        name: contract.client_business, email: contract.client_email,
        metadata: { contract_id: contract.id, ...(contract.client_id ? { client_id: contract.client_id } : {}) }
      }, { idempotencyKey: `ag-customer-${contract.id}` });
      checkoutContract = { ...contract, stripe_customer_id: customer.id };
      await dbRequest(config, `contracts?id=eq.${encodeURIComponent(contractId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_customer_id: customer.id })
      });
      if (contract.client_id) await dbRequest(config, `clients?id=eq.${encodeURIComponent(contract.client_id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_customer_id: customer.id })
      });
    }
    const checkout = await createContractCheckout(stripe, {
      contract: checkoutContract, action: action === 'payment_method' ? 'setup' : action,
      setupMode: action === 'payment_method' ? 'card_only' : setupMode, origin: billingOrigin()
    });
    const billingSetupMode = action === 'payment_method' ? 'card_only' : setupMode;
    const patch = {
      [checkout.field]: checkout.session.id,
      ...(['setup', 'payment_method'].includes(action) ? { stripe_setup_mode: billingSetupMode, onboarding_status: 'setup_payment_pending' } : {})
    };
    await dbRequest(config, `contracts?id=eq.${encodeURIComponent(contractId)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch)
    });

    const label = action === 'service' ? 'monthly service subscription' : billingSetupMode === 'card_only' ? 'secure payment method setup' : billingSetupMode === 'full' ? 'setup fee in full' : 'three monthly setup installments';
    let emailSent = false;
    let emailWarning = '';
    try {
      const message = await sendTransactionalEmail({
        to: contract.client_email,
        subject: `Next step for ${contract.client_business}: ${label}`,
        text: `Hi ${contract.client_contact},\n\nYour agreement is signed. Use this secure Stripe Checkout link for the ${label}:\n${checkout.session.url}\n\nQuestions? Reply to this email or call ${process.env.PUBLIC_SITE_PHONE || '(289) 489-1167'}.\n\nArveno Growth`,
        html: `<p>Hi ${escapeHtml(contract.client_contact)},</p><p>Your agreement is signed. Use this secure Stripe Checkout link for the ${escapeHtml(label)}:</p><p><a href="${escapeHtml(checkout.session.url)}">Continue to secure checkout</a></p><p>Questions? Reply to this email or call ${escapeHtml(process.env.PUBLIC_SITE_PHONE || '(289) 489-1167')}.</p><p>Arveno Growth</p>`
      });
      emailSent = message.sent;
      if (!message.sent) emailWarning = message.reason;
    } catch (error) { emailWarning = error.message || 'The billing link was created, but the email could not be sent.'; }

    return json(res, 200, {
      checkoutUrl: checkout.session.url,
      checkoutSessionId: checkout.session.id,
      reused: checkout.reused,
      emailSent,
      emailWarning,
      amount: centsText(contract.setup_fee, contract.currency),
      currency: contract.currency
    });
  } catch (error) { return handlerError(res, error); }
}
