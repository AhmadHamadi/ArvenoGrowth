import Stripe from 'stripe';

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw Object.assign(new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to the Vercel server environment.'), { status: 503 });
  if (/^(sk|rk)_live_/.test(key) && process.env.STRIPE_LIVE_MODE_ENABLED !== 'true') {
    throw Object.assign(new Error('Live Stripe billing is disabled. Validate the complete workflow in test mode first.'), { status: 503 });
  }
  if (process.env.VERCEL_ENV === 'preview' && !/^(sk|rk)_test_/.test(key)) {
    throw Object.assign(new Error('Preview billing only accepts Stripe test-mode keys.'), { status: 503 });
  }
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 15000 });
}

const cents = (amount) => Math.round(Number(amount || 0) * 100);
const lowerCurrency = (value) => String(value || 'USD').toLowerCase();
const businessName = (contract) => String(contract.client_business || 'Client').slice(0, 120);

export function serviceCommitmentCycles(contract) {
  if (Number(contract.agreement?.contractVersion || 0) < 4) return null;
  const term = String(contract.agreement?.term || '').trim();
  if (term.toLowerCase() === 'month-to-month') return null;
  const match = term.match(/^(\d+)\s+months?$/i);
  if (!match || Number(match[1]) < 1) {
    throw Object.assign(new Error('Choose the signed monthly commitment before starting recurring billing.'), { status: 409 });
  }
  return Number(match[1]);
}

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
  const formatMoney = (value) => new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: String(contract.currency || 'USD').toUpperCase(), currencyDisplay: 'code'
  }).format(Number(value || 0));
  const customerParams = contract.stripe_customer_id
    ? { customer: contract.stripe_customer_id }
    : { customer_email: contract.client_email };

  if (action === 'setup') {
    const amount = cents(contract.setup_fee);
    key = 'stripe_setup_checkout_session_id';
    if (setupMode === 'card_only' && amount === 0) {
      params = {
        mode: 'setup', customer: contract.stripe_customer_id,
        metadata: { ...metadata, billing_role: 'service_payment_method' },
        setup_intent_data: { usage: 'off_session', metadata: { ...metadata, billing_role: 'service_payment_method' } },
        success_url: successUrl, cancel_url: cancelUrl
      };
    } else if (setupMode === 'full' && amount > 0) {
      params = {
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { currency, unit_amount: amount, product_data: { name: `Setup fee — ${name}`, description: `Setup fee for contract ${contract.reference}` } } }],
        ...customerParams, ...(!contract.stripe_customer_id ? { customer_creation: 'always' } : {}),
        metadata: { ...metadata, billing_role: 'setup_full' },
        payment_intent_data: { setup_future_usage: 'off_session', metadata: { ...metadata, billing_role: 'setup_full' } },
        success_url: successUrl, cancel_url: cancelUrl
      };
    } else if (setupMode === 'three_monthly' && amount > 0) {
      const split = setupInstallments(contract.setup_fee);
      const lines = [{ quantity: 1, price_data: { currency, unit_amount: split.installmentCents, recurring: { interval: 'month' }, product_data: { name: `Setup fee installment — ${name}`, description: `Installment 1 of 3 for contract ${contract.reference}` } } }];
      if (split.firstAdjustmentCents) lines.push({ quantity: 1, price_data: { currency, unit_amount: split.firstAdjustmentCents, product_data: { name: `Setup fee rounding adjustment — ${name}` } } });
      params = {
        mode: 'subscription', line_items: lines,
        ...customerParams,
        metadata: { ...metadata, billing_role: 'setup_installment', installment_count: '3' },
        subscription_data: { metadata: { ...metadata, billing_role: 'setup_installment', installment_count: '3' }, payment_settings: { save_default_payment_method: 'on_subscription' } },
        success_url: successUrl, cancel_url: cancelUrl
      };
    } else throw Object.assign(new Error(amount > 0 ? 'Choose full payment or three monthly installments.' : 'The setup payment option does not match the setup fee.'), { status: 400 });
  } else if (action === 'service') {
    const amount = cents(contract.monthly_fee);
    if (amount <= 0) throw Object.assign(new Error('This contract has no monthly service fee.'), { status: 400 });
    key = 'stripe_service_checkout_session_id';
    const commitmentCycles = serviceCommitmentCycles(contract);
    params = {
      mode: 'subscription',
      line_items: [{ quantity: 1, price_data: { currency, unit_amount: amount, recurring: { interval: 'month' }, product_data: { name: `Monthly service — ${name}`, description: `${contract.package_name || 'Marketing services'} · contract ${contract.reference}` } } }],
      ...customerParams,
      metadata: { ...metadata, billing_role: 'service_monthly', contract_term: String(contract.agreement?.term || ''), ...(commitmentCycles ? { commitment_months: String(commitmentCycles) } : {}) },
      subscription_data: { metadata: { ...metadata, billing_role: 'service_monthly', contract_term: String(contract.agreement?.term || ''), ...(commitmentCycles ? { commitment_months: String(commitmentCycles) } : {}) }, payment_settings: { save_default_payment_method: 'on_subscription' } },
      success_url: successUrl, cancel_url: cancelUrl
    };
  } else throw Object.assign(new Error('Unknown billing action.'), { status: 400 });

  const billingDisclosure = action === 'service'
    ? `The recurring service fee is ${formatMoney(contract.monthly_fee)} per month, starting today. ${serviceCommitmentCycles(contract) ? `It will stop after ${serviceCommitmentCycles(contract)} successful monthly payments.` : 'It renews monthly until canceled under the agreement.'} By continuing, you authorize these charges under the signed agreement.`
    : `${setupMode === 'card_only'
      ? 'No setup payment is due today. '
      : setupMode === 'three_monthly'
        ? `Today’s setup installment is ${formatMoney(setupInstallments(contract.setup_fee).installmentCents / 100)}. The remaining setup installments will be charged monthly. `
        : `Today’s setup payment is ${formatMoney(contract.setup_fee)}. `}${Number(contract.monthly_fee || 0) > 0
      ? `${formatMoney(contract.monthly_fee)} per month ${Number(contract.agreement?.contractVersion || 0) >= 7 ? `starting 14 days after ${setupMode === 'card_only' ? 'you save your card' : 'your first successful setup payment'}` : Number(contract.agreement?.contractVersion || 0) >= 6 ? 'starting when the separate monthly Stripe Checkout is completed' : 'starting when setup is complete'}.`
      : 'No recurring service fee is due under this agreement.'} By continuing, you authorize these charges under the signed agreement.`;
  params.custom_text = { submit: { message: billingDisclosure } };

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

