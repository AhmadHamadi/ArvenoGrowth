import { dbRequest, handlerError, json, requireAdmin } from '../../lib/crm.js';

const clean = (value, max = 240) => String(value ?? '').replace(/[\0-\x1f\x7f]/g, '').trim().slice(0, max);
const stages = new Set(['new', 'contacted', 'qualified', 'won', 'lost']);

export default async function handler(req, res) {
  try {
    const config = await requireAdmin(req);
    if (req.method === 'GET') {
      const leads = await dbRequest(config, 'crm_leads?select=*&order=created_at.desc&limit=500');
      return json(res, 200, { leads });
    }
    if (req.method === 'PATCH') {
      const id = clean(req.body?.id, 40);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: 'Choose a valid lead.' });
      const stage = clean(req.body?.stage, 24);
      if (!stages.has(stage)) return json(res, 400, { error: 'Choose a valid lead stage.' });
      const patch = { stage, ...(stage === 'contacted' ? { last_contacted_at: new Date().toISOString() } : {}) };
      const leads = await dbRequest(config, `crm_leads?id=eq.${encodeURIComponent(id)}&select=*`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch)
      });
      if (!leads?.length) return json(res, 404, { error: 'Lead not found.' });
      return json(res, 200, { lead: leads[0] });
    }
    res.setHeader('Allow', 'GET, PATCH');
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) { return handlerError(res, error); }
}
