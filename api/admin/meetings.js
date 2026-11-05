import { handlerError, json, requireAdmin } from '../../lib/crm.js';

const API = 'https://api.calendly.com';
const UPCOMING_MAX_PAGES = 5;
const PAST_MAX_PAGES = 1;
const safeHttpsUrl = (value) => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
};

async function calendlyGet(path, token) {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(7000),
    cache: 'no-store'
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* Handled as a generic upstream error below. */ }
  if (!response.ok) {
    const error = new Error('Calendly could not provide meeting data.');
    error.status = response.status;
    error.code = 'CALENDLY_API_ERROR';
    throw error;
  }
  return payload;
}

function eventUuid(uri) {
  try {
    const parsed = new URL(uri);
    if (parsed.origin !== API) return '';
    const match = parsed.pathname.match(/^\/scheduled_events\/([A-Za-z0-9_-]+)\/?$/);
    return match?.[1] || '';
  } catch { return ''; }
}

async function inviteesForEvent(event, token) {
  const uuid = eventUuid(event.uri);
  if (!uuid) return [];
  const result = await calendlyGet(`/scheduled_events/${encodeURIComponent(uuid)}/invitees?count=100`, token);
  return Array.isArray(result.collection) ? result.collection : [];
}

async function listEvents(params, token, maxPages) {
  const events = [];
  let nextPath = `/scheduled_events?${params}`;
  for (let page = 0; nextPath && page < maxPages; page += 1) {
    const pageData = await calendlyGet(nextPath, token);
    events.push(...(Array.isArray(pageData.collection) ? pageData.collection : []));
    const nextPageUrl = pageData.pagination?.next_page;
    nextPath = '';
    if (nextPageUrl) {
      try {
        const parsed = new URL(nextPageUrl);
        if (parsed.origin === API && parsed.pathname === '/scheduled_events') nextPath = `${parsed.pathname}${parsed.search}`;
      } catch { /* Ignore malformed pagination links from the upstream service. */ }
    }
  }
  return events;
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return json(res, 405, { error: 'Method not allowed.' });
    }

    const token = String(process.env.CALENDLY_ACCESS_TOKEN || '').trim();
    if (!token) {
      return json(res, 503, {
        configured: false,
        error: 'Add CALENDLY_ACCESS_TOKEN to Vercel to show Calendly meetings here.'
      });
    }

    const { resource: user } = await calendlyGet('/users/me', token);
    if (!user?.uri) throw new Error('Calendly did not return the connected user.');

    const now = new Date();
    const upcomingParams = new URLSearchParams({
      user: user.uri,
      status: 'active',
      min_start_time: now.toISOString(),
      sort: 'start_time:asc',
      count: '100'
    });
    const pastParams = new URLSearchParams({
      user: user.uri,
      status: 'active',
      max_start_time: new Date(now.getTime() - 1000).toISOString(),
      sort: 'start_time:desc',
      count: '100'
    });
    const [upcomingEvents, pastEvents] = await Promise.all([
      listEvents(upcomingParams, token, UPCOMING_MAX_PAGES),
      listEvents(pastParams, token, PAST_MAX_PAGES)
    ]);
    const meetings = await Promise.all([...pastEvents, ...upcomingEvents].map(async (event) => {
        let invitees = [];
        try { invitees = await inviteesForEvent(event, token); }
        catch { /* Keep the appointment visible if attendee details are temporarily unavailable. */ }
        const activeInvitees = invitees.filter((invitee) => invitee.status !== 'canceled');
        return {
          id: eventUuid(event.uri),
          name: String(event.name || 'Calendly meeting').slice(0, 160),
          startTime: event.start_time || null,
          endTime: event.end_time || null,
          status: event.status || 'active',
          location: safeHttpsUrl(event.location?.join_url) || String(event.location?.location || event.location?.phone_number || event.location?.kind || '').slice(0, 300),
          locationKind: String(event.location?.kind || ''),
          invitees: activeInvitees.map((invitee) => ({
            name: String(invitee.name || '').slice(0, 160),
            email: String(invitee.email || '').slice(0, 200),
            timezone: String(invitee.timezone || '').slice(0, 100),
            cancelUrl: safeHttpsUrl(invitee.cancel_url),
            rescheduleUrl: safeHttpsUrl(invitee.reschedule_url)
          }))
        };
      }));

    meetings.sort((a, b) => Date.parse(a.startTime || 0) - Date.parse(b.startTime || 0));
    return json(res, 200, { configured: true, meetings, syncedAt: new Date().toISOString() });
  } catch (error) {
    if (error?.code === 'CALENDLY_API_ERROR' && (error.status === 401 || error.status === 403)) {
      return json(res, 502, { error: 'Calendly access failed. Check the token and its users:read and scheduled_events:read scopes.' });
    }
    return handlerError(res, error);
  }
}
