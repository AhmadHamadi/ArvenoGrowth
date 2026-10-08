import Stripe from 'stripe';

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw Object.assign(new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to the Vercel server environment.'), { status: 503 });
  if (/^(sk|rk)_live_/.test(key) && process.env.STRIPE_LIVE_MODE_ENABLED !== 'true') {
    throw Object.assign(new Error('Live Stripe billing is disabled. Validate the complete workflow in test mode first.'), { status: 503 });
  }
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 15000 });
}

const cents = (amount) => Math.round(Number(amount || 0) * 100);
const lowerCurrency = (value) => String(value || 'USD').toLowerCase();
const businessName = (contract) => String(contract.client_business || 'Client').slice(0, 120);

export function setupInstallments(setupFee) {
  const totalCents = cents(setupFee);
  const baseCents = Math.floor(totalCents / 3);
  const firstAdjustmentCents = totalCents - baseCents * 3;
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || baseCents < 1) {
    throw Object.assign(new Error('The setup fee must be at least three cents to split it into three monthly payments.'), { status: 400 });
  }
  return { totalCents, installmentCents: baseCents, firstAdjustmentCents };
}

export async function createContractCheckout(stripe, { contract, action, setupMode, origin }) {
  const currency = lowerCurrency(contract.currency);
  const name = businessName(contract);
  const metadata = { contract_id: contract.id, business_name: name };
  const successUrl = `${origin}/thank-you/?payment=received`;
  const cancelUrl = `${origin}/`;
  let params;
  let key;

  if (action === 'setup') {
    const amount = cents(contract.setup_fee);
    if (amount <= 0) throw Object.assign(new Error('This contract has no setup fee to collect.'), { status: 400 });
    key = 'stripe_setup_checkout_session_id';
    if (setupMode === 'full') {
      params = {
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { currency, unit_amount: amount, product_data: { name: `Setup fee — ${name}`, description: `Setup fee for contract ${contract.reference}` } } }],
        customer: contract.stripe_customer_id || undefined,
        customer_email: contract.stripe_customer_id ? undefined : contract.client_email,
        metadata: { ...metadata, billing_role: 'setup_full' },
        payment_intent_data: { metadata: { ...metadata, billing_role: 'setup_full' } },
        success_url: successUrl, cancel_url: cancelUrl
      };
    } else if (setupMode === 'three_monthly') {
      const split = setupInstallments(contract.setup_fee);
      const lines = [{ quantity: 1, price_data: { currency, unit_amount: split.installmentCents, recurring: { interval: 'month' }, product_data: { name: `Setup fee installment — ${name}`, description: `Installment 1 of 3 for contract ${contract.reference}` } } }];
      if (split.firstAdjustmentCents) lines.push({ quantity: 1, price_data: { currency, unit_amount: split.firstAdjustmentCents, product_data: { name: `Setup fee rounding adjustment — ${name}` } } });
      params = {
        mode: 'subscription', line_items: lines,
        customer: contract.stripe_customer_id || undefined,
        customer_email: contract.stripe_customer_id ? undefined : contract.client_email,
        metadata: { ...metadata, billing_role: 'setup_installment', installment_count: '3' },
        subscription_data: { metadata: { ...metadata, billing_role: 'setup_installment', installment_count: '3' } },
        success_url: successUrl, cancel_url: cancelUrl
      };
    } else throw Object.assign(new Error('Choose full payment or three monthly installments.'), { status: 400 });
  } else if (action === 'service') {
    const amount = cents(contract.monthly_fee);
    if (amount <= 0) throw Object.assign(new Error('This contract has no monthly service fee.'), { status: 400 });
    if (!contract.setup_completed_at || !['paid', 'not_required'].includes(contract.setup_payment_status)) {
      throw Object.assign(new Error('Mark setup complete and confirm the setup fee is paid before starting monthly billing.'), { status: 409 });
    }
    key = 'stripe_service_checkout_session_id';
    params = {
      mode: 'subscription',
      line_items: [{ quantity: 1, price_data: { currency, unit_amount: amount, recurring: { interval: 'month' }, product_data: { name: `Monthly service — ${name}`, description: `${contract.package_name || 'Marketing services'} · contract ${contract.reference}` } } }],
      customer: contract.stripe_customer_id || undefined,
      customer_email: contract.stripe_customer_id ? undefined : contract.client_email,
      metadata: { ...metadata, billing_role: 'service_monthly', contract_term: String(contract.agreement?.term || '') },
      subscription_data: { metadata: { ...metadata, billing_role: 'service_monthly', contract_term: String(contract.agreement?.term || '') } },
      success_url: successUrl, cancel_url: cancelUrl
    };
  } else throw Object.assign(new Error('Unknown billing action.'), { status: 400 });

  const previousId = contract[key];
  if (previousId) {
    if (action === 'setup' && contract.stripe_setup_mode && contract.stripe_setup_mode !== setupMode) {
      throw Object.assign(new Error('A setup checkout link already exists with a different payment option. Let that link expire before creating another.'), { status: 409 });
    }
    const previous = await stripe.checkout.sessions.retrieve(previousId).catch(() => null);
    if (previous?.status === 'open' && previous.url) return { session: previous, reused: true, field: key, setupMode };
    if (previous?.status === 'complete') throw Object.assign(new Error('This checkout has already been completed. Refresh the CRM to see the updated payment status.'), { status: 409 });
  }

  const idempotencyKey = `ag-${action}-${setupMode || 'monthly'}-${contract.id}-${Date.now()}`;
  const session = await stripe.checkout.sessions.create(params, { idempotencyKey });
  return { session, reused: false, field: key, setupMode };
}
