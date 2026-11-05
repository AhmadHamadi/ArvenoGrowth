import { dbRequest, handlerError, json, requireAdmin } from '../../lib/crm.js';

const clean = (value, max = 200) => String(value ?? '').replace(/[\0-\x1f\x7f]/g, '').trim().slice(0, max);
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default async function handler(req, res) {
  try {
    const config = await requireAdmin(req);
    if (req.method === 'GET') {
      const id = clean(req.query?.id, 40);
      const filter = id ? `&id=eq.${encodeURIComponent(id)}` : '';
      const clients = await dbRequest(config, `clients?select=*&order=business_name.asc&limit=1000${filter}`);
      return json(res, 200, { clients: clients || [] });
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      const client = {
        business_name: clean(body.businessName, 160),
        first_name: clean(body.firstName, 80),
        last_name: clean(body.lastName, 80),
        email: clean(body.email, 200).toLowerCase(),
        phone: clean(body.phone, 40) || null
      };
      if (!client.business_name || !client.first_name || !client.last_name || !validEmail(client.email)) {
        return json(res, 400, { error: 'Add the business name, client first and last name, and a valid email.' });
      }
      const existing = await dbRequest(config, `clients?business_name=ilike.${encodeURIComponent(client.business_name)}&email=ilike.${encodeURIComponent(client.email)}&select=*&limit=1`);
      if (existing?.[0]) return json(res, 200, { client: existing[0], existing: true });
      const rows = await dbRequest(config, 'clients', {
        method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(client)
      });
      return json(res, 200, { client: rows?.[0] });
    }
    if (req.method === 'PATCH') {
      const id = clean(req.body?.id, 40);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        return json(res, 400, { error: 'Choose a valid client record.' });
      }
      const action = clean(req.body?.action, 20);
      if (action === 'former' || action === 'restore') {
        const rows = await dbRequest(config, `clients?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ former_at: action === 'former' ? new Date().toISOString() : null })
        });
        if (!rows?.[0]) return json(res, 404, { error: 'Client not found.' });
        return json(res, 200, { client: rows[0] });
      }
      const client = {
        business_name: clean(req.body?.businessName, 160),
        first_name: clean(req.body?.firstName, 80),
        last_name: clean(req.body?.lastName, 80),
        email: clean(req.body?.email, 200).toLowerCase(),
        phone: clean(req.body?.phone, 40) || null
      };
      if (!client.business_name || !client.first_name || !client.last_name || !validEmail(client.email)) {
        return json(res, 400, { error: 'Add the business name, client first and last name, and a valid email.' });
      }
      const rows = await dbRequest(config, `clients?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(client)
      });
      if (!rows?.[0]) return json(res, 404, { error: 'Client not found.' });
      return json(res, 200, { client: rows[0] });
    }
    res.setHeader('Allow', 'GET, POST, PATCH');
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) { return handlerError(res, error); }
}