export async function createServiceSubscription(stripe, contract, { trialStartAt } = {}) {
  const amount = cents(contract.monthly_fee);
  if (amount <= 0) return null;
  if (!contract.stripe_customer_id || !contract.stripe_payment_method_id) {
    throw Object.assign(new Error('Collect and save the client payment method before completing setup.'), { status: 409 });
  }
  const setupStarted = Number(contract.setup_fee || 0) <= 0 || ['paid', 'not_required'].includes(contract.setup_payment_status)
    || (contract.setup_payment_status === 'partial' && Number(contract.setup_installments_paid || 0) > 0);
  const contractVersion = Number(contract.agreement?.contractVersion || 0);
  if (!setupStarted || (contractVersion < 7 && !contract.setup_completed_at)) {
    throw Object.assign(new Error('Collect the first agreed setup payment before starting monthly billing.'), { status: 409 });
  }
  if (contract.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(contract.stripe_subscription_status)) {
    return stripe.subscriptions.retrieve(contract.stripe_subscription_id);
  }
  const name = businessName(contract);
  const commitmentCycles = serviceCommitmentCycles(contract);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const scheduledTrialEnd = Math.floor(new Date(trialStartAt || Date.now()).getTime() / 1000) + 14 * 24 * 60 * 60;
  // Webhooks can be delayed or retried after the agreed start date. In that
  // case Stripe cannot accept a trial_end in the past, so collect immediately.
  const trial = contractVersion >= 7 && scheduledTrialEnd > nowSeconds + 30
    ? { trial_end: scheduledTrialEnd }
    : {};
  return stripe.subscriptions.create({
    customer: contract.stripe_customer_id,
    default_payment_method: contract.stripe_payment_method_id,
    collection_method: 'charge_automatically',
    items: [{ price_data: {
      currency: lowerCurrency(contract.currency), unit_amount: amount, recurring: { interval: 'month' },
      product_data: { name: `Monthly service — ${name}`, description: `${contract.package_name || 'Marketing services'} · contract ${contract.reference}` }
    } }],
    metadata: {
      contract_id: contract.id, business_name: name, billing_role: 'service_monthly',
      contract_term: String(contract.agreement?.term || ''),
      ...(commitmentCycles ? { commitment_months: String(commitmentCycles) } : {})
    },
    ...trial
  }, { idempotencyKey: `ag-service-${contract.id}-${contract.stripe_subscription_id || 'initial'}` });
}
