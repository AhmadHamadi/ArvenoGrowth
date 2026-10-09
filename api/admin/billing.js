import { dbRequest, handlerError, json, requireAdmin } from '../../lib/crm.js';
import { createContractCheckout, stripeClient } from '../../lib/stripe.js';
import { sendTransactionalEmail } from '../../lib/transactional-email.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const centsText = (amount, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount || 0));

function billingOrigin() {
  if (process.env.VERCEL_ENV === 'preview') {
    if (!process.env.VERCEL_URL) throw Object.assign(new Error('Preview billing URL is unavailable.'), { status: 503 });
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.PUBLIC_SITE_URL || 'https://www.arvenogrowth.com';
}

export default async function handler(req, res) {
  try {
    const config = await requireAdmin(req);
    if (req.method === 'GET') {
      const query = req.query?.contractId ? `&contract_id=eq.${encodeURIComponent(req.query.contractId)}` : '';
      const payments = await dbRequest(config, `crm_payments?select=id,contract_id,stripe_object_id,billing_kind,amount_paid,currency,paid_at&order=paid_at.desc&limit=1000${query}`);
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
      const setupIsPaid = Number(contract.setup_fee || 0) === 0 || ['paid', 'not_required'].includes(contract.setup_payment_status);
      if (!setupIsPaid) return json(res, 409, { error: 'Confirm the setup fee is paid before marking setup complete.' });
      const updated = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(contractId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ setup_payment_status: Number(contract.setup_fee || 0) === 0 ? 'not_required' : contract.setup_payment_status, setup_completed_at: new Date().toISOString(), onboarding_status: 'onboarding' })
      });
      return json(res, 200, { contract: updated?.[0] });
    }

    if (!['setup', 'service'].includes(action)) return json(res, 400, { error: 'Choose setup billing or monthly service billing.' });
    const setupMode = action === 'setup' ? String(req.body?.setupMode || '') : undefined;
    if (action === 'setup' && !['full', 'three_monthly'].includes(setupMode)) return json(res, 400, { error: 'Choose full payment or three monthly installments.' });
    const agreedSetupMode = contract.agreement?.setupPayment === 'threeMonthly' ? 'three_monthly' : 'full';
    if (action === 'setup' && setupMode !== agreedSetupMode) return json(res, 409, { error: 'The checkout option must match the setup schedule in the signed agreement.' });
    if (action === 'setup' && Number(contract.setup_fee) <= 0) return json(res, 409, { error: 'This contract has no setup fee to collect.' });
    if (action === 'setup' && ['paid', 'not_required'].includes(contract.setup_payment_status)) return json(res, 409, { error: 'The setup fee is already marked as paid.' });
    if (action === 'setup' && contract.setup_payment_status === 'partial') return json(res, 409, { error: 'Setup installments are already in progress. Do not create another setup checkout.' });
    if (action === 'service' && contract.stripe_subscription_status === 'active') return json(res, 409, { error: 'Monthly service billing is already active.' });

    const checkout = await createContractCheckout(stripeClient(), {
      contract, action, setupMode, origin: billingOrigin()
    });
    const patch = {
      [checkout.field]: checkout.session.id,
      ...(action === 'setup' ? { stripe_setup_mode: setupMode } : {})
    };
    await dbRequest(config, `contracts?id=eq.${encodeURIComponent(contractId)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch)
    });

    const label = action === 'setup' ? (setupMode === 'full' ? 'setup fee in full' : 'three monthly setup installments') : 'monthly service';
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
      amount: action === 'setup' ? centsText(contract.setup_fee, contract.currency) : centsText(contract.monthly_fee, contract.currency),
      currency: contract.currency
    });
  } catch (error) { return handlerError(res, error); }
}
