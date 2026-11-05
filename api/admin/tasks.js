import { dbRequest, handlerError, json, requireAdmin } from '../../lib/crm.js';

const clean = (value, max = 500) => String(value ?? '').replace(/[\0-\x1f\x7f]/g, '').trim().slice(0, max);
const priorities = new Set(['low', 'normal', 'high']);
const statuses = new Set(['open', 'in_progress', 'done']);
const uuid = (value) => /^[0-9a-f-]{36}$/i.test(String(value || ''));

export default async function handler(req, res) {
  try {
    const config = await requireAdmin(req);
    if (req.method === 'GET') {
      const tasks = await dbRequest(config, 'crm_tasks?select=*&order=due_at.asc.nullslast,created_at.desc&limit=500');
      return json(res, 200, { tasks });
    }
    if (req.method === 'POST') {
      const title = clean(req.body?.title, 180);
      const details = clean(req.body?.details, 2000);
      const dueAt = clean(req.body?.dueAt, 10);
      const priority = clean(req.body?.priority, 16) || 'normal';
      if (!title) return json(res, 400, { error: 'Add a task title.' });
      if (!priorities.has(priority)) return json(res, 400, { error: 'Choose a valid priority.' });
      if (dueAt && !/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) return json(res, 400, { error: 'Choose a valid due date.' });
      const tasks = await dbRequest(config, 'crm_tasks?select=*', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ title, details: details || null, due_at: dueAt || null, priority })
      });
      return json(res, 201, { task: tasks?.[0] });
    }
    if (req.method === 'PATCH') {
      const id = clean(req.body?.id, 40);
      if (!uuid(id)) return json(res, 400, { error: 'Choose a valid task.' });
      const patch = {};
      if ('title' in req.body) {
        const title = clean(req.body.title, 180);
        if (!title) return json(res, 400, { error: 'Add a task title.' });
        patch.title = title;
      }
      if ('details' in req.body) patch.details = clean(req.body.details, 2000) || null;
      if ('dueAt' in req.body) {
        const dueAt = clean(req.body.dueAt, 10);
        if (dueAt && !/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) return json(res, 400, { error: 'Choose a valid due date.' });
        patch.due_at = dueAt || null;
      }
      if ('priority' in req.body) {
        const priority = clean(req.body.priority, 16);
        if (!priorities.has(priority)) return json(res, 400, { error: 'Choose a valid priority.' });
        patch.priority = priority;
      }
      if ('status' in req.body) {
        const status = clean(req.body.status, 20);
        if (!statuses.has(status)) return json(res, 400, { error: 'Choose a valid status.' });
        patch.status = status;
        patch.completed_at = status === 'done' ? new Date().toISOString() : null;
      }
      if (!Object.keys(patch).length) return json(res, 400, { error: 'No task changes were provided.' });
      const tasks = await dbRequest(config, `crm_tasks?id=eq.${encodeURIComponent(id)}&select=*`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch)
      });
      if (!tasks?.length) return json(res, 404, { error: 'Task not found.' });
      return json(res, 200, { task: tasks[0] });
    }
    if (req.method === 'DELETE') {
      const id = clean(req.query?.id, 40);
      if (!uuid(id)) return json(res, 400, { error: 'Choose a valid task.' });
      await dbRequest(config, `crm_tasks?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return json(res, 200, { ok: true });
    }
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) { return handlerError(res, error); }
}
