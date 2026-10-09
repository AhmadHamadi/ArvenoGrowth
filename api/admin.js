import { dbRequest, handlerError, json, requireAdmin, serviceHeaders } from '../lib/crm.js';
import { createHash } from 'node:crypto';
import { encodeContract, slugify } from '../src/contract-model.js';

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

export default async function handler(req, res) {
  try {
    const config = await requireAdmin(req);
    if (req.method === 'GET') {
      const pdfId = clean(req.query?.pdf, 40);
      if (pdfId) {
        if (!/^[0-9a-f-]{36}$/i.test(pdfId)) return json(res, 400, { error: 'A valid contract is required.' });
        const found = await dbRequest(config, `contracts?id=eq.${encodeURIComponent(pdfId)}&select=signed_pdf_path`);
        const path = found?.[0]?.signed_pdf_path;
        if (!path) return json(res, 404, { error: 'No signed PDF is archived for this contract.' });
        const file = await fetch(`${config.url}/storage/v1/object/signed-contracts/${path}`, {
          headers: serviceHeaders(config)
        });
        if (!file.ok) return json(res, 502, { error: 'The signed agreement could not be retrieved.' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Signed-agreement-${pdfId}.pdf"`);
        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(200).send(Buffer.from(await file.arrayBuffer()));
      }
      const records = await dbRequest(config, 'contracts?select=*&order=created_at.desc&limit=500');
      return json(res, 200, { contracts: records, adminEmail: config.user.email });
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
        const clients = await dbRequest(config, `clients?id=eq.${encodeURIComponent(clientId)}&select=id,business_name,first_name,last_name,email,phone,stripe_customer_id&limit=1`);
        clientRecord = clients?.[0];
        if (!clientRecord) return json(res, 404, { error: 'The selected CRM client could not be found.' });
      }
      const savedAgreement = clientRecord ? {
        ...d, clientBusiness: clientRecord.business_name,
        clientContact: `${clientRecord.first_name} ${clientRecord.last_name}`,
        clientEmail: clientRecord.email, clientPhone: clientRecord.phone || ''
      } : d;
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
        contract_token_hash: createHash('sha256').update(encodeContract(savedAgreement)).digest('hex')
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
      return json(res, 200, { contract: existing?.[0] });
    }
    if (req.method === 'PATCH') {
      const id = clean(req.body?.id, 40);
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
