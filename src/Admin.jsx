import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, Check, Copy, ExternalLink, FilePlus2, FileText, LogOut, RefreshCw, Search, ShieldCheck, Video, LayoutDashboard, Users, CalendarDays, CreditCard, ListTodo, PlugZap, UserRoundPlus } from 'lucide-react';
import brand from './brand-config.json';
import { PACKAGE_PRESETS, packageSetupFee } from './contract-model.js';

const TOKEN_KEY = 'arveno_crm_session';
// Remember the sign-in on this device (survives closing the tab) until it expires or the user signs out.
const readToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};
const saveToken = (value) => {
  try { localStorage.setItem(TOKEN_KEY, value); } catch { /* storage blocked: sign-in lasts for this page only */ }
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};
const clearToken = () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};
const money = (value, currency) => new Intl.NumberFormat('en-CA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
const stamp = (value) => value ? new Date(value).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const stampTime = (value) => value ? new Date(value).toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '—';
function setupPaymentLabel(row) {
  if (Number(row.setup_fee || 0) <= 0 || row.setup_payment_status === 'not_required') return 'No setup fee';
  if (row.setup_payment_status === 'paid') return 'Paid in full';
  if (row.setup_payment_status === 'partial') return `Installments · ${row.setup_installments_paid || 0} of 3 paid`;
  if (row.setup_payment_status === 'failed') return 'Payment failed · follow up';
  if (row.stripe_setup_checkout_session_id || row.stripe_setup_subscription_id) return 'Payment link sent · awaiting payment';
  return 'Waiting for setup payment';
}
function clientStage(row) {
  if (row.onboarding_status === 'payment_issue' || row.stripe_subscription_status === 'past_due') return 'Payment issue · action needed';
  if (row.status === 'archived') return row.signed_at ? 'Archived agreement' : 'Archived';
  if (row.status === 'draft') return 'Draft · not emailed';
  if (row.status === 'sent') return 'Waiting for client signature';
  if (row.stripe_subscription_status === 'canceled') return 'Monthly service canceled';
  if (row.stripe_subscription_status === 'active' || row.onboarding_status === 'active') return 'Active client';
  if (row.setup_completed_at) return row.stripe_subscription_status === 'trialing' ? 'Setup complete · billing scheduled' : 'Setup complete';
  if (row.setup_started_at) return 'Setup underway';
  if (row.stripe_subscription_status === 'trialing') return 'Monthly billing starts in 14 days';
  if (row.status === 'signed' && (row.stripe_setup_checkout_session_id || row.stripe_setup_subscription_id)) return 'Setup payment link sent';
  if (row.status === 'signed' && Number(row.setup_fee || 0) <= 0 && !row.stripe_payment_method_id) return 'Waiting for card details';
  if (row.status === 'signed') return 'Signed · setup not started';
  return String(row.onboarding_status || row.status || 'Not started').replaceAll('_', ' ');
}
function setupTimeline(row, payments = []) {
  const setupPayment = payments.filter(payment => ['setup_full', 'setup_installment'].includes(payment.billing_kind)).sort((a, b) => Date.parse(a.paid_at) - Date.parse(b.paid_at))[0];
  const started = row.setup_started_at || setupPayment?.paid_at || '';
  const due = row.setup_due_at || (started ? new Date(Date.parse(started) + 14 * 86400000).toISOString() : '');
  if (!started) return Number(row.setup_fee || 0) <= 0 ? 'Setup clock starts when the card is saved.' : 'Setup clock starts after the first successful setup payment.';
  const remaining = due ? Math.ceil((Date.parse(due) - Date.now()) / 86400000) : null;
  const countdown = row.setup_completed_at ? `Completed ${stamp(row.setup_completed_at)}`
    : remaining < 0 ? `Overdue by ${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? '' : 's'}`
      : remaining === 0 ? 'Due today' : `${remaining} day${remaining === 1 ? '' : 's'} left`;
  const billingStart = row.stripe_subscription_status === 'trialing' && started
    ? new Date(Date.parse(started) + 14 * 86400000).toISOString() : '';
  const billing = billingStart ? ` · first monthly charge ${stampTime(billingStart)}` : '';
  return `Started ${stamp(started)} · ${countdown}${due ? ` · deadline ${stampTime(due)}` : ''}${billing}`;
}
const meetingTime = (value, timezone) => {
  if (!value) return 'Time not available';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: timezone || undefined, timeZoneName: 'short'
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
  }
};

function AuthGate({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(true);
  const login = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ action: 'login', email: email.trim(), password })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 503) setConfigured(false);
      if (!response.ok || !data.token) throw new Error(data.error || 'Email or password was not accepted.');
      saveToken(data.token);
      setPassword(''); onLogin(data.token);
    } catch (e) { setError(e.message || 'Unable to sign in.'); }
    finally { setBusy(false); }
  };
  return <main className="crm-login-wrap"><section className="crm-login-card">
    <img className="crm-logo" src={brand.mark} alt="" />
    <p className="crm-kicker">PRIVATE CLIENT PORTAL</p><h1>Contracts, clearly organized.</h1>
    <p className="crm-muted">Sign in with the authorized business account to view clients, agreements, and contracted revenue.</p>
    <form onSubmit={login} className="crm-login-form">
      <label>Email address<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p className="crm-error" role="alert">{error}</p>}
      <button className="crm-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
    </form>
    <p className="crm-login-foot"><ShieldCheck size={15} /> Protected by a server-side sign-in and admin allowlist.</p>
    {!configured && <p className="crm-setup-note">Connect the environment variables in the setup guide before enabling sign-in.</p>}
  </section></main>;
}

