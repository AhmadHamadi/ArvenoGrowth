import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, BriefcaseBusiness, Check, Copy, DollarSign, ExternalLink, FilePlus2, FileText, LogOut, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import brand from './brand-config.json';

const TOKEN_KEY = 'arveno_crm_session';
const money = (value, currency) => new Intl.NumberFormat('en-CA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
const stamp = (value) => value ? new Date(value).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

function AuthGate({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(true);
  const login = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) { setConfigured(false); setError('The admin portal is waiting for its Supabase connection.'); setBusy(false); return; }
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await response.json();
      if (!response.ok || !data.access_token) throw new Error(data.msg || data.message || 'Email or password was not accepted.');
      sessionStorage.setItem(TOKEN_KEY, data.access_token);
      setPassword(''); onLogin(data.access_token);
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
    <p className="crm-login-foot"><ShieldCheck size={15} /> Protected by Supabase Auth and a server-side admin allowlist.</p>
    {!configured && <p className="crm-setup-note">Connect the environment variables in the setup guide before enabling sign-in.</p>}
  </section></main>;
}

function Admin({ token, onLogout }) {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientBusy, setClientBusy] = useState(false);
  const [clientNotice, setClientNotice] = useState('');
  const [clientForm, setClientForm] = useState({ businessName: '', firstName: '', lastName: '', email: '', phone: '' });
  const [email, setEmail] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [payments, setPayments] = useState([]);
  const [billingWarning, setBillingWarning] = useState('');
  const [billingBusy, setBillingBusy] = useState('');
  const [checkoutLinks, setCheckoutLinks] = useState({});
  const [billingNotice, setBillingNotice] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) { onLogout(); throw new Error(data.error || 'Please sign in again.'); }
      if (!response.ok) throw new Error(data.error || 'Could not load contracts.');
      setRows(data.contracts || []); setEmail(data.adminEmail || '');
      const clientsResponse = await fetch('/api/admin/clients', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const clientsData = await clientsResponse.json();
      if (!clientsResponse.ok) throw new Error(clientsData.error || 'Could not load client records.');
      setClients(clientsData.clients || []);
      const billingResponse = await fetch('/api/admin/billing', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const billingData = await billingResponse.json();
      if (billingResponse.ok) { setPayments(billingData.payments || []); setBillingWarning(''); }
      else { setPayments([]); setBillingWarning(billingResponse.status === 503 ? 'Stripe reporting is waiting for its billing database migration.' : 'Stripe payment records are not available yet.'); }
    } catch (e) { setError(e.message || 'Could not load contracts.'); }
    finally { setBusy(false); }
  }, [token, onLogout]);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => rows.filter((row) => {
    const isSigned = row.status === 'signed' || (row.status === 'archived' && Boolean(row.signed_at));
    const statusMatch = filter === 'all' || (filter === 'signed' ? isSigned : row.status === filter);
    const text = `${row.client_business} ${row.client_contact} ${row.client_email} ${row.package_name}`.toLowerCase();
    return statusMatch && text.includes(query.trim().toLowerCase());
  }), [rows, filter, query]);
  const totals = useMemo(() => ['CAD', 'USD'].map((currency) => ({
    currency,
    mrr: rows.filter(x => (x.status === 'signed' || (x.status === 'archived' && x.signed_at)) && x.currency === currency).reduce((sum, x) => sum + Number(x.monthly_fee || 0), 0),
    activeMrr: rows.filter(x => x.client_id && x.currency === currency && x.onboarding_status === 'active' && x.stripe_subscription_status === 'active').reduce((sum, x) => sum + Number(x.monthly_fee || 0), 0),
    setup: rows.filter(x => (x.status === 'signed' || (x.status === 'archived' && x.signed_at)) && x.currency === currency).reduce((sum, x) => sum + Number(x.setup_fee || 0), 0)
  })), [rows]);
  const activeClientCount = useMemo(() => new Set(rows.filter(x => x.client_id && x.onboarding_status === 'active' && x.stripe_subscription_status === 'active').map(x => x.client_id)).size, [rows]);
  const billingReady = !billingWarning;

  const setStatus = async (row, status) => {
    setError('');
    try {
      const response = await fetch('/api/admin', { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, status }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not update status.');
      await load();
    } catch (e) { setError(e.message); }
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
      } else {
        setBillingNotice('Setup marked complete. Monthly service billing can now be started.');
        await load();
      }
    } catch (e) { setBillingWarning(e.message || 'Could not update billing.'); }
    finally { setBillingBusy(''); }
  };

  const copyCheckout = async (row) => {
    const link = checkoutLinks[row.id]?.url;
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setBillingNotice('Checkout link copied.'); }
    catch { setBillingWarning('Copy was blocked by the browser. Open the checkout link and copy it from the address bar.'); }
  };

  const createClient = async (event) => {
    event.preventDefault(); setClientBusy(true); setClientNotice(''); setError('');
    try {
      const response = await fetch('/api/admin/clients', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(clientForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save client.');
      await load();
      setClientForm({ businessName: '', firstName: '', lastName: '', email: '', phone: '' });
      setShowClientForm(false);
      setClientNotice(data.existing ? 'That business and email are already in your client list.' : 'Client saved. Create an agreement from this client record below.');
    } catch (e) { setClientNotice(e.message || 'Could not save client.'); }
    finally { setClientBusy(false); }
  };

  return <main className="crm-shell">
    <header className="crm-header"><a href="/" className="crm-brand"><img src={brand.mark} alt="" /><span>Arveno Growth <small>CLIENT CRM</small></span></a><div className="crm-user"><span>{email}</span><button onClick={load} aria-label="Refresh contracts"><RefreshCw size={17} /></button><button onClick={onLogout}><LogOut size={17} /> Sign out</button></div></header>
    <section className="crm-welcome"><div><p className="crm-kicker">PRIVATE WORKSPACE</p><h1>Client & contract overview</h1><p className="crm-muted">Create agreements, track signatures, and follow verified Stripe payments through onboarding.</p></div><div className="crm-welcome-actions"><button className="crm-primary" onClick={() => { setShowClientForm(true); document.getElementById('crm-clients')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><FilePlus2 size={16} /> Add client</button><button className="crm-secondary" onClick={load}><RefreshCw size={16} /> Refresh</button></div></section>
    <section className="crm-metrics" aria-label="Contracted revenue summaries">
      <article><span><FileText size={17} /> Signed agreements</span><strong>{rows.filter(x => x.status === 'signed' || (x.status === 'archived' && x.signed_at)).length}</strong><small>Includes archived signed records</small></article>
      <article><span><BriefcaseBusiness size={17} /> Active clients</span><strong>{activeClientCount}</strong><small>Client has an active monthly Stripe subscription</small></article>
      {totals.map(x => <article key={`${x.currency}-active-mrr`}><span><BriefcaseBusiness size={17} /> Active recurring · {x.currency} / month</span><strong>{money(x.activeMrr, x.currency)}</strong><small>Only active monthly service subscriptions</small></article>)}
      {totals.map(x => <article key={`${x.currency}-contracted-mrr`}><span><FileText size={17} /> Signed monthly value · {x.currency}</span><strong>{money(x.mrr, x.currency)}</strong><small>Contracted amount; excludes canceled service</small></article>)}
      {totals.map(x => <article key={`${x.currency}-setup`}><span><ArrowDownToLine size={17} /> Contracted setup fees · {x.currency}</span><strong>{money(x.setup, x.currency)}</strong><small>Signed contract amounts; not collected balance</small></article>)}
      {['USD', 'CAD'].map(currency => <article key={`${currency}-collected`}><span><DollarSign size={17} /> Stripe revenue · {currency}</span><strong>{money(payments.filter(p => p.currency === currency).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0), currency)}</strong><small>Verified Stripe charges less recorded refunds</small></article>)}
    </section>
    <section className="crm-list-panel" id="crm-clients">
      <div className="crm-list-head"><div><h2>Clients</h2><p>{clients.length} saved client{clients.length === 1 ? '' : 's'} · business and contact details are stored separately from agreements</p></div><button className="crm-primary" onClick={() => { setShowClientForm(x => !x); setClientNotice(''); }}><FilePlus2 size={16} /> {showClientForm ? 'Cancel' : 'Add client'}</button></div>
      {clientNotice && <p className="crm-success crm-banner" role="status">{clientNotice}</p>}
      {showClientForm && <form className="crm-client-form" onSubmit={createClient}>
        <label>Business name<input required maxLength={160} value={clientForm.businessName} onChange={e => setClientForm(x => ({ ...x, businessName: e.target.value }))} /></label>
        <label>First name<input required maxLength={80} autoComplete="given-name" value={clientForm.firstName} onChange={e => setClientForm(x => ({ ...x, firstName: e.target.value }))} /></label>
        <label>Last name<input required maxLength={80} autoComplete="family-name" value={clientForm.lastName} onChange={e => setClientForm(x => ({ ...x, lastName: e.target.value }))} /></label>
        <label>Email<input required type="email" maxLength={200} autoComplete="email" value={clientForm.email} onChange={e => setClientForm(x => ({ ...x, email: e.target.value }))} /></label>
        <label>Phone <span>(optional)</span><input type="tel" maxLength={40} autoComplete="tel" value={clientForm.phone} onChange={e => setClientForm(x => ({ ...x, phone: e.target.value }))} /></label>
        <button className="crm-primary" disabled={clientBusy}>{clientBusy ? 'Saving…' : 'Save client'}</button>
      </form>}
      {clients.length === 0 ? <p className="crm-empty">No client records yet. Add a client here first, then create their agreement from the client row.</p> : <div className="crm-client-grid">{clients.map(client => {
        const clientContracts = rows.filter(row => row.client_id === client.id);
        const active = clientContracts.some(row => row.onboarding_status === 'active' && row.stripe_subscription_status === 'active');
        const onboarding = !active && clientContracts.some(row => row.status === 'signed' && row.onboarding_status !== 'inactive');
        const state = active ? 'Active' : onboarding ? 'Onboarding' : clientContracts.length ? 'Past client' : 'New client';
        return <article className="crm-client-card" key={client.id}><div><strong>{client.business_name}</strong><span>{client.first_name} {client.last_name} · <a href={`mailto:${encodeURIComponent(client.email)}`}>{client.email}</a></span><small><b className={`crm-client-state ${active ? 'is-active' : ''}`}>{state}</b> · {clientContracts.length} agreement{clientContracts.length === 1 ? '' : 's'}{client.stripe_customer_id ? ' · Stripe customer linked' : ''}</small></div><a className="crm-row-action" href={`/contract?clientId=${encodeURIComponent(client.id)}`}><FilePlus2 size={13} /> Create contract</a></article>;
      })}</div>}
    </section>
    <section className="crm-list-panel">
      <div className="crm-list-head"><div><h2>Clients & agreements</h2><p>{visible.length} record{visible.length === 1 ? '' : 's'} shown</p></div><label className="crm-search"><Search size={17} /><input aria-label="Search clients" placeholder="Search client, contact, or email" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      <div className="crm-tabs" aria-label="Filter contracts">{['all', 'sent', 'signed', 'draft', 'archived'].map(x => <button key={x} className={filter === x ? 'active' : ''} onClick={() => setFilter(x)}>{x === 'all' ? 'All records' : x[0].toUpperCase() + x.slice(1)}</button>)}</div>
      {error && <p className="crm-error crm-banner" role="alert">{error}</p>}
      {billingWarning && <p className="crm-error crm-banner" role="alert">{billingWarning}</p>}
      {billingNotice && <p className="crm-success crm-banner" role="status">{billingNotice}</p>}
      {busy ? <p className="crm-empty">Loading your private records…</p> : visible.length === 0 ? <p className="crm-empty">{rows.length ? 'No contracts match this search.' : 'No contracts are saved yet. Choose Create contract to open the agreement builder; save it while signed in and it will appear here.'}</p> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Client</th><th>Package</th><th>Setup</th><th>Monthly</th><th>Status</th><th>Onboarding</th><th>Collected</th><th>Signed</th><th>Actions</th></tr></thead><tbody>{visible.map(row => {
        const rowPayments = payments.filter(p => p.contract_id === row.id);
        const paid = rowPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
        const setupPaid = ['paid', 'not_required'].includes(row.setup_payment_status) || Number(row.setup_fee || 0) === 0;
        const pending = billingBusy === row.id;
        return <tr key={row.id}>
          <td><strong>{row.client_business}</strong><span>{row.client_contact} · <a href={`mailto:${encodeURIComponent(row.client_email)}`}>{row.client_email}</a></span></td>
          <td>{row.package_name || 'Custom scope'}</td><td>{money(row.setup_fee, row.currency)}</td><td>{money(row.monthly_fee, row.currency)}</td>
          <td><span className={`crm-status status-${row.status}`}>{row.status}</span></td>
          <td><span className={`crm-status status-${row.onboarding_status || (row.status === 'signed' ? 'signed' : row.status === 'draft' ? 'draft' : 'contract_sent')}`}>{(row.onboarding_status || (row.status === 'signed' ? 'signed' : row.status === 'draft' ? 'draft' : 'contract_sent')).replaceAll('_', ' ')}</span>{row.setup_payment_status && <span className="crm-row-substatus">Setup: {row.setup_payment_status}{row.setup_payment_status === 'partial' ? ` (${row.setup_installments_paid || 0}/3)` : ''}</span>}</td>
          <td><strong>{money(paid, row.currency)}</strong>{rowPayments.length > 0 && <span>{rowPayments.length} verified payment{rowPayments.length === 1 ? '' : 's'}</span>}</td>
          <td>{row.signed_by ? <>{row.signed_by}<span>{stamp(row.signed_at)}</span></> : '—'}</td>
          <td className="crm-actions-cell">
            {billingReady && row.status === 'signed' && Number(row.setup_fee || 0) > 0 && !setupPaid && row.setup_payment_status !== 'partial' && <button className="crm-row-action" disabled={pending} onClick={() => billingAction(row, 'setup', row.agreement?.setupPayment === 'threeMonthly' ? 'three_monthly' : 'full')}>{pending ? 'Working…' : row.agreement?.setupPayment === 'threeMonthly' ? 'Setup · 3 months' : 'Setup payment link'}</button>}
            {billingReady && row.status === 'signed' && setupPaid && !row.setup_completed_at && <button className="crm-row-action" disabled={pending} onClick={() => billingAction(row, 'mark_setup_complete')}>{pending ? 'Working…' : 'Mark setup complete'}</button>}
            {billingReady && row.status === 'signed' && row.setup_completed_at && row.stripe_subscription_status !== 'active' && <button className="crm-row-action" disabled={pending} onClick={() => billingAction(row, 'service')}>{pending ? 'Working…' : 'Monthly service link'}</button>}
            {row.stripe_subscription_status === 'pending_payment' && <span className="crm-row-substatus">Stripe payment confirmation pending</span>}
            {checkoutLinks[row.id] && <><a className="crm-row-action" href={checkoutLinks[row.id].url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open link</a><button className="crm-row-action" onClick={() => copyCheckout(row)}><Copy size={13} /> Copy link</button></>}
            {row.signed_pdf_path && <button className="crm-row-action" onClick={() => download(row)}>Signed PDF</button>}
            {row.status !== 'archived' && <button className="crm-row-action" onClick={() => setStatus(row, 'archived')}>Archive</button>}
            {row.status === 'archived' && <button className="crm-row-action" onClick={() => setStatus(row, 'sent')}>Restore</button>}
          </td>
        </tr>;
      })}</tbody></table></div>}
    </section>
    <footer className="crm-footer">Contracted fees are not payment receipts. Stripe revenue reflects verified charges less recorded refunds.</footer>
  </main>;
}

export default function CrmApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const logout = useCallback(() => { sessionStorage.removeItem(TOKEN_KEY); setToken(''); }, []);
  return token ? <Admin token={token} onLogout={logout} /> : <AuthGate onLogin={setToken} />;
}
