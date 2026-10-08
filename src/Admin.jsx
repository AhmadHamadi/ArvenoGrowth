import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, BriefcaseBusiness, FileText, LogOut, RefreshCw, Search, ShieldCheck } from 'lucide-react';
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
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
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
  const [email, setEmail] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) { onLogout(); throw new Error(data.error || 'Please sign in again.'); }
      if (!response.ok) throw new Error(data.error || 'Could not load contracts.');
      setRows(data.contracts || []); setEmail(data.adminEmail || '');
    } catch (e) { setError(e.message || 'Could not load contracts.'); }
    finally { setBusy(false); }
  }, [token, onLogout]);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => rows.filter((row) => {
    const statusMatch = filter === 'all' || row.status === filter;
    const text = `${row.client_business} ${row.client_contact} ${row.client_email} ${row.package_name}`.toLowerCase();
    return statusMatch && text.includes(query.trim().toLowerCase());
  }), [rows, filter, query]);
  const totals = useMemo(() => ['CAD', 'USD'].map((currency) => ({
    currency,
    mrr: rows.filter(x => x.status === 'signed' && x.currency === currency).reduce((sum, x) => sum + Number(x.monthly_fee || 0), 0),
    setup: rows.filter(x => x.status === 'signed' && x.currency === currency).reduce((sum, x) => sum + Number(x.setup_fee || 0), 0)
  })), [rows]);

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

  return <main className="crm-shell">
    <header className="crm-header"><a href="/" className="crm-brand"><img src={brand.mark} alt="" /><span>Arveno Growth <small>CLIENT CRM</small></span></a><div className="crm-user"><span>{email}</span><button onClick={load} aria-label="Refresh contracts"><RefreshCw size={17} /></button><button onClick={onLogout}><LogOut size={17} /> Sign out</button></div></header>
    <section className="crm-welcome"><div><p className="crm-kicker">PRIVATE WORKSPACE</p><h1>Client & contract overview</h1><p className="crm-muted">Review signed agreements, upcoming monthly fees, and the clients behind each record.</p></div><button className="crm-secondary" onClick={load}><RefreshCw size={16} /> Refresh</button></section>
    <section className="crm-metrics" aria-label="Contracted revenue summaries">
      <article><span><FileText size={17} /> Signed agreements</span><strong>{rows.filter(x => x.status === 'signed').length}</strong><small>Marked as signed in the CRM</small></article>
      {totals.map(x => <article key={`${x.currency}-mrr`}><span><BriefcaseBusiness size={17} /> Contracted monthly fees · {x.currency}</span><strong>{money(x.mrr, x.currency)}</strong><small>Signed contracts only; not payment receipts</small></article>)}
      {totals.map(x => <article key={`${x.currency}-setup`}><span><ArrowDownToLine size={17} /> Contracted setup fees · {x.currency}</span><strong>{money(x.setup, x.currency)}</strong><small>Signed contract amounts; not collected balance</small></article>)}
    </section>
    <section className="crm-list-panel">
      <div className="crm-list-head"><div><h2>Clients & agreements</h2><p>{visible.length} record{visible.length === 1 ? '' : 's'} shown</p></div><label className="crm-search"><Search size={17} /><input aria-label="Search clients" placeholder="Search client, contact, or email" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      <div className="crm-tabs" aria-label="Filter contracts">{['all', 'sent', 'signed', 'draft', 'archived'].map(x => <button key={x} className={filter === x ? 'active' : ''} onClick={() => setFilter(x)}>{x === 'all' ? 'All records' : x[0].toUpperCase() + x.slice(1)}</button>)}</div>
      {error && <p className="crm-error crm-banner" role="alert">{error}</p>}
      {busy ? <p className="crm-empty">Loading your private records…</p> : visible.length === 0 ? <p className="crm-empty">{rows.length ? 'No contracts match this search.' : 'No contracts are saved yet. Complete an agreement in the contract generator and choose Save to add it to this CRM.'}</p> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Client</th><th>Package</th><th>Setup</th><th>Monthly</th><th>Status</th><th>Signed</th><th>Record action</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}><td><strong>{row.client_business}</strong><span>{row.client_contact} · <a href={`mailto:${encodeURIComponent(row.client_email)}`}>{row.client_email}</a></span></td><td>{row.package_name || 'Custom scope'}</td><td>{money(row.setup_fee, row.currency)}</td><td>{money(row.monthly_fee, row.currency)}</td><td><span className={`crm-status status-${row.status}`}>{row.status}</span></td><td>{row.signed_by ? <>{row.signed_by}<span>{stamp(row.signed_at)}</span></> : '—'}</td><td>{row.status === 'signed' && row.signed_pdf_path && <button className="crm-row-action" onClick={() => download(row)}>PDF</button>}{row.status !== 'archived' && <button className="crm-row-action" onClick={() => setStatus(row, 'archived')}>Archive</button>}{row.status === 'archived' && <button className="crm-row-action" onClick={() => setStatus(row, 'sent')}>Restore</button>}</td></tr>)}</tbody></table></div>}
    </section>
    <footer className="crm-footer">Amounts are based on contract terms recorded here. This view does not represent Stripe payments or collected revenue.</footer>
  </main>;
}

export default function CrmApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const logout = useCallback(() => { sessionStorage.removeItem(TOKEN_KEY); setToken(''); }, []);
  return token ? <Admin token={token} onLogout={logout} /> : <AuthGate onLogin={setToken} />;
}