function Admin({ token, onLogout }) {
  const sections = {
    'crm-overview': ['Overview', 'A quick view of clients, incoming leads, meetings, and follow-up.'],
    'crm-leads': ['Leads', 'Review new enquiries and keep each opportunity moving.'],
    'crm-clients': ['Clients', 'Keep business and contact details here, then start an agreement from a client record.'],
    'crm-programs': ['Packages', 'See what each service package includes.'],
    'crm-contracts': ['Contracts', 'Create, send, verify, and manage client agreements.'],
    'crm-meetings': ['Meetings', 'Review upcoming bookings and recent meeting history.'],
    'crm-billing': ['Billing', 'See each client’s signed billing terms, payments, and receipts.'],
    'crm-tasks': ['Tasks', 'Keep follow-ups and internal reminders in one list.'],
    'crm-integrations': ['Connections', 'Check the services connected to the CRM.']
  };
  const [activeSection, setActiveSection] = useState(() => sections[window.location.hash.slice(1)] ? window.location.hash.slice(1) : 'crm-overview');
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClientId, setEditingClientId] = useState('');
  const [sourceLeadId, setSourceLeadId] = useState('');
  const [clientBusy, setClientBusy] = useState(false);
  const [clientNotice, setClientNotice] = useState('');
  const [clientForm, setClientForm] = useState({ businessName: '', firstName: '', lastName: '', email: '', phone: '' });
  const [email, setEmail] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [payments, setPayments] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [depositForm, setDepositForm] = useState({ clientId: '', amount: '', currency: 'USD' });
  const [depositBusy, setDepositBusy] = useState('');
  const [meetings, setMeetings] = useState([]);
  const [meetingsView, setMeetingsView] = useState('upcoming');
  const [meetingsWarning, setMeetingsWarning] = useState('');
  const [billingWarning, setBillingWarning] = useState('');
  const [billingBusy, setBillingBusy] = useState('');
  const [checkoutLinks, setCheckoutLinks] = useState({});
  const [billingNotice, setBillingNotice] = useState('');
  const [billingClientFilter, setBillingClientFilter] = useState('all');
  const [leads, setLeads] = useState([]);
  const [leadsWarning, setLeadsWarning] = useState('');
  const [tasks, setTasks] = useState([]);
  const [tasksWarning, setTasksWarning] = useState('');
  const [integrations, setIntegrations] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: '', dueAt: '', priority: 'normal', details: '' });
  const [taskBusy, setTaskBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) { onLogout(); throw new Error(data.error || 'Please sign in again.'); }
      if (!response.ok) throw new Error(data.error || 'Could not load contracts.');
      setRows(data.contracts || []); setEmail(data.adminEmail || '');
      setIntegrations(data.integrations || []);
      const clientsResponse = await fetch('/api/admin/clients', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const clientsData = await clientsResponse.json();
      if (!clientsResponse.ok) throw new Error(clientsData.error || 'Could not load client records.');
      setClients(clientsData.clients || []);
      const billingResponse = await fetch('/api/admin/billing', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const billingData = await billingResponse.json();
      if (billingResponse.ok) { setPayments(billingData.payments || []); setBillingWarning(''); }
      else { setPayments([]); setBillingWarning(billingResponse.status === 503 ? 'Stripe reporting is waiting for its billing database migration.' : 'Stripe payment records are not available yet.'); }
      const depositsResponse = await fetch('/api/admin/deposits', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const depositsData = await depositsResponse.json();
      if (depositsResponse.ok) setDeposits(depositsData.deposits || []);
      else { setDeposits([]); if (!billingWarning) setBillingWarning(depositsData.error || 'Reservation deposits are not available yet. Apply the reservation-deposits database migration.'); }
      try {
        const meetingsResponse = await fetch('/api/admin/meetings', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const meetingsData = await meetingsResponse.json();
        if (meetingsResponse.ok) {
          setMeetings(meetingsData.meetings || []);
          setMeetingsWarning('');
        } else {
          setMeetings([]);
          setMeetingsWarning(meetingsData.error || 'Upcoming Calendly meetings are unavailable.');
        }
      } catch {
        setMeetings([]);
        setMeetingsWarning('Upcoming Calendly meetings could not be refreshed.');
      }
      const [leadsResult, tasksResult] = await Promise.allSettled([
        fetch('/api/admin/leads', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).then(async response => ({ response, data: await response.json() })),
        fetch('/api/admin/tasks', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).then(async response => ({ response, data: await response.json() }))
      ]);
      if (leadsResult.status === 'fulfilled' && leadsResult.value.response.ok) { setLeads(leadsResult.value.data.leads || []); setLeadsWarning(''); }
      else { setLeads([]); setLeadsWarning(leadsResult.status === 'fulfilled' ? leadsResult.value.data.error || 'Lead records are unavailable.' : 'Lead records could not be refreshed.'); }
      if (tasksResult.status === 'fulfilled' && tasksResult.value.response.ok) { setTasks(tasksResult.value.data.tasks || []); setTasksWarning(''); }
      else { setTasks([]); setTasksWarning(tasksResult.status === 'fulfilled' ? tasksResult.value.data.error || 'Tasks are unavailable.' : 'Tasks could not be refreshed.'); }
    } catch (e) { setError(e.message || 'Could not load contracts.'); }
    finally { setBusy(false); }
  }, [token, onLogout]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const syncSection = () => setActiveSection(sections[window.location.hash.slice(1)] ? window.location.hash.slice(1) : 'crm-overview');
    window.addEventListener('hashchange', syncSection);
    window.addEventListener('popstate', syncSection);
    return () => { window.removeEventListener('hashchange', syncSection); window.removeEventListener('popstate', syncSection); };
  }, []);

  const navigateSection = (id) => {
    setActiveSection(id);
    if (window.location.hash !== `#${id}`) window.history.pushState(null, '', `#${id}`);
  };
  const startNewClient = () => {
    setEditingClientId(''); setSourceLeadId('');
    setClientForm({ businessName: '', firstName: '', lastName: '', email: '', phone: '' });
    setShowClientForm(true);
    navigateSection('crm-clients');
  };

  const visible = useMemo(() => rows.filter((row) => {
    const isSigned = row.status === 'signed' || (row.status === 'archived' && Boolean(row.signed_at));
    const statusMatch = filter === 'all' || (filter === 'signed' ? isSigned : row.status === filter);
    const text = `${row.client_business} ${row.client_contact} ${row.client_email} ${row.package_name}`.toLowerCase();
    return statusMatch && text.includes(query.trim().toLowerCase());
  }), [rows, filter, query]);
  const activeClientCount = useMemo(() => new Set(clients.filter(client => !client.former_at && rows.some(row => row.client_id === client.id && row.onboarding_status === 'active' && row.stripe_subscription_status === 'active')).map(client => client.id)).size, [clients, rows]);
  const upcomingMeetings = useMemo(() => {
    const now = Date.now();
    return meetings.filter(meeting => Date.parse(meeting.startTime || 0) >= now)
      .sort((a, b) => Date.parse(a.startTime || 0) - Date.parse(b.startTime || 0));
  }, [meetings]);
  const pastMeetings = useMemo(() => {
    const now = Date.now();
    return meetings.filter(meeting => Date.parse(meeting.startTime || 0) < now)
      .sort((a, b) => Date.parse(b.startTime || 0) - Date.parse(a.startTime || 0));
  }, [meetings]);
  const visibleMeetings = meetingsView === 'past' ? pastMeetings : upcomingMeetings;
  const billingReady = !billingWarning;

  const setStatus = async (row, status) => {
    setError('');
    try {
      const response = await fetch('/api/admin', { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, status }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not update status.');
      await load();
    } catch (e) { setError(e.message); }
  };
  const contractAction = async (row, action) => {
    if (action === 'verify' && !window.confirm(`Confirm you reviewed the signed PDF for ${row.client_business} and verified it matches the agreement?`)) return;
    setError('');
    try {
      const response = await fetch('/api/admin', { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, action }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not update this agreement.');
      await load();
      if (action === 'verify') setBillingNotice('Signed PDF verified by Admin. Drive filing is still awaiting the Google Drive connection.');
      if (action === 'send_link') setBillingNotice(`Signing invitation sent to ${data.contract?.client_email || row.client_email}.`);
      if (action === 'renew_link') setBillingNotice(data.emailSent ? `A fresh signing link was emailed to ${data.contract?.client_email || row.client_email}; it expires in 24 hours.` : (data.emailWarning || 'The link is renewed for 24 hours, but its email did not send. Copy and send it manually.'));
    } catch (e) { setError(e.message); }
  };
  const copySigning = async (row) => {
    try { await navigator.clipboard.writeText(row.signing_url); setBillingNotice('Signing link copied. It expires at ' + stamp(row.signing_expires_at) + '.'); }
    catch { setError('Copy was blocked by the browser. Open the signing link and copy it from the address bar.'); }
  };
  const download = async (row) => {
    try {
      const response = await fetch(`/api/admin?pdf=${encodeURIComponent(row.id)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Download failed.'); }
      const href = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = href; anchor.download = `Signed-agreement-${row.reference}.pdf`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 1500);
    } catch (e) { setError(e.message); }
  };

  const billingAction = async (row, action, setupMode) => {
    setBillingBusy(row.id); setBillingNotice(''); setBillingWarning('');
    try {
      const response = await fetch('/api/admin/billing', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: row.id, action, setupMode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update billing.');
      if (data.checkoutUrl) {
        setCheckoutLinks((current) => ({ ...current, [row.id]: { url: data.checkoutUrl, action } }));
        setBillingNotice(data.emailSent ? `Secure checkout link sent to ${row.client_email}.` : `Checkout link is ready. Email was not sent: ${data.emailWarning || 'Copy the link and send it to the client.'}`);
      } else if (data.setupComplete) {
        setBillingNotice(`Setup marked complete on ${stamp(data.setupCompletedAt)}. The separate Stripe subscription remains scheduled to start 14 days after the first setup payment.`);
      } else {
        setBillingNotice(data.subscriptionStatus
          ? `Setup complete. Monthly billing is ${data.subscriptionStatus.replaceAll('_', ' ')} and will collect automatically from the saved payment method.`
          : data.monthlyCheckoutRequired ? 'Setup marked complete. Send the separate monthly Stripe Checkout link to start recurring billing.' : 'Setup marked complete. No monthly charge is due under this agreement.');
        await load();
      }
    } catch (e) { setBillingWarning(e.message || 'Could not update billing.'); }
    finally { setBillingBusy(''); }
  };
  const reservationAction = async (action, deposit = null) => {
    const key = deposit?.id || 'create'; setDepositBusy(key); setBillingNotice(''); setBillingWarning('');
    if (action === 'refund' && !window.confirm(`${deposit.status === 'partially_refunded' ? 'Refund the remaining refundable balance' : `Refund ${money(deposit.amount, deposit.currency)}`} to the original payment method for ${clients.find(c => c.id === deposit.client_id)?.business_name || 'this client'}? Stripe processing fees may not be returned to Arveno.`)) { setDepositBusy(''); return; }
    try {
      const response = await fetch('/api/admin/deposits', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'create' ? { action, ...depositForm } : { action, depositId: deposit.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not update this deposit.');
      if (action === 'create') {
        setDeposits(current => [data.deposit, ...current]);
        await navigator.clipboard.writeText(data.deposit.checkout_url).catch(() => {});
        setBillingNotice(`Stripe Checkout link created for ${clients.find(c => c.id === depositForm.clientId)?.business_name || 'the client'} and copied if clipboard access was available. No payment has been made.`);
      } else if (action === 'renew') {
        await navigator.clipboard.writeText(data.deposit.checkout_url).catch(() => {});
        setBillingNotice('A new Stripe Checkout link is ready and copied if clipboard access was available. No payment has been made.');
      } else {
        if (['failed', 'canceled'].includes(data.refundStatus)) setBillingWarning('Stripe could not complete the refund. The deposit remains available to retry.');
        else setBillingNotice(data.refundStatus === 'succeeded' ? `${deposit.status === 'partially_refunded' ? 'Remaining' : 'Full'} Stripe refund submitted. The deposit status will sync from Stripe.` : 'Stripe accepted the refund request. Status will update when Stripe confirms it.');
      }
      const refreshed = await fetch('/api/admin/deposits', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (refreshed.ok) setDeposits((await refreshed.json()).deposits || []);
    } catch (e) { setBillingWarning(e.message || 'Could not update this deposit.'); }
    finally { setDepositBusy(''); }
  };

  const copyCheckout = async (row) => {
    const link = checkoutLinks[row.id]?.url;
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setBillingNotice('Checkout link copied.'); }
    catch { setBillingWarning('Copy was blocked by the browser. Open the checkout link and copy it from the address bar.'); }
  };

  const saveClient = async (event) => {
    event.preventDefault(); setClientBusy(true); setClientNotice(''); setError('');
    const convertedLeadId = sourceLeadId;
    try {
      const response = await fetch('/api/admin/clients', {
        method: editingClientId ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...clientForm, ...(editingClientId ? { id: editingClientId } : {}) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save client.');
      let leadStageUpdated = true;
      if (!editingClientId && convertedLeadId) {
        const leadResponse = await fetch('/api/admin/leads', {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: convertedLeadId, stage: 'qualified' })
        });
        const leadData = await leadResponse.json();
        if (leadResponse.ok) setLeads(current => current.map(item => item.id === convertedLeadId ? leadData.lead : item));
        else leadStageUpdated = false;
      }
      await load();
      setClientForm({ businessName: '', firstName: '', lastName: '', email: '', phone: '' });
      setShowClientForm(false); setEditingClientId(''); setSourceLeadId('');
      setClientNotice(editingClientId ? 'Client details updated. Existing signed agreements keep their original details.' : convertedLeadId
        ? leadStageUpdated ? 'Client saved from this lead. The lead is now qualified; create an agreement from the client record.' : 'Client saved, but the lead stage did not update. Refresh Leads and set it to Qualified.'
        : data.existing ? 'That business and email are already in your client list.' : 'Client saved. Create an agreement from this client record below.');
    } catch (e) { setClientNotice(e.message || 'Could not save client.'); }
    finally { setClientBusy(false); }
  };

  const markClientFormer = async (client) => {
    if (!window.confirm(`Mark ${client.business_name} as a former client? Their agreements and Stripe billing will remain unchanged. This only prevents creating new agreements from this client record.`)) return;
    try {
      const response = await fetch('/api/admin/clients', {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: client.id, action: 'former' })
      });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not update client status.');
      await load(); setClientNotice(`${client.business_name} is marked as a former client. Existing Stripe billing was not changed.`);
    } catch (e) { setClientNotice(e.message || 'Could not update client status.'); }
  };

  const restoreClient = async (client) => {
    try {
      const response = await fetch('/api/admin/clients', {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: client.id, action: 'restore' })
      });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not restore client.');
      await load(); setClientNotice(`${client.business_name} is active in the CRM again.`);
    } catch (e) { setClientNotice(e.message || 'Could not restore client.'); }
  };

  const editClient = (client) => {
    setSourceLeadId('');
    setEditingClientId(client.id); setShowClientForm(false);
    setClientForm({ businessName: client.business_name, firstName: client.first_name, lastName: client.last_name, email: client.email, phone: client.phone || '' });
    setClientNotice(''); navigateSection('crm-clients');
  };

  const createClientFromLead = (lead) => {
    const nameParts = String(lead.name || '').trim().split(/\s+/).filter(Boolean);
    setEditingClientId(''); setSourceLeadId(lead.id); setShowClientForm(true);
    setClientForm({
      businessName: lead.business || '', firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' '), email: lead.email || '', phone: lead.phone || ''
    });
    setClientNotice('Review the lead details, add or correct the business name, then save to create the client record.');
    navigateSection('crm-clients');
  };

  const updateLead = async (lead, stage) => {
    try {
      const response = await fetch('/api/admin/leads', { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id, stage }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not update lead.');
      setLeads(current => current.map(item => item.id === lead.id ? data.lead : item));
    } catch (e) { setLeadsWarning(e.message); }
  };
  const saveTask = async (event) => {
    event.preventDefault(); setTaskBusy(true); setTasksWarning('');
    try {
      const response = await fetch('/api/admin/tasks', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(taskForm) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not save task.');
      setTasks(current => [data.task, ...current]); setTaskForm({ title: '', dueAt: '', priority: 'normal', details: '' });
    } catch (e) { setTasksWarning(e.message); }
    finally { setTaskBusy(false); }
  };
  const updateTask = async (task, patch) => {
    try {
      const response = await fetch('/api/admin/tasks', { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, ...patch }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not update task.');
      setTasks(current => current.map(item => item.id === task.id ? data.task : item));
    } catch (e) { setTasksWarning(e.message); }
  };
  const deleteTask = async (task) => {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    try {
      const response = await fetch(`/api/admin/tasks?id=${encodeURIComponent(task.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not delete task.');
      setTasks(current => current.filter(item => item.id !== task.id));
    } catch (e) { setTasksWarning(e.message); }
  };

  return <main className="crm-shell">
    <header className="crm-header"><a href="/" className="crm-brand"><img src={brand.mark} alt="" /><span>Arveno Growth <small>CLIENT CRM</small></span></a><div className="crm-user"><span>{email}</span><button onClick={load} aria-label="Refresh CRM"><RefreshCw size={17} /></button><button onClick={onLogout}><LogOut size={17} /> Sign out</button></div></header>
    <div className="crm-workspace">
    <nav className="crm-sidebar" aria-label="Admin sections">
      <p>WORKSPACE</p>
      <div className="crm-sidebar-links">
        <a href="#crm-overview" aria-current={activeSection === 'crm-overview' ? 'page' : undefined} onClick={e => { e.preventDefault(); navigateSection('crm-overview'); }}><LayoutDashboard size={16} /> Overview</a>
        <a href="#crm-leads" aria-current={activeSection === 'crm-leads' ? 'page' : undefined} onClick={e => { e.preventDefault(); navigateSection('crm-leads'); }}><UserRoundPlus size={16} /> Leads <span>{leads.filter(lead => lead.stage === 'new').length} new</span></a>
        <a href="#crm-clients" aria-current={activeSection === 'crm-clients' ? 'page' : undefined} onClick={e => { e.preventDefault(); navigateSection('crm-clients'); }}><Users size={16} /> Clients <span>{clients.filter(client => !client.former_at).length}</span></a>
        <a href="#crm-programs" aria-current={activeSection === 'crm-programs' ? 'page' : undefined} onClick={e => { e.preventDefault(); navigateSection('crm-programs'); }}><BriefcaseBusiness size={16} /> Packages</a>
        <a href="#crm-contracts" aria-current={activeSection === 'crm-contracts' ? 'page' : undefined} onClick={e => { e.preventDefault(); navigateSection('crm-contracts'); }}><FileText size={16} /> Contracts</a>
        <a href="#crm-meetings" aria-current={activeSection === 'crm-meetings' ? 'page' : undefined} onClick={e => { e.preventDefault(); navigateSection('crm-meetings'); }}><CalendarDays size={16} /> Meetings</a>
        <a href="#crm-billing" aria-current={activeSection === 'crm-billing' ? 'page' : undefined} onClick={e => { e.preventDefault(); navigateSection('crm-billing'); }}><CreditCard size={16} /> Billing</a>
        <a href="#crm-tasks" aria-current={activeSection === 'crm-tasks' ? 'page' : undefined} onClick={e => { e.preventDefault(); navigateSection('crm-tasks'); }}><ListTodo size={16} /> Tasks <span>{tasks.filter(task => task.status !== 'done').length}</span></a>
        <a href="#crm-integrations" aria-current={activeSection === 'crm-integrations' ? 'page' : undefined} onClick={e => { e.preventDefault(); navigateSection('crm-integrations'); }}><PlugZap size={16} /> Connections</a>
      </div>
      <label className="crm-mobile-nav"><span>Go to</span><select aria-label="Go to CRM section" value={activeSection} onChange={event => navigateSection(event.target.value)}>{Object.entries(sections).map(([id, section]) => <option key={id} value={id}>{section[0]}</option>)}</select></label>
    </nav>
    <div className="crm-main-column">
    <section className="crm-welcome"><div><p className="crm-kicker">PRIVATE WORKSPACE</p><h1>{sections[activeSection][0]}</h1><p className="crm-muted">{sections[activeSection][1]}</p></div><div className="crm-welcome-actions">{!['crm-overview', 'crm-clients'].includes(activeSection) && <button className="crm-primary" onClick={startNewClient}><FilePlus2 size={16} /> Add client</button>}<button className="crm-secondary" onClick={load}><RefreshCw size={16} /> Refresh</button></div></section>
    <section className="crm-overview-page" hidden={activeSection !== 'crm-overview'}>
      <div className="crm-metrics" aria-label="CRM overview">
      <article><span><BriefcaseBusiness size={17} /> Active clients</span><strong>{activeClientCount}</strong><small>Clients with active monthly service</small></article>
      <article><span><UserRoundPlus size={17} /> Website leads</span><strong>{leads.length}</strong><small>Real submissions in the CRM</small></article>
      <article><span><CalendarDays size={17} /> Upcoming meetings</span><strong>{meetingsWarning ? '—' : upcomingMeetings.length}</strong><small>{meetingsWarning ? 'Connect Calendly to sync bookings' : 'Upcoming Calendly bookings'}</small></article>
      <article><span><ListTodo size={17} /> Open tasks</span><strong>{tasks.filter(task => task.status !== 'done').length}</strong><small>Follow-ups still to complete</small></article>
      </div>
      <div className="crm-overview-links" aria-label="Quick actions">
        <button onClick={() => navigateSection('crm-leads')}><UserRoundPlus size={16} /> Review new leads</button>
        <button onClick={() => navigateSection('crm-billing')}><CreditCard size={16} /> Open client billing</button>
      </div>
      <section className="crm-workflow-guide" aria-labelledby="crm-workflow-title">
        <div><h2 id="crm-workflow-title">New client workflow</h2><p>Keep each client, signed agreement, and payment record connected.</p></div>
        <ol>
          <li><span>1</span><div><strong>Add the business</strong><small>Save the company and contact person once.</small></div><button className="crm-row-action" onClick={startNewClient}>Add client</button></li>
          <li><span>2</span><div><strong>Create and send the agreement</strong><small>Open the client record and choose Create contract.</small></div><button className="crm-row-action" onClick={() => navigateSection('crm-clients')}>Find client</button></li>
          <li><span>3</span><div><strong>Track payments in one place</strong><small>Send setup or optional deposit links and review receipts here.</small></div><button className="crm-row-action" onClick={() => navigateSection('crm-billing')}>Open billing</button></li>
        </ol>
      </section>
    </section>
    <section className="crm-list-panel" id="crm-meetings" hidden={activeSection !== 'crm-meetings'} aria-labelledby="crm-meetings-title">
      <div className="crm-list-head"><div><h2 id="crm-meetings-title">Meetings</h2><p>Upcoming bookings and the 100 most recent past meetings from Calendly.</p></div><button className="crm-secondary" onClick={load}><RefreshCw size={15} /> Refresh meetings</button></div>
      {!meetingsWarning && <div className="crm-meeting-tabs" role="tablist" aria-label="Meeting date range">
        <button type="button" role="tab" aria-selected={meetingsView === 'upcoming'} onClick={() => setMeetingsView('upcoming')}>Upcoming <span>{upcomingMeetings.length}</span></button>
        <button type="button" role="tab" aria-selected={meetingsView === 'past'} onClick={() => setMeetingsView('past')}>Past <span>{pastMeetings.length}</span></button>
      </div>}
      {meetingsWarning ? <p className="crm-setup-note crm-banner" role="status">{meetingsWarning}</p> : visibleMeetings.length ? <div className="crm-meeting-grid">{visibleMeetings.map((meeting) => {
        const invitee = meeting.invitees?.[0];
        const joinUrl = /^https:\/\//i.test(meeting.location) ? meeting.location : '';
        return <article className="crm-meeting-card" key={meeting.id}>
          <div className="crm-meeting-card-head"><span className="crm-meeting-icon"><Video size={16} /></span><strong>{meeting.name}</strong></div>
          <p className="crm-meeting-time">{meetingTime(meeting.startTime, invitee?.timezone)}</p>
          {invitee && <p className="crm-meeting-invitee">{invitee.name || 'Invitee'}{invitee.email ? <> · <a href={`mailto:${encodeURIComponent(invitee.email)}`}>{invitee.email}</a></> : ''}</p>}
          {meeting.locationKind && <p className="crm-meeting-location">{meeting.locationKind.replaceAll('_', ' ')}</p>}
          {meetingsView === 'upcoming' && <div className="crm-meeting-actions">{joinUrl && <a className="crm-row-action" href={joinUrl} target="_blank" rel="noreferrer">Join meeting</a>}{invitee?.rescheduleUrl && <a className="crm-row-action" href={invitee.rescheduleUrl} target="_blank" rel="noreferrer">Reschedule</a>}{invitee?.cancelUrl && <a className="crm-row-action" href={invitee.cancelUrl} target="_blank" rel="noreferrer">Cancel</a>}</div>}
        </article>;
      })}</div> : <p className="crm-empty">{meetingsView === 'past' ? 'No past Calendly meetings in the recent history.' : 'No upcoming Calendly bookings.'}</p>}
    </section>
    <section className="crm-list-panel" id="crm-leads" hidden={activeSection !== 'crm-leads'}>
      <div className="crm-list-head"><div><h2>Website leads</h2><p>{leads.length} real submission{leads.length === 1 ? '' : 's'} · newest first</p></div><button className="crm-secondary" onClick={load}><RefreshCw size={15} /> Refresh leads</button></div>
      {leadsWarning && <p className="crm-error crm-banner" role="alert">{leadsWarning}</p>}
      {leads.length === 0 ? <p className="crm-empty">No website leads have been saved yet. New form submissions will appear here.</p> : <div className="crm-table-wrap"><table className="crm-table crm-leads-table"><thead><tr><th>Contact</th><th>Business</th><th>Request</th><th>Received</th><th>Stage</th><th>Next step</th></tr></thead><tbody>{leads.map(lead => <tr key={lead.id}><td data-label="Contact"><strong>{lead.name}</strong><span><a href={`mailto:${encodeURIComponent(lead.email)}`}>{lead.email}</a>{lead.phone ? <> · <a href={`tel:${encodeURIComponent(lead.phone)}`}>{lead.phone}</a></> : ''}</span></td><td data-label="Business">{lead.business || '—'}{lead.city ? <span>{lead.city}</span> : ''}</td><td data-label="Request">{lead.services || '—'}{lead.website && <span><a href={/^https?:/i.test(lead.website) ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer">Website</a></span>}</td><td data-label="Received">{stamp(lead.created_at)}</td><td data-label="Stage"><select aria-label={`Stage for ${lead.name}`} value={lead.stage} onChange={e => updateLead(lead, e.target.value)}>{['new', 'contacted', 'qualified', 'won', 'lost'].map(stage => <option key={stage} value={stage}>{stage[0].toUpperCase() + stage.slice(1)}</option>)}</select></td><td data-label="Next step"><button className="crm-row-action" onClick={() => createClientFromLead(lead)}>Add as client</button></td></tr>)}</tbody></table></div>}
    </section>
    <section className="crm-list-panel" id="crm-clients" hidden={activeSection !== 'crm-clients'}>
      <div className="crm-list-head"><div><h2>Clients</h2><p>{clients.length} saved client{clients.length === 1 ? '' : 's'} · business and contact details are stored separately from agreements</p></div><button className="crm-primary" onClick={() => { setEditingClientId(''); setSourceLeadId(''); setClientForm({ businessName: '', firstName: '', lastName: '', email: '', phone: '' }); setShowClientForm(x => !x); setClientNotice(''); }}><FilePlus2 size={16} /> {showClientForm ? 'Cancel' : 'Add client'}</button></div>
      {clientNotice && <p className="crm-success crm-banner" role="status">{clientNotice}</p>}
      {(showClientForm || editingClientId) && <form className="crm-client-form" onSubmit={saveClient}>
        {sourceLeadId && <p className="crm-client-form-note">Lead details are prefilled. Check the business and contact information before saving.</p>}
        <label>Business name<input required maxLength={160} value={clientForm.businessName} onChange={e => setClientForm(x => ({ ...x, businessName: e.target.value }))} /></label>
        <label>First name<input required maxLength={80} autoComplete="given-name" value={clientForm.firstName} onChange={e => setClientForm(x => ({ ...x, firstName: e.target.value }))} /></label>
        <label>Last name<input required maxLength={80} autoComplete="family-name" value={clientForm.lastName} onChange={e => setClientForm(x => ({ ...x, lastName: e.target.value }))} /></label>
        <label>Email<input required type="email" maxLength={200} autoComplete="email" value={clientForm.email} onChange={e => setClientForm(x => ({ ...x, email: e.target.value }))} /></label>
        <label>Phone <span>(optional)</span><input type="tel" maxLength={40} autoComplete="tel" value={clientForm.phone} onChange={e => setClientForm(x => ({ ...x, phone: e.target.value }))} /></label>
        <div className="flex gap-2"><button className="crm-primary" disabled={clientBusy}>{clientBusy ? 'Saving…' : editingClientId ? 'Save changes' : 'Save client'}</button><button type="button" className="crm-secondary" onClick={() => { setShowClientForm(false); setEditingClientId(''); setSourceLeadId(''); setClientForm({ businessName: '', firstName: '', lastName: '', email: '', phone: '' }); }}>{editingClientId ? 'Cancel edit' : 'Cancel'}</button></div>
      </form>}
      {clients.length === 0 ? <p className="crm-empty">No client records yet. Add a client here first, then create their agreement from the client row.</p> : <div className="crm-client-grid">{clients.map(client => {
        const clientContracts = rows.filter(row => row.client_id === client.id);
        const active = clientContracts.some(row => row.onboarding_status === 'active' && row.stripe_subscription_status === 'active');
        const attention = clientContracts.some(row => row.onboarding_status === 'payment_issue' || row.stripe_subscription_status === 'past_due');
        const onboarding = !active && clientContracts.some(row => row.status === 'signed' && row.onboarding_status !== 'inactive');
        const hasDraft = clientContracts.some(row => row.status === 'draft');
        const state = client.former_at ? 'Former client' : active ? 'Active' : attention ? 'Payment issue' : onboarding ? 'Onboarding' : hasDraft ? 'Draft agreement' : clientContracts.length ? 'Past client' : 'New client';
        const activeContracts = clientContracts.filter(row => ['active', 'trialing'].includes(row.stripe_subscription_status));
        const monthlyTotal = activeContracts.reduce((sum, row) => sum + Number(row.stripe_current_monthly_fee ?? row.monthly_fee ?? 0), 0);
        const clientPaymentRows = payments.filter(payment => clientContracts.some(row => row.id === payment.contract_id));
        return <article className="crm-client-card" key={client.id}><div><strong>{client.business_name}</strong><span>{client.first_name} {client.last_name} · <a href={`mailto:${encodeURIComponent(client.email)}`}>{client.email}</a>{client.phone ? <> · <a href={`tel:${encodeURIComponent(client.phone)}`}>{client.phone}</a></> : ''}</span><small><b className={`crm-client-state ${active && !client.former_at ? 'is-active' : ''}`}>{state}</b> · {clientContracts.length} agreement{clientContracts.length === 1 ? '' : 's'}{activeContracts.length > 0 ? ` · ${money(monthlyTotal, activeContracts[0].currency || 'USD')}/month active` : ''}{client.stripe_customer_id ? ' · Stripe linked' : ''}</small>
          {clientContracts.length > 0 && <div className="crm-client-engagements">{clientContracts.map(contract => {
            const serviceLabels = Array.isArray(contract.agreement?.services) ? contract.agreement.services : [];
            const contractActive = ['active', 'trialing'].includes(contract.stripe_subscription_status);
            const contractPayments = clientPaymentRows.filter(payment => payment.contract_id === contract.id);
            return <details className="crm-client-engagement" key={contract.id}><summary><span><strong>{contract.package_name || 'Custom program'}</strong><small>{money(contract.stripe_current_monthly_fee ?? contract.monthly_fee, contract.currency)}/month · {clientStage(contract)}</small></span><span className={`crm-client-state ${contractActive ? 'is-active' : ''}`}>{clientStage(contract)}</span></summary><div className="crm-client-engagement-body"><p><b>Contract</b> {contract.reference} · {contract.agreement?.term || 'Term in agreement'} · {money(contract.setup_fee, contract.currency)} setup</p><p><b>Setup</b> {setupPaymentLabel(contract)} · {setupTimeline(contract, contractPayments)}</p>{contract.stripe_current_monthly_fee != null && Number(contract.stripe_current_monthly_fee) !== Number(contract.monthly_fee) && <p><b>Signed monthly fee</b> {money(contract.monthly_fee, contract.currency)} · Stripe currently bills {money(contract.stripe_current_monthly_fee, contract.currency)}</p>}{serviceLabels.length > 0 && <><b>Included services</b><ul>{serviceLabels.map((service, index) => <li key={`${contract.id}-${index}`}>{service}</li>)}</ul></>}<p><b>Verified payments</b> {contractPayments.length} · {money(contractPayments.reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0), contract.currency)}</p><button className="crm-row-action" onClick={() => { setBillingClientFilter(client.id); navigateSection('crm-billing'); }}>View billing & receipts</button>{contract.signed_pdf_path && <button className="crm-row-action" onClick={() => download(contract)}>Open signed contract PDF</button>}{contract.stripe_subscription_id && <a className="crm-row-action" href={`https://dashboard.stripe.com/subscriptions/${encodeURIComponent(contract.stripe_subscription_id)}`} target="_blank" rel="noreferrer">Manage subscription in Stripe</a>}</div></details>;
          })}</div>}
          <div className="mt-2 flex flex-wrap gap-2"><button className="crm-row-action" onClick={() => editClient(client)}>Edit client</button>{client.former_at ? <button className="crm-row-action" onClick={() => restoreClient(client)}>Restore client</button> : <button className="crm-row-action" onClick={() => markClientFormer(client)}>Mark former</button>}{!client.former_at && <a className="crm-row-action" href={`/contract?clientId=${encodeURIComponent(client.id)}`}><FilePlus2 size={13} /> Create contract</a>}</div></div></article>;
      })}</div>}
    </section>
    <section className="crm-programs-grid" id="crm-programs" hidden={activeSection !== 'crm-programs'} aria-label="Available service programs">
      {PACKAGE_PRESETS.map(program => <article className="crm-program-card" key={program.name}><div><p className="crm-kicker">ARVENO PROGRAM</p><h2>{program.name}</h2><p>{program.summary}</p></div><div className="crm-program-price"><strong>{money(program.monthlyFee, program.currency)}<small>/month</small></strong><span>{money(packageSetupFee(program), program.currency)} setup · {program.term}</span></div><h3>Included features</h3><ul>{program.services.map((service, index) => <li key={`${program.name}-${index}`}>{service}</li>)}</ul><a className="crm-row-action" href="/contract">Open contract builder</a></article>)}
    </section>
    <section className="crm-list-panel" id="crm-contracts" hidden={activeSection !== 'crm-contracts'}>
      <div className="crm-list-head"><div><h2>Agreements</h2><p>{visible.length} record{visible.length === 1 ? '' : 's'} shown · create a contract from its client record</p></div><label className="crm-search"><Search size={17} /><input aria-label="Search contracts" placeholder="Search client, contact, or email" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      <div className="crm-tabs" aria-label="Filter contracts">{['all', 'sent', 'signed', 'draft', 'archived'].map(x => <button key={x} className={filter === x ? 'active' : ''} onClick={() => setFilter(x)}>{x === 'all' ? 'All records' : x[0].toUpperCase() + x.slice(1)}</button>)}</div>
      {error && <p className="crm-error crm-banner" role="alert">{error}</p>}
      {billingWarning && <p className="crm-error crm-banner" role="alert">{billingWarning}</p>}
      {billingNotice && <p className="crm-success crm-banner" role="status">{billingNotice}</p>}
      {busy ? <p className="crm-empty">Loading your private records…</p> : visible.length === 0 ? <div className="crm-empty">{rows.length ? 'No contracts match this search.' : <>No agreements yet. Start by adding a client, then choose <strong>Create contract</strong> on their client card.<div className="mt-4"><button className="crm-primary" onClick={() => navigateSection('crm-clients')}><UserRoundPlus size={15} /> Go to clients</button></div></>}</div> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Client</th><th>Package</th><th>Setup</th><th>Monthly</th><th>Status</th><th>Onboarding</th><th>Collected</th><th>Signed</th><th>Actions</th></tr></thead><tbody>{visible.map(row => {
        const rowPayments = payments.filter(p => p.contract_id === row.id);
        const paid = rowPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
        const servicePayments = rowPayments.filter(p => p.billing_kind === 'service_monthly').length;
        const commitmentMatch = Number(row.agreement?.contractVersion || 0) >= 4 ? String(row.agreement?.term || '').match(/^(\d+)\s+months?$/i) : null;
        const setupPaid = ['paid', 'not_required'].includes(row.setup_payment_status) || Number(row.setup_fee || 0) === 0 || (row.setup_payment_status === 'partial' && Number(row.setup_installments_paid || 0) > 0);
        const pending = billingBusy === row.id;
        return <tr key={row.id}>
          <td><strong>{row.client_business}</strong><span>{row.client_contact} · <a href={`mailto:${encodeURIComponent(row.client_email)}`}>{row.client_email}</a></span></td>
          <td>{row.package_name || 'Custom scope'}</td><td>{money(row.setup_fee, row.currency)}</td><td>{money(row.monthly_fee, row.currency)}</td>
          <td><span className={`crm-status status-${row.status}`}>{row.status}</span></td>
          <td><span className={`crm-status status-${row.onboarding_status || (row.status === 'signed' ? 'signed' : row.status === 'draft' ? 'draft' : 'contract_sent')}`}>{clientStage(row)}</span><span className="crm-row-substatus">{setupPaymentLabel(row)}</span>{row.status === 'signed' && <span className="crm-row-substatus">{setupTimeline(row, rowPayments)}</span>}</td>
          <td><strong>{money(paid, row.currency)}</strong>{rowPayments.length > 0 && <span>{rowPayments.length} verified payment{rowPayments.length === 1 ? '' : 's'}</span>}{commitmentMatch && <span>{Math.min(servicePayments, Number(commitmentMatch[1]))}/{commitmentMatch[1]} monthly payments</span>}</td>
          <td>{row.signed_by ? <>{row.signed_by}<span>{stamp(row.signed_at)}</span></> : '—'}</td>
          <td className="crm-actions-cell">
            {billingReady && row.status === 'signed' && Number(row.setup_fee || 0) > 0 && !setupPaid && row.setup_payment_status !== 'partial' && <button className="crm-row-action" disabled={pending} onClick={() => billingAction(row, 'setup', row.agreement?.setupPayment === 'threeMonthly' ? 'three_monthly' : 'full')}>{pending ? 'Working…' : row.agreement?.setupPayment === 'threeMonthly' ? 'Setup · 3 months' : 'Setup payment link'}</button>}
            {billingReady && row.status === 'signed' && Number(row.setup_fee || 0) === 0 && Number(row.monthly_fee || 0) > 0 && !row.stripe_payment_method_id && <button className="crm-row-action" disabled={pending} onClick={() => billingAction(row, 'payment_method')}>{pending ? 'Working…' : 'Collect payment method'}</button>}
            {billingReady && row.status === 'signed' && setupPaid && !row.setup_completed_at && (Boolean(row.setup_started_at) || Boolean(row.stripe_payment_method_id)) && <button className="crm-row-action" disabled={pending} onClick={() => billingAction(row, 'mark_setup_complete')}>{pending ? 'Working…' : 'Mark setup complete'}</button>}
            {billingReady && row.status === 'signed' && Number(row.agreement?.contractVersion || 0) < 7 && (Number(row.agreement?.contractVersion || 0) >= 6 || row.setup_completed_at) && !['active', 'trialing'].includes(row.stripe_subscription_status) && <button className="crm-row-action" disabled={pending} onClick={() => billingAction(row, 'service')}>{pending ? 'Working…' : row.stripe_service_checkout_session_id ? 'Renew monthly link' : 'Monthly checkout link'}</button>}
            {row.stripe_subscription_status === 'pending_payment' && <span className="crm-row-substatus">Stripe payment confirmation pending</span>}
            {row.stripe_subscription_status === 'trialing' && <span className="crm-row-substatus">Stripe will start monthly billing 14 days after the first setup payment</span>}
            {row.stripe_subscription_status === 'active' && commitmentMatch && <span className="crm-row-substatus">{row.stripe_subscription_end_at ? `Scheduled to stop ${stamp(row.stripe_subscription_end_at)}` : `Auto-stops after ${commitmentMatch[1]} monthly payments`}</span>}
            {row.stripe_subscription_status === 'active' && Number(row.agreement?.contractVersion || 0) >= 4 && row.agreement?.term === 'Month-to-month' && <span className="crm-row-substatus">Renews monthly until canceled</span>}
            {row.stripe_latest_invoice_url && <a className="crm-row-action" href={row.stripe_latest_invoice_url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open unpaid Stripe invoice</a>}
            {row.signing_url && !row.signed_at && <><a className="crm-row-action" href={row.signing_url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open signing link</a><button className="crm-row-action" onClick={() => contractAction(row, 'send_link')}>Email signing link</button><button className="crm-row-action" onClick={() => copySigning(row)}><Copy size={13} /> Copy signing link</button><span className="crm-row-substatus">Expires {row.signing_expires_at ? new Date(row.signing_expires_at).toLocaleString() : 'not set'}</span></>}
            {!row.signed_at && ['sent', 'draft'].includes(row.status) && row.signing_expires_at && Date.parse(row.signing_expires_at) <= Date.now() && <button className="crm-row-action" onClick={() => contractAction(row, 'renew_link')}>Renew 24-hour signing link</button>}
            {checkoutLinks[row.id] && <><a className="crm-row-action" href={checkoutLinks[row.id].url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open link</a><button className="crm-row-action" onClick={() => copyCheckout(row)}><Copy size={13} /> Copy link</button></>}
            {row.signed_pdf_path && <button className="crm-row-action" onClick={() => download(row)}>Signed PDF</button>}
            {row.signed_at && row.signed_pdf_path && <span className="crm-row-substatus">{row.verified_at ? `Verified by ${row.verified_by || 'Admin'} · ${stamp(row.verified_at)}` : 'Signed PDF pending Admin verification'}</span>}
            {row.signed_at && row.signed_pdf_path && !row.verified_at && <button className="crm-row-action" onClick={() => contractAction(row, 'verify')}>Verify signed PDF</button>}
            {row.status !== 'archived' && <button className="crm-row-action" onClick={() => setStatus(row, 'archived')}>Archive</button>}
            {row.status === 'archived' && <button className="crm-row-action" onClick={() => setStatus(row, 'sent')}>Restore</button>}
          </td>
        </tr>;
      })}</tbody></table></div>}
    </section>
    <section className="crm-list-panel" id="crm-billing" hidden={activeSection !== 'crm-billing'}>
      <div className="crm-list-head"><div><h2>Client billing</h2><p>Signed agreement terms, Stripe’s current monthly amount, payment history, and receipts. Get a signed amendment before changing a price.</p></div><label className="crm-search"><Users size={16} /><select aria-label="Filter billing by client" value={billingClientFilter} onChange={e => setBillingClientFilter(e.target.value)}><option value="all">All clients</option>{clients.map(client => <option key={client.id} value={client.id}>{client.business_name}</option>)}</select></label></div>
      {billingWarning && <p className="crm-setup-note crm-banner" role="status">{billingWarning}</p>}
      {billingNotice && <p className="crm-success crm-banner" role="status">{billingNotice}</p>}
      <div className="crm-list-head crm-receipts-head"><div><h3>Reservation deposits</h3><p>Create a one-time Stripe link to reserve a client’s start slot. Payment is recorded only after Stripe confirms it.</p></div></div>
      <form className="crm-task-form crm-deposit-form" onSubmit={event => { event.preventDefault(); reservationAction('create'); }}>
        <label>Client<select required value={depositForm.clientId} onChange={e => setDepositForm(current => ({ ...current, clientId: e.target.value }))}><option value="">Choose a client</option>{clients.filter(client => !client.former_at).map(client => <option key={client.id} value={client.id}>{client.business_name} · {client.first_name} {client.last_name}</option>)}</select></label>
        <label>Deposit amount<input required name="depositAmount" type="number" inputMode="decimal" autoComplete="off" min="1" max="100000" step="0.01" placeholder="e.g. 500.00" value={depositForm.amount} onChange={e => setDepositForm(current => ({ ...current, amount: e.target.value }))} /></label>
        <label>Currency<select value={depositForm.currency} onChange={e => setDepositForm(current => ({ ...current, currency: e.target.value }))}><option value="USD">USD</option><option value="CAD">CAD</option></select></label>
        <button className="crm-primary" disabled={Boolean(depositBusy) || !depositForm.clientId || !Number.isFinite(Number(depositForm.amount)) || Number(depositForm.amount) <= 0}>{depositBusy === 'create' ? 'Creating…' : 'Create Stripe link'}</button>
      </form>
      <p className="crm-deposit-help">This creates a one-time checkout link. The client is charged only if they pay on Stripe; it does not start monthly billing or change a signed agreement. To apply the deposit to setup, record the credit in a signed amendment first. Refunds go back through Stripe, and its original processing fee may not be returned.</p>
      {deposits.length > 0 ? <div className="crm-table-wrap"><table className="crm-table crm-deposit-table"><thead><tr><th>Client</th><th>Created / paid</th><th>Deposit</th><th>Status</th><th>Receipt / link</th><th>Action</th></tr></thead><tbody>{deposits.filter(item => billingClientFilter === 'all' || item.client_id === billingClientFilter).map(item => {
        const client = clients.find(c => c.id === item.client_id);
        return <tr key={item.id}><td><strong>{client?.business_name || 'Client'}</strong><span>{client ? `${client.first_name} ${client.last_name}` : 'Client record'}</span></td><td>{stamp(item.paid_at || item.created_at)}</td><td>{money(item.amount, item.currency)}</td><td>{item.status.replaceAll('_', ' ')}</td><td>{item.receipt_url ? <a className="crm-row-action" href={item.receipt_url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open receipt</a> : item.checkout_url && item.status === 'checkout_pending' ? <><a className="crm-row-action" href={item.checkout_url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open checkout link</a><button className="crm-row-action" onClick={async () => { try { await navigator.clipboard.writeText(item.checkout_url); setBillingNotice('Reservation deposit link copied.'); } catch { setBillingWarning('Copy was blocked by the browser. Open the Stripe checkout link and copy it from the address bar.'); } }}>Copy link</button></> : '—'}</td><td className="crm-actions-cell">{['paid', 'partially_refunded'].includes(item.status) && <button className="crm-row-action" disabled={Boolean(depositBusy)} onClick={() => reservationAction('refund', item)}>{depositBusy === item.id ? 'Processing…' : item.status === 'partially_refunded' ? 'Refund remaining' : 'Full refund'}</button>}{item.status === 'refund_pending' && <span>Refund pending in Stripe</span>}{['checkout_expired', 'checkout_failed', 'payment_failed'].includes(item.status) && <button className="crm-row-action" disabled={Boolean(depositBusy)} onClick={() => reservationAction('renew', item)}>{depositBusy === item.id ? 'Creating…' : 'Renew checkout link'}</button>}</td></tr>;
      })}</tbody></table></div> : <p className="crm-empty">No reservation deposits have been created.</p>}
      {(() => {
        const billingRows = rows.filter(row => (billingClientFilter === 'all' || row.client_id === billingClientFilter) && (row.stripe_latest_invoice_url || payments.some(payment => payment.contract_id === row.id) || row.status === 'signed'));
        const contractIds = new Set(billingRows.map(row => row.id));
        const billingPayments = payments.filter(payment => contractIds.has(payment.contract_id));
        return <>
      <div className="crm-table-wrap"><table className="crm-table crm-billing-table"><thead><tr><th>Client / contract</th><th>Latest invoice</th><th>Setup status</th><th>Monthly billing</th><th>Verified paid</th><th>Action</th></tr></thead><tbody>{billingRows.map(row => {
        const rowPayments = payments.filter(payment => payment.contract_id === row.id);
        const setupPaid = ['paid', 'not_required'].includes(row.setup_payment_status) || Number(row.setup_fee || 0) === 0 || (row.setup_payment_status === 'partial' && Number(row.setup_installments_paid || 0) > 0);
        const pending = billingBusy === row.id;
        const setupMode = row.agreement?.setupPayment === 'threeMonthly' ? 'three_monthly' : 'full';
        return <tr key={row.id}>
          <td><strong>{row.client_business}</strong><span>{row.reference} · {row.package_name || 'Custom scope'}</span></td>
          <td>{row.stripe_latest_invoice_url ? <a className="crm-row-action" href={row.stripe_latest_invoice_url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open Stripe invoice</a> : 'No Stripe invoice recorded'}</td>
          <td>{setupPaymentLabel(row)}<span>{row.status === 'signed' ? setupTimeline(row, rowPayments) : row.status === 'draft' ? 'Setup timeline starts after signature and first payment.' : 'Setup timeline starts after signature and first payment.'}</span></td>
          <td>{clientStage(row)}{row.stripe_subscription_end_at && <span>Ends {stamp(row.stripe_subscription_end_at)}</span>}{row.stripe_subscription_status === 'trialing' && <span>First monthly charge scheduled for {stampTime(row.setup_started_at ? new Date(Date.parse(row.setup_started_at) + 14 * 86400000).toISOString() : '')}</span>}</td>
          <td>{money(rowPayments.reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0), row.currency || 'USD')}{row.stripe_current_monthly_fee != null && Number(row.stripe_current_monthly_fee) !== Number(row.monthly_fee) && <span>Signed: {money(row.monthly_fee, row.currency)} · Stripe: {money(row.stripe_current_monthly_fee, row.currency)}/mo</span>}</td>
          <td className="crm-actions-cell">{billingReady && row.status === 'signed' && Number(row.setup_fee || 0) > 0 && !setupPaid && row.setup_payment_status !== 'partial'
            ? <button className="crm-row-action" disabled={pending} onClick={() => billingAction(row, 'setup', setupMode)}>{pending ? 'Working…' : `Create & email ${money(row.setup_fee, row.currency)} setup link`}</button>
            : row.setup_payment_status === 'partial' ? 'Setup installments already in progress' : row.status !== 'signed' ? 'Available after signature' : setupPaid ? 'Setup payment recorded' : 'No setup payment due'}
          {row.stripe_subscription_id && <a className="crm-row-action" href={`https://dashboard.stripe.com/subscriptions/${encodeURIComponent(row.stripe_subscription_id)}`} target="_blank" rel="noreferrer">Manage subscription in Stripe</a>}
          {checkoutLinks[row.id] && <><a className="crm-row-action" href={checkoutLinks[row.id].url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open link</a><button className="crm-row-action" onClick={() => copyCheckout(row)}><Copy size={13} /> Copy link</button></>}</td>
        </tr>;
      })}</tbody></table></div>
      {billingRows.length === 0 && <p className="crm-empty">No signed agreements or Stripe records for this client yet.</p>}
      <div className="crm-list-head crm-receipts-head"><div><h3>Payments & receipts</h3><p>{billingPayments.length} verified payment{billingPayments.length === 1 ? '' : 's'} · receipts open directly in Stripe</p></div></div>
      {billingPayments.length > 0 ? <div className="crm-table-wrap"><table className="crm-table crm-receipts-table"><thead><tr><th>Client / contract</th><th>Paid</th><th>Payment</th><th>Amount</th><th>Receipt</th></tr></thead><tbody>{billingPayments.map(payment => {
        const contract = billingRows.find(row => row.id === payment.contract_id);
        const label = ({ setup_full: 'Setup payment', setup_installment: 'Setup installment', service_monthly: 'Monthly service', refund: 'Refund' })[payment.billing_kind] || payment.billing_kind.replaceAll('_', ' ');
        return <tr key={payment.id}><td><strong>{contract?.client_business || 'Client'}</strong><span>{contract?.reference || 'Agreement'}</span></td><td>{stamp(payment.paid_at)}</td><td>{label}</td><td>{money(payment.amount_paid, payment.currency || contract?.currency || 'USD')}</td><td>{payment.receipt_url ? <a className="crm-row-action" href={payment.receipt_url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open receipt</a> : <span className="crm-row-substatus">Receipt link unavailable for this payment</span>}</td></tr>;
      })}</tbody></table></div> : <p className="crm-empty">No verified payments yet. Receipt links appear automatically after Stripe confirms a payment.</p>}
        </>;
      })()}
    </section>
    <section className="crm-list-panel" id="crm-tasks" hidden={activeSection !== 'crm-tasks'}>
      <div className="crm-list-head"><div><h2>Daily task tracker</h2><p>{tasks.filter(task => task.status !== 'done').length} open task{tasks.filter(task => task.status !== 'done').length === 1 ? '' : 's'} · private admin reminders</p></div></div>
      {tasksWarning && <p className="crm-error crm-banner" role="alert">{tasksWarning}</p>}
      <form className="crm-task-form" onSubmit={saveTask}><label>Task<input required maxLength={180} placeholder="Follow up with a new lead" value={taskForm.title} onChange={e => setTaskForm(current => ({ ...current, title: e.target.value }))} /></label><label>Due date<input type="date" value={taskForm.dueAt} onChange={e => setTaskForm(current => ({ ...current, dueAt: e.target.value }))} /></label><label>Priority<select value={taskForm.priority} onChange={e => setTaskForm(current => ({ ...current, priority: e.target.value }))}><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></label><button className="crm-primary" disabled={taskBusy}>{taskBusy ? 'Saving…' : 'Add task'}</button><label className="crm-task-details">Details <span>(optional)</span><input maxLength={2000} value={taskForm.details} onChange={e => setTaskForm(current => ({ ...current, details: e.target.value }))} /></label></form>
      {tasks.length === 0 ? <p className="crm-empty">No tasks saved. Add a real reminder above; no example tasks are preloaded.</p> : <div className="crm-task-list">{tasks.map(task => {
        const today = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        const overdue = task.status !== 'done' && task.due_at && task.due_at < today;
        return <article className={`crm-task ${task.status === 'done' ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''}`} key={task.id}><label><input aria-label={`Mark ${task.title} complete`} type="checkbox" checked={task.status === 'done'} onChange={e => updateTask(task, { status: e.target.checked ? 'done' : 'open' })} /><span><strong>{task.title}</strong>{task.details && <small>{task.details}</small>}</span></label><select aria-label={`Progress for ${task.title}`} value={task.status} onChange={e => updateTask(task, { status: e.target.value })}><option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option></select><span className={`crm-task-priority priority-${task.priority}`}>{task.priority}</span><time>{overdue ? 'Overdue · ' : ''}{task.due_at ? stamp(task.due_at) : 'No due date'}</time><button className="crm-row-action" onClick={() => deleteTask(task)}>Delete</button></article>;
      })}</div>}
    </section>
    <section className="crm-list-panel" id="crm-integrations" hidden={activeSection !== 'crm-integrations'}>
      <div className="crm-list-head"><div><h2>Integrations</h2><p>Current connection status from this deployment. Secrets are never shown here.</p></div><button className="crm-secondary" onClick={load}><RefreshCw size={15} /> Check status</button></div>
      <div className="crm-integrations-grid">{integrations.map(item => <article className="crm-integration-card" key={item.id}><div><strong>{item.name}</strong><span className={`crm-integration-state state-${item.status}`}>{item.status.replaceAll('_', ' ')}</span></div><p>{item.detail}</p>{item.id === 'gohighlevel' && item.status === 'not_connected' && <small>Connect an authorized GoHighLevel account before syncing contacts or activities.</small>}</article>)}</div>
      <p className="crm-setup-note crm-banner">Mailbox sync and Google Drive filing are not connected. Website email notifications do not provide an inbox view. GoHighLevel sync needs an authorized account connection before CRM records can be sent there.</p>
    </section>
    <footer className="crm-footer">Contracted fees are not payment receipts. Stripe revenue reflects verified charges less recorded refunds.</footer>
    </div></div>
  </main>;
}

export default function CrmApp() {
  const [token, setToken] = useState(readToken);
  const logout = useCallback(() => { clearToken(); setToken(''); }, []);
  return token ? <Admin token={token} onLogout={logout} /> : <AuthGate onLogin={setToken} />;
}
