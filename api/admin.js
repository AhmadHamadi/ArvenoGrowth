import { dbMode, dbRequest, getSignedPdf, handlerError, json, requireAdmin, signIn } from '../lib/crm.js';
import { createHash, randomUUID } from 'node:crypto';
import { encodeContract, slugify } from '../src/contract-model.js';
import { sendTransactionalEmail } from '../lib/transactional-email.js';

const clean = (value, max = 240) => String(value ?? '').replace(/[\0-\x1f\x7f]/g, '').trim().slice(0, max);
const amount = (value) => {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n >= 0 && n <= 10000000 ? Math.round(n * 100) / 100 : 0;
};
const makeReference = (d) => {
  const name = slugify(d.clientBusiness).toUpperCase().replace(/-/g, '').slice(0, 6) || 'AGREE';
  const date = String(d.agreementDate || '').replace(/-/g, '').slice(2) || '000000';
  return `AG-${name}-${date}`;
};
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
async function sendSigningInvite(agreement, signingUrl, reference) {
  if (process.env.VERCEL_ENV === 'preview') return { sent: false, reason: 'Preview mode does not send contract invitations to real clients.' };
  const business = String(agreement.clientBusiness || 'your business');
  const contact = String(agreement.clientContact || 'there').split(/\s+/)[0];
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString('en-US', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' }) + ' ET';
  const subject = `Please review and sign the Arveno Growth agreement for ${business}`;
  const text = `Hi ${contact},\n\nYour marketing services agreement for ${business} is ready to review and sign.\n\nReview and sign: ${signingUrl}\n\nThis secure link expires ${expiry}. If any details need changing, reply to this email before signing and we will update the agreement.\n\nAgreement reference: ${reference}\n\nArveno Growth`;
  const html = `<p>Hi ${escapeHtml(contact)},</p><p>Your marketing services agreement for <strong>${escapeHtml(business)}</strong> is ready to review and sign.</p><p><a href="${escapeHtml(signingUrl)}">Review and sign the agreement</a></p><p>This secure link expires ${escapeHtml(expiry)}. If any details need changing, reply to this email before signing and we will update the agreement.</p><p>Agreement reference: ${escapeHtml(reference)}</p><p>Arveno Growth</p>`;
  return sendTransactionalEmail({ to: agreement.clientEmail, subject, text, html });
}
const integrationStatuses = () => {
  const preview = process.env.VERCEL_ENV === 'preview';
  const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
  const stripeWebhookReady = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const stripeMode = preview
    ? (/^(sk|rk)_test_/.test(stripeSecret) && stripeWebhookReady ? 'test_mode' : 'needs_test_setup')
    : (/^(sk|rk)_live_/.test(stripeSecret) && process.env.STRIPE_LIVE_MODE_ENABLED === 'true' && stripeWebhookReady
      ? 'live_mode'
      : !/^(sk|rk)_live_/.test(stripeSecret) ? 'needs_api_key'
        : process.env.STRIPE_LIVE_MODE_ENABLED !== 'true' ? 'disabled' : 'needs_webhook');
  const highlevelConfigured = Boolean(process.env.GHL_ACCESS_TOKEN || process.env.GOHIGHLEVEL_API_KEY);
  return [
    dbMode() === 'postgres'
      ? { id: 'database', name: 'Postgres CRM', status: 'connected', detail: 'Private records and portal sign-in use the Postgres database.' }
      : { id: 'supabase', name: 'Supabase CRM (legacy)', status: 'connected', detail: 'Private records and sign-in still use Supabase. Move to Postgres with scripts/db.js import-supabase.' },
    { id: 'resend', name: 'Website email', status: process.env.RESEND_API_KEY ? 'connected' : 'not_connected', detail: process.env.RESEND_API_KEY ? 'Form notifications use Resend.' : 'Resend API key is not configured.' },
    { id: 'calendly', name: 'Calendly meetings', status: process.env.CALENDLY_ACCESS_TOKEN ? 'connected' : 'needs_access', detail: process.env.CALENDLY_ACCESS_TOKEN ? 'Upcoming bookings can sync to this CRM.' : 'Public booking link is available; meeting sync needs a Calendly access token.' },
    { id: 'google_calendar', name: 'Google Calendar', status: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN ? 'connected' : 'needs_reauth', detail: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN ? 'Calendar connection is configured.' : 'Calendar integration is unavailable until its Google connection is authorized again.' },
    { id: 'inbox', name: 'Inbox sync', status: 'not_connected', detail: 'No mailbox sync is connected. Website notifications are email delivery only.' },
    { id: 'gohighlevel', name: 'GoHighLevel', status: highlevelConfigured ? 'configured' : 'not_connected', detail: highlevelConfigured ? 'Credentials are present; the GoHighLevel account still needs a successful API check.' : 'No GoHighLevel account connection is configured.' },
    { id: 'stripe', name: 'Stripe', status: stripeMode, detail: stripeMode === 'test_mode'
      ? 'Preview uses Stripe test mode with webhook sync.'
      : stripeMode === 'live_mode' ? 'Live Stripe billing and webhook sync are configured.'
        : preview ? 'Preview needs a Stripe test key and webhook signing secret.'
          : stripeMode === 'needs_api_key' ? 'Add a Stripe live restricted key to Vercel Production.'
            : stripeMode === 'needs_webhook' ? 'Add the Stripe webhook signing secret to Vercel Production.'
              : 'Live billing is disabled until STRIPE_LIVE_MODE_ENABLED is true.' }
  ];
};

// Best-effort brute-force brake per client IP (per serverless instance), on top of the per-account lockout.
const loginAttempts = new Map();
function loginRateLimited(req) {
  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const recent = (loginAttempts.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  loginAttempts.set(ip, recent);
  if (loginAttempts.size > 5000) loginAttempts.clear();
  return recent.length > 20;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST' && req.body?.action === 'login') {
      if (loginRateLimited(req)) return json(res, 429, { error: 'Too many sign-in attempts. Try again in a few minutes.' });
      const session = await signIn(clean(req.body.email, 254), String(req.body.password ?? '').slice(0, 1024));
      return json(res, 200, { token: session.token, email: session.email });
    }
    const config = await requireAdmin(req);
    if (req.method === 'GET') {
      const pdfId = clean(req.query?.pdf, 40);
      if (pdfId) {
        if (!/^[0-9a-f-]{36}$/i.test(pdfId)) return json(res, 400, { error: 'A valid contract is required.' });
        const found = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(pdfId)}&select=signed_pdf_path`);
        const path = found?.[0]?.signed_pdf_path;
        if (!path) return json(res, 404, { error: 'No signed PDF is archived for this contract.' });
        const file = await getSignedPdf(config, path);
        if (!file) return json(res, 502, { error: 'The signed agreement could not be retrieved.' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Signed-agreement-${pdfId}.pdf"`);
        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(200).send(file);
      }
      const records = await dbRequest(config, 'contracts?select=*&order=created_at.desc&limit=500');
      return json(res, 200, { contracts: records, adminEmail: config.user.email, integrations: integrationStatuses(), environment: process.env.VERCEL_ENV || 'local' });
    }
    if (req.method === 'POST') {
      if (Buffer.byteLength(JSON.stringify(req.body || {})) > 500_000) return json(res, 413, { error: 'Contract data is too large.' });
      const d = req.body?.contract;
      if (!d || typeof d !== 'object' || Array.isArray(d)) return json(res, 400, { error: 'Contract details are required.' });
      const business = clean(d.clientBusiness, 160);
      const contact = clean(d.clientContact, 120);
      const email = clean(d.clientEmail, 200).toLowerCase();
      if (!business || !contact || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'Add the business, contact name, and a valid email before saving.' });
      const clientId = clean(req.body?.clientId, 40);
      if (!clientId) return json(res, 400, { error: 'Choose a saved client from the Admin CRM before saving this agreement.' });
      let clientRecord = null;
      if (clientId) {
        if (!/^[0-9a-f-]{36}$/i.test(clientId)) return json(res, 400, { error: 'Choose a valid CRM client.' });
        const clients = await dbRequest(config, `clients?id=eq.${encodeURIComponent(clientId)}&select=id,business_name,first_name,last_name,email,phone,stripe_customer_id,former_at&limit=1`);
        clientRecord = clients?.[0];
        if (!clientRecord) return json(res, 404, { error: 'The selected CRM client could not be found.' });
        if (clientRecord.former_at) return json(res, 409, { error: 'Restore this former client before creating a new agreement.' });
      }
      const savedAgreementBase = clientRecord ? {
        ...d, clientBusiness: clientRecord.business_name,
        clientContact: `${clientRecord.first_name} ${clientRecord.last_name}`,
        clientEmail: clientRecord.email, clientPhone: clientRecord.phone || ''
      } : d;
      const savedAgreement = { ...savedAgreementBase, signingNonce: randomUUID() };
      const signingToken = encodeContract(savedAgreement);
      const signingOrigin = process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}` : process.env.PUBLIC_SITE_URL || 'https://www.arvenogrowth.com';
      const record = {
        ...(clientRecord ? { client_id: clientRecord.id, stripe_customer_id: clientRecord.stripe_customer_id } : {}),
        reference: makeReference(savedAgreement),
        client_business: savedAgreement.clientBusiness,
        client_contact: savedAgreement.clientContact,
        client_email: savedAgreement.clientEmail,
        client_phone: clean(savedAgreement.clientPhone, 40) || null,
        package_name: clean(d.packageName, 120) || null,
        currency: ['CAD', 'USD'].includes(d.currency) ? d.currency : 'CAD',
        setup_fee: amount(savedAgreement.setupFee), monthly_fee: amount(savedAgreement.monthlyFee), status: 'draft',
        setup_payment_status: amount(savedAgreement.setupFee) === 0 ? 'not_required' : 'not_started',
        onboarding_status: 'draft', agreement: savedAgreement,
        signing_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        signing_url: `${signingOrigin}/sign/${encodeURIComponent(slugify(savedAgreement.clientBusiness))}?a=${signingToken}`,
        contract_token_hash: createHash('sha256').update(signingToken).digest('hex')
      };
      let saved;
      try {
        saved = await dbRequest(config, 'contracts?on_conflict=contract_token_hash', {
          method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(record)
        });
      } catch (error) {
        // Keep contract creation usable during a staged deployment where the
        // original CRM migration exists but the additive Stripe migration has
        // not yet been applied.
        if (!/setup_payment_status|onboarding_status|PGRST204|42703|column .* does not exist/i.test(error.message || '')) throw error;
        const legacyRecord = { ...record };
        delete legacyRecord.setup_payment_status;
        delete legacyRecord.onboarding_status;
        saved = await dbRequest(config, 'contracts?on_conflict=contract_token_hash', {
          method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(legacyRecord)
        });
      }
      const existing = saved?.[0] ? saved : await dbRequest(config, `contracts?contract_token_hash=eq.${record.contract_token_hash}&select=*`);
      if (existing?.[0] && !existing[0].signed_at && existing[0].status !== 'signed' && existing[0].status !== 'archived') {
        const refreshed = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(existing[0].id)}&select=*`, {
          method: 'PATCH', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ signing_expires_at: record.signing_expires_at, status: 'sent' })
        });
        if (refreshed?.[0]) existing[0] = refreshed[0];
      }
      let emailSent = false;
      let emailWarning = '';
      try {
        const delivered = await sendSigningInvite(savedAgreement, existing?.[0]?.signing_url || record.signing_url, existing?.[0]?.reference || record.reference);
        emailSent = Boolean(delivered.sent);
        if (!emailSent) emailWarning = delivered.reason || 'Email is not configured.';
      } catch (error) {
        console.error('[admin] Signing invitation email failed:', error?.message || error);
        emailWarning = 'The agreement is saved and the signing link is active, but its email could not be sent. Use the CRM resend action after checking email setup.';
      }
      if (existing?.[0]?.id) {
        const nextStatus = emailSent ? 'contract_sent' : 'draft';
        const draft = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(existing[0].id)}`, {
          method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: emailSent ? 'sent' : 'draft', onboarding_status: nextStatus })
        });
        if (draft?.[0]) existing[0] = draft[0];
      }
      return json(res, 200, { contract: existing?.[0], emailSent, emailWarning });
    }
    if (req.method === 'PATCH') {
      const id = clean(req.body?.id, 40);
      if (req.body?.action === 'send_link') {
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: 'A valid contract is required.' });
        const current = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(id)}&select=id,status,signed_at,agreement,signing_url,signing_expires_at,reference`);
        if (!current?.length) return json(res, 404, { error: 'Contract not found.' });
        const row = current[0];
        if (row.signed_at || ['signed', 'archived'].includes(row.status)) return json(res, 409, { error: 'This agreement is already signed or archived.' });
        if (!row.signing_url || Date.parse(row.signing_expires_at || '') <= Date.now()) return json(res, 410, { error: 'This signing link has expired. Renew it first.' });
        try {
          const sent = await sendSigningInvite(row.agreement, row.signing_url, row.reference);
          if (!sent.sent) return json(res, 503, { error: sent.reason || 'Email is not configured.' });
          const updated = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'sent', onboarding_status: 'contract_sent' }) });
          return json(res, 200, { contract: updated?.[0] || row, emailSent: true });
        } catch (error) {
          console.error('[admin] Signing invitation resend failed:', error?.message || error);
          return json(res, 502, { error: 'The signing link is still active, but the invitation email failed. Please try again or copy the link.' });
        }
      }
      if (req.body?.action === 'renew_link') {
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: 'A valid contract is required.' });
        const current = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(id)}&select=id,status,signed_at,agreement,client_business`);
        if (!current?.length) return json(res, 404, { error: 'Contract not found.' });
        if (current[0].signed_at || ['signed', 'archived'].includes(current[0].status)) return json(res, 409, { error: 'A signed agreement cannot be reissued.' });
        const storedAgreement = current[0].agreement;
        if (!storedAgreement) return json(res, 409, { error: 'The saved agreement details are missing.' });
        const agreement = { ...storedAgreement, signingNonce: randomUUID() };
        const token = encodeContract(agreement);
        const origin = process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}` : process.env.PUBLIC_SITE_URL || 'https://www.arvenogrowth.com';
        const updated = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ agreement, status: 'sent', contract_token_hash: createHash('sha256').update(token).digest('hex'), signing_url: `${origin}/sign/${encodeURIComponent(slugify(agreement.clientBusiness))}?a=${token}`, signing_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
        });
        let emailSent = false;
        let emailWarning = '';
        try {
          const delivered = await sendSigningInvite(agreement, updated?.[0]?.signing_url, updated?.[0]?.reference || current[0].id);
          emailSent = Boolean(delivered.sent);
          if (!emailSent) emailWarning = delivered.reason || 'Email is not configured.';
        } catch (error) {
          console.error('[admin] Signing invitation email failed:', error?.message || error);
          emailWarning = 'The link was renewed but its email could not be sent. Copy the link and send it manually.';
        }
        if (updated?.[0]?.id) {
          const draft = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(updated[0].id)}`, {
            method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: emailSent ? 'sent' : 'draft', onboarding_status: emailSent ? 'contract_sent' : 'draft' })
          });
          if (draft?.[0]) updated[0] = draft[0];
        }
        return json(res, 200, { contract: updated?.[0], emailSent, emailWarning });
      }
      if (req.body?.action === 'verify') {
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: 'A valid contract is required.' });
        const current = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(id)}&select=id,status,signed_at,signed_pdf_path`);
        if (!current?.length) return json(res, 404, { error: 'Contract not found.' });
        if (!current[0].signed_at || !current[0].signed_pdf_path) return json(res, 409, { error: 'A signed PDF must be present before verification.' });
        const verified = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ verified_at: new Date().toISOString(), verified_by: config.user.email })
        });
        return json(res, 200, { contract: verified?.[0] });
      }
      const status = clean(req.body?.status, 20);
      if (!/^[0-9a-f-]{36}$/i.test(id) || !['sent', 'archived'].includes(status)) return json(res, 400, { error: 'A valid contract and archive or restore action are required.' });
      // Signing is recorded only by /api/sign after verifying the exact signing
      // token. Restoring an archived row must preserve its signed state.
      let nextStatus = status;
      if (status === 'sent') {
        const current = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(id)}&select=id,signed_at`);
        if (!current?.length) return json(res, 404, { error: 'Contract not found.' });
        if (current[0].signed_at) nextStatus = 'signed';
      }
      const updated = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: nextStatus })
      });
      if (!updated?.length) return json(res, 404, { error: 'Contract not found.' });
      return json(res, 200, { contract: updated[0] });
    }
    res.setHeader('Allow', 'GET, POST, PATCH');
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) { return handlerError(res, error); }
}
