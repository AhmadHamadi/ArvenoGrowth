import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FileText, Printer, RotateCcw, Check, Plus, X, PenLine, Save,
  ShieldCheck, AlertCircle, Trash2, Eye, Settings2, Link2, Mail, Copy, ExternalLink, FolderOpen
} from 'lucide-react';
import ContractDocument from './ContractDocument.jsx';
import {
  SIGNERS, SERVICE_LIBRARY, PACKAGE_PRESETS, TERMS, DEFAULTS, AGENCY, packageSetupFee,
  todayISO, slugify, signingUrl, coveringEmail, contractGaps, selectedServices
} from './contract-model.js';
import { toEntry, saveEntry, readRegister } from './contract-register.js';
import brand from './brand-config.json';

/* ============================================================
   ARVENO GROWTH — /contract  (internal tool)

   Fill the panel, a finished agreement renders alongside it. Save as
   PDF for the attachment, then copy the signing link and the covering
   email and send them out. The client signs on /sign and both parties
   get a signed copy by email.
   ============================================================ */

const STORAGE_KEY = 'arveno_contract_v3';

/* ============================================================
   SIGNATURE PAD
   ============================================================ */
function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const latest = useRef(value);
  const [hasInk, setHasInk] = useState(Boolean(value));

  useEffect(() => { latest.current = value; }, [value]);

  /* The resize listener is registered once, so the current signature is read
     through a ref. A stale closure here would silently wipe the signature the
     first time the window changed size. */
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const prior = latest.current;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#15140F';

    if (prior) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = prior;
    }
  }, []);

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [setupCanvas]);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasInk(true);
  };

  const end = (e) => {
    if (!drawing.current) return;
    drawing.current = false;
    canvasRef.current.releasePointerCapture?.(e.pointerId);
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange('');
  };

  return (
    <div>
      <div className="relative border-2 border-dashed border-paperEdge bg-white">
        <canvas
          ref={canvasRef}
          className="block h-[130px] w-full cursor-crosshair touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {!hasInk && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-inkd3">
            <PenLine className="h-5 w-5" />
            <span className="mt-1 font-archivo text-[13px]">Sign here with your mouse, trackpad, or finger</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-8 bottom-4 border-b border-paperEdge" />
      </div>
      <button
        type="button" onClick={clear}
        className="mt-2 inline-flex items-center gap-1.5 font-archivo text-[13px] font-semibold text-inkd3 transition-colors hover:text-gRed"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Clear signature
      </button>
    </div>
  );
}

/* ============================================================
   FORM CONTROLS
   ============================================================ */
function Label({ children, hint }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="font-archivo text-[13.5px] font-semibold text-inkd2">{children}</span>
      {hint && <span className="font-archivo text-[12.5px] text-inkd3">{hint}</span>}
    </span>
  );
}

function Group({ icon: Icon, title, children }) {
  return (
    <section className="border border-inkd bg-paper p-5">
      <div className="mb-4 flex items-center gap-2 border-b border-paperEdge pb-3">
        <Icon className="h-4 w-4 text-brandink" />
        <h2 className="font-archivo text-[15px] font-extrabold text-inkd">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Radio({ checked, onChange, label, desc }) {
  return (
    <button
      type="button" onClick={onChange}
      className={`w-full border-2 px-4 py-3 text-left transition-all
        ${checked ? 'border-brand bg-brand/5' : 'border-paperEdge bg-white hover:border-inkd/40'}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2
          ${checked ? 'border-brand bg-brand' : 'border-inkd/30'}`}>
          {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span>
          <span className="block font-archivo text-[15px] font-semibold text-inkd">{label}</span>
          {desc && <span className="mt-1 block font-archivo text-[13.5px] leading-snug text-inkd2">{desc}</span>}
        </span>
      </div>
    </button>
  );
}

/** Copy-to-clipboard with a graceful fallback for non-secure contexts. */
function CopyButton({ text, label = 'Copy', className = '' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      setDone(false);
    }
  };
  return (
    <button
      type="button" onClick={copy}
      className={`inline-flex items-center gap-1.5 border border-inkd bg-white px-3 py-2 font-archivo text-[13px] font-semibold text-inkd transition-colors hover:bg-inkd hover:text-paper ${className}`}
    >
      {done ? <Check className="h-3.5 w-3.5 text-gGreen" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copied' : label}
    </button>
  );
}

/* ============================================================
   PAGE
   ============================================================ */
export default function Contract() {
  const [d, setD] = useState(() => ({ ...DEFAULTS, contractVersion: 7, term: '3 months', agreementDate: todayISO(), setupStart: todayISO() }));
  const [linkedClientId] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('clientId') || '');
  const [saved, setSaved] = useState(false);
  const [savedLink, setSavedLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [crmNotice, setCrmNotice] = useState('');
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const prev = JSON.parse(raw);
        if (prev && typeof prev === 'object') setD((cur) => ({ ...cur, ...prev, contractVersion: 7 }));
      }
    } catch { /* storage blocked */ }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem('arveno_crm_session');
    if (!linkedClientId || !token) return;
    fetch(`/api/admin/clients?id=${encodeURIComponent(linkedClientId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.clients?.[0]) throw new Error(result.error || 'The selected CRM client could not be loaded.');
        const client = result.clients[0];
        setD({ ...DEFAULTS, contractVersion: 7, term: '3 months', agreementDate: todayISO(), setupStart: todayISO(), clientBusiness: client.business_name, clientContact: `${client.first_name} ${client.last_name}`, clientEmail: client.email, clientPhone: client.phone || '' });
        setCrmNotice(`Creating an agreement for ${client.business_name}. Client contact details are filled from the CRM record.`);
      })
      .catch((error) => setCrmNotice(error.message || 'The selected CRM client could not be loaded.'));
  }, [linkedClientId]);

  const set = (k, v) => { setSaved(false); setD((cur) => ({ ...cur, [k]: v })); };
  const applyPackage = (name) => {
    const preset = PACKAGE_PRESETS.find((item) => item.name === name);
    setD((cur) => preset ? ({
      ...cur,
      packageName: preset.name,
      monthlyFee: preset.monthlyFee,
      setupFee: packageSetupFee(preset),
      currency: preset.currency || cur.currency,
      term: preset.term,
      contractVersion: 7,
      services: [],
      customServices: [...preset.services]
    }) : ({ ...cur, packageName: '' }));
  };
  const toggleGuarantee = (kind) => {
    const currentBreakEven = d.guarantee === 'breakEven' || d.guarantee === 'breakEvenAndPerformance';
    const currentPerformance = d.guarantee === 'performance' || d.guarantee === 'breakEvenAndPerformance';
    const breakEven = kind === 'breakEven' ? !currentBreakEven : currentBreakEven;
    const performance = kind === 'performance' ? !currentPerformance : currentPerformance;
    set('guarantee', breakEven && performance ? 'breakEvenAndPerformance' : breakEven ? 'breakEven' : performance ? 'performance' : 'none');
  };

  const persist = async () => {
    if (saving) return;
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
      const token = sessionStorage.getItem('arveno_crm_session');
      if (!token) {
        setSavedLink('');
        setCrmNotice('Saved on this device. Sign in at /admin, then return and save again to add it to the shared CRM.');
      } else {
        const response = await fetch('/api/admin', {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ contract: d, clientId: linkedClientId || null })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'The shared CRM did not save this agreement.');
        saveEntry(toEntry(d, origin));
        setSavedLink(result.contract?.signing_url || link);
        setCrmNotice(result.emailSent
          ? `Sent to ${result.contract?.client_email || d.clientEmail} · ${result.contract?.reference || 'agreement recorded'}. The signing link expires in 24 hours.`
          : `Saved, but the signing email did not send. ${result.emailWarning || 'Open the CRM to copy the active link and send it manually.'}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      setSavedLink('');
      setCrmNotice(error.message || 'This contract was saved only in this browser. The shared CRM could not be reached.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (!window.confirm('Clear this contract and start a new one?')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setSavedLink('');
    setSaved(false);
    setActiveStep(0);
    setD({ ...DEFAULTS, contractVersion: 7, term: '3 months', agreementDate: todayISO(), setupStart: todayISO() });
  };

  const toggleService = (id) => {
    setSaved(false);
    setD((cur) => ({
      ...cur,
      services: cur.services.includes(id)
        ? cur.services.filter((x) => x !== id)
        : [...cur.services, id]
    }));
  };

  const gaps = useMemo(() => {
    const list = contractGaps(d);
    if (!d.signatureData) list.push('Your signature');
    return list;
  }, [d]);

  const origin = typeof window !== 'undefined' && window.location.origin.startsWith('http')
    ? window.location.origin
    : AGENCY.origin;

  const link = useMemo(() => signingUrl(d, origin), [d, origin]);
  useEffect(() => { setSavedLink(''); setSaved(false); }, [link]);
  const [filed, setFiled] = useState(0);

  /* File it in the register the moment it is complete enough to send, so the
     list of what is outstanding builds itself rather than relying on memory. */
  useEffect(() => {
    if (contractGaps(d).length) return;
    const t = setTimeout(() => { saveEntry(toEntry(d, origin)); setFiled(readRegister().length); }, 800);
    return () => clearTimeout(t);
  }, [d, origin]);
  const email = useMemo(() => coveringEmail(d, savedLink || link), [d, link, savedLink]);
  const slug = slugify(d.clientBusiness);
  const readyToSend = gaps.length === 0;
  const isCurrentLinkSaved = Boolean(savedLink);
  const hasCrmSession = typeof window !== 'undefined' && Boolean(sessionStorage.getItem('arveno_crm_session'));
  const steps = ['Client', 'Package & scope', 'Billing & term', 'Review & send'];
  const stepReady = activeStep === 0
    ? Boolean(String(d.clientBusiness).trim() && String(d.clientContact).trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.clientEmail).trim()))
    : activeStep === 1 ? selectedServices(d).length > 0
      : activeStep === 2 ? contractGaps(d).length === 0 : true;

  const mailtoHref =
    `mailto:${encodeURIComponent(d.clientEmail || '')}` +
    `?subject=${encodeURIComponent(email.subject)}` +
    `&body=${encodeURIComponent(email.body)}`;

  return (
    <div className="min-h-screen bg-paper font-archivo text-inkd antialiased">
      <style>{`
        @page { size: Letter portrait; margin: 14mm 14mm 12mm; }
        .contract-sheet {
          width: 8.5in;
          padding: 0.55in 0.6in;
          font-family: 'Archivo', system-ui, sans-serif;
        }
        .contract-clause, .contract-signatures { break-inside: avoid; page-break-inside: avoid; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-area { position: static !important; display: block !important; padding: 0 !important; margin: 0 !important; overflow: visible !important; }
          .contract-sheet {
            width: auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: 0 !important;
            margin: 0 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Toolbar */}
      <header className="no-print sticky top-0 z-40 border-b border-inkd bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src={brand.mark} alt="" className="h-14 w-14 shrink-0 object-contain" />
            <div className="min-w-0">
              <div className="truncate font-archivo text-[15px] font-extrabold uppercase tracking-[0.06em] text-inkd">Contract Generator</div>
              <div className="font-archivo text-[12.5px] text-inkd3">Internal tool</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreviewMobile((v) => !v)}
              className="inline-flex items-center gap-1.5 border border-inkd bg-paper px-3 py-2 font-archivo text-[13px] font-semibold text-inkd xl:hidden"
            >
              {showPreviewMobile ? <Settings2 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPreviewMobile ? 'Edit' : 'Preview'}
            </button>
            <a href="/admin" className="hidden items-center gap-1.5 border border-inkd bg-paper px-3 py-2 font-archivo text-[13px] font-semibold text-inkd transition-colors hover:bg-inkd hover:text-paper sm:inline-flex">
              <FolderOpen className="h-4 w-4" /> Client CRM
            </a>
            <button onClick={reset} className="hidden items-center gap-1.5 border border-inkd bg-paper px-3 py-2 font-archivo text-[13px] font-semibold text-inkd2 transition-colors hover:text-gRed sm:inline-flex">
              <Trash2 className="h-4 w-4" /> New
            </button>
            <button onClick={persist} className="inline-flex items-center gap-1.5 border border-inkd bg-paper px-3 py-2 font-archivo text-[13px] font-semibold text-inkd transition-colors hover:bg-inkd hover:text-paper">
              {saved ? <Check className="h-4 w-4 text-gGreen" /> : <Save className="h-4 w-4" />} {saved ? 'Saved' : 'Save'}
            </button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 bg-brandink px-5 py-3 font-archivo text-[13px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-brandink2">
              <Printer className="h-4 w-4" /> Save as PDF
            </button>
          </div>
        </div>
      </header>

      {crmNotice && <div role="status" className="no-print mx-auto max-w-[1600px] px-4 pt-4 md:px-6"><p className="border border-brandink/20 bg-white px-4 py-3 font-archivo text-[13px] text-inkd2">{crmNotice} <a className="font-bold text-brandink underline" href="/admin">Open CRM</a></p></div>}

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 md:px-6 xl:grid-cols-[460px_minmax(0,1fr)]">
        {/* ---------------- CONTROLS ---------------- */}
        <div className={`no-print space-y-4 ${showPreviewMobile ? 'hidden xl:block' : ''}`}>
          <nav aria-label="Agreement creation steps" className="border border-paperEdge bg-white p-3">
            <ol className="grid grid-cols-4 gap-1.5">
              {steps.map((label, index) => <li key={label}>
                <button type="button" onClick={() => { if (index < activeStep || stepReady) setActiveStep(index); }}
                  aria-current={activeStep === index ? 'step' : undefined}
                  className={`w-full border-b-2 px-1 pb-2 pt-1 text-left font-archivo text-[10px] font-bold sm:text-[12px] ${activeStep === index ? 'border-brand text-brandink' : index < activeStep ? 'border-gGreen text-inkd' : 'border-paperEdge text-inkd3'}`}>
                  <span className="mr-1">{index + 1}.</span>{label}
                </button>
              </li>)}
            </ol>
            <p className="mt-2 font-archivo text-[12px] text-inkd3">Step {activeStep + 1} of {steps.length}</p>
          </nav>
          {gaps.length > 0 && (
            <div className="border-l-[3px] border-brand bg-brand/5 p-4">
              <div className="flex items-center gap-2 font-plex text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brandink">
                <AlertCircle className="h-4 w-4" /> Still blank
              </div>
              <ul className="mt-2.5 space-y-1 font-archivo text-[14px] text-inkd2">
                {gaps.map((p) => <li key={p}>• {p}</li>)}
              </ul>
            </div>
          )}

          {activeStep === 0 && <Group icon={FileText} title="Client">
            <div className="space-y-3">
              <label className="block">
                <Label hint="Required">Business name</Label>
                <input readOnly={Boolean(linkedClientId)} className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none read-only:bg-paper/60"
                  value={d.clientBusiness} onChange={(e) => set('clientBusiness', e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label hint="Signs">Contact name</Label>
                  <input readOnly={Boolean(linkedClientId)} className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none read-only:bg-paper/60"
                    value={d.clientContact} onChange={(e) => set('clientContact', e.target.value)} />
                </label>
                <label className="block">
                  <Label>Title</Label>
                  <input className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" placeholder="Owner"
                    value={d.clientTitle} onChange={(e) => set('clientTitle', e.target.value)} />
                </label>
              </div>
              <label className="block">
                <Label hint="Optional">Address</Label>
                <input className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" placeholder="123 Main St, Hamilton, ON"
                  value={d.clientAddress} onChange={(e) => set('clientAddress', e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label hint="Required">Email</Label>
                  <input readOnly={Boolean(linkedClientId)} className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none read-only:bg-paper/60" type="email"
                    value={d.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} />
                </label>
                <label className="block">
                  <Label>Phone</Label>
                  <input readOnly={Boolean(linkedClientId)} className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none read-only:bg-paper/60" type="tel"
                    value={d.clientPhone} onChange={(e) => set('clientPhone', e.target.value)} />
                </label>
              </div>
            </div>
          </Group>}

          {activeStep === 1 && <>
          <Group icon={FileText} title="Package selection">
            <label className="block">
              <Label hint="Optional preset">Choose a package</Label>
              <select className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" value={d.packageName || ''} onChange={(e) => applyPackage(e.target.value)}>
                <option value="">Custom scope</option>
                {PACKAGE_PRESETS.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </select>
            </label>
            <p className="mt-2 font-archivo text-[13px] leading-relaxed text-inkd3">Selecting a package fills its listed services, setup fee, monthly fee, and term. You can adjust the agreement fields below before sending.</p>
            {d.packageName && (() => { const selected = PACKAGE_PRESETS.find((item) => item.name === d.packageName); return selected && <div className="mt-3 border-l-[3px] border-brand bg-brand/5 px-3.5 py-3">
              <div className="font-archivo text-[14px] font-bold text-inkd">{selected.summary}</div>
              <div className="mt-1 font-archivo text-[13px] text-inkd2">{selected.currency} ${selected.monthlyFee}/month · ${packageSetupFee(selected) || '0'} setup · {selected.term} commitment</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 font-archivo text-[12px] leading-snug text-inkd2">{selected.services.map((service) => <li key={service}>{service}</li>)}</ul>
              {selected.usesAds && <p className="mt-2 font-archivo text-[12px] font-semibold text-inkd2">Google Ads spend is separate and paid directly to Google.</p>}
            </div>; })()}
            {(d.packageName === 'Lead Engine' || d.packageName === 'Growth Engine') && <div className="mt-3 border-l-[3px] border-brand bg-brand/5 px-3.5 py-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label hint="Paid directly to Google">Agreed minimum ad budget / month</Label>
                  <input className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" inputMode="decimal" aria-label="Agreed minimum monthly Google advertising budget" value={d.minAdSpend} onChange={(e) => set('minAdSpend', e.target.value)} />
                </label>
                <label className="block">
                  <Label>Budget currency</Label>
                  <select className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" value={d.adSpendCurrency} onChange={(e) => set('adSpendCurrency', e.target.value)}><option>USD</option><option>CAD</option></select>
                </label>
              </div>
              <p className="mt-2 font-archivo text-[12px] leading-relaxed text-inkd3">The template currently starts at $500 USD. Confirm the agreed amount with the client and update it here; this is separate from the monthly service fee.</p>
            </div>}
          </Group>

          </>}

          {activeStep === 2 && <>
          <Group icon={Settings2} title="Dates, term, and money">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label>Agreement date</Label>
                  <input className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" type="date"
                    value={d.agreementDate} onChange={(e) => set('agreementDate', e.target.value)} />
                </label>
                <label className="block">
                  <Label>Setup start date</Label>
                  <input className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" type="date"
                    value={d.setupStart} onChange={(e) => set('setupStart', e.target.value)} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label hint="Set the agreed service commitment">Term length</Label>
                  <select className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" value={d.term} onChange={(e) => set('term', e.target.value)}>
                    {TERMS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block">
                  <Label>Currency</Label>
                  <select className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" value={d.currency} onChange={(e) => set('currency', e.target.value)}>
                    <option>CAD</option><option>USD</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label hint="One time">Setup fee</Label>
                  <input className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" inputMode="decimal" placeholder="1500"
                    value={d.setupFee} onChange={(e) => set('setupFee', e.target.value)} />
                  <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Common setup fee amounts">
                    {['500', '1000', '1500'].map((amount) => <button key={amount} type="button" className="crm-row-action" onClick={() => set('setupFee', amount)}>{d.currency} {amount}</button>)}
                    <button type="button" className="crm-row-action" onClick={() => set('setupFee', '0')}>No setup fee</button>
                  </div>
                </label>
                <label className="block">
                  <Label hint="Per month">Monthly fee</Label>
                  <input className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" inputMode="decimal" placeholder="1200"
                    value={d.monthlyFee} onChange={(e) => set('monthlyFee', e.target.value)} />
                </label>
              </div>

              <label className="block">
                <Label hint="Required before work starts">Setup-fee payment schedule</Label>
                <select className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" value={d.setupPayment || 'beforeStart'} onChange={(e) => set('setupPayment', e.target.value)}>
                  <option value="beforeStart">Paid in full before work begins</option>
                  <option value="threeMonthly">Split into three monthly installments</option>
                </select>
              </label>
              {d.term !== 'Month-to-month' && <div className="border-t border-paperEdge pt-3">
                <label className="block">
                  <Label hint="One-time amount if the client ends a fixed term early">Early-exit option</Label>
                  <select className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" value={d.terminationFeeMode || 'one_month'} onChange={(e) => set('terminationFeeMode', e.target.value)}>
                    <option value="one_month">One-time fee equal to one monthly service fee ({d.currency} {d.monthlyFee || '0'})</option>
                    <option value="custom">Set a different one-time fee</option>
                    <option value="none">No early-exit fee</option>
                  </select>
                </label>
                {d.terminationFeeMode === 'custom' && <label className="mt-3 block">
                  <Label hint={`One-time amount agreed in ${d.currency}`}>Custom early-exit fee</Label>
                  <input className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" inputMode="decimal" value={d.terminationFeeAmount} onChange={(e) => set('terminationFeeAmount', e.target.value)} />
                </label>}
                <p className="mt-2 font-archivo text-[12px] leading-relaxed text-inkd3">A fixed term sets the agreed commitment. If the client asks to end it early, this is a one-time exit amount, not an extra month of service and not the remaining term balance. The contract also preserves the stated guarantee and material-breach exceptions.</p>
              </div>}
              <p className="font-archivo text-[12px] leading-relaxed text-inkd3">Setup must be complete within 14 calendar days after the agreed start date. If it is late, the setup fee is waived or refunded and unpaid installments are cancelled. For a split plan, the first installment is due before work begins.</p>

              <div className="border-l-[3px] border-brand bg-brand/5 px-3.5 py-3 font-archivo text-[13px] leading-relaxed text-inkd2">
                The contract states when the monthly subscription begins. Enter 0 only when no setup fee is charged.
              </div>
            </div>
          </Group>

          <Group icon={Check} title="Services included">
            <div className="space-y-2">
              {SERVICE_LIBRARY.map((s) => {
                const on = d.services.includes(s.id);
                return (
                  <button
                    key={s.id} type="button" onClick={() => toggleService(s.id)}
                    className={`w-full border-2 px-3.5 py-2.5 text-left transition-all
                      ${on ? 'border-brand bg-brand/5' : 'border-paperEdge bg-white hover:border-inkd/40'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2
                        ${on ? 'border-brand bg-brand' : 'border-inkd/30'}`}>
                        {on && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
                      </span>
                      <span className="font-archivo text-[15px] font-semibold text-inkd">{s.label}</span>
                    </div>
                  </button>
                );
              })}

              {d.customServices.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" placeholder="Custom service line"
                    value={v}
                    onChange={(e) => {
                      const next = [...d.customServices];
                      next[i] = e.target.value;
                      set('customServices', next);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => set('customServices', d.customServices.filter((_, j) => j !== i))}
                    className="shrink-0 border border-inkd px-3 text-inkd2 hover:text-gRed"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => set('customServices', [...d.customServices, ''])}
                className="inline-flex w-full items-center justify-center gap-1.5 border-2 border-dashed border-paperEdge px-3.5 py-2.5 font-archivo text-[14px] font-semibold text-inkd2 transition-colors hover:border-inkd hover:text-inkd"
              >
                <Plus className="h-4 w-4" /> Add a custom service
              </button>
            </div>
          </Group>

          </>}

          {activeStep === 3 && <>
          <Group icon={ShieldCheck} title="Guarantee">
            <p className="mb-3 font-archivo text-[13px] leading-relaxed text-inkd3">Check only the optional clauses agreed with the client. Leave both unchecked if the package has no guarantee.</p>
            <div className="space-y-2">
              {[
                { key: 'breakEven', label: 'Include the three-month service-fee payback guarantee', desc: 'The client pays the first three monthly service fees after setup. If verified gross profit from tracked projects does not cover those fees by the end of month three, monthly billing pauses and Arveno continues the included work without a monthly service fee until it does. Regular billing resumes only after the target is reached. Setup fee and ad spend are excluded.' },
                { key: 'performance', label: 'Include the performance exit clause', desc: 'If the agreed delivery conditions are not met after launch, the client may end the agreement without further monthly fees.' }
              ].map((item) => {
                const checked = item.key === 'breakEven'
                  ? d.guarantee === 'breakEven' || d.guarantee === 'breakEvenAndPerformance'
                  : d.guarantee === 'performance' || d.guarantee === 'breakEvenAndPerformance';
                return <label key={item.key} className="flex cursor-pointer items-start gap-3 border-2 border-paperEdge bg-white px-4 py-3 hover:border-inkd/40">
                  <input type="checkbox" checked={checked} onChange={() => toggleGuarantee(item.key)} className="mt-1 h-4 w-4 accent-brand" />
                  <span><span className="block font-archivo text-[15px] font-semibold text-inkd">{item.label}</span><span className="mt-1 block font-archivo text-[13px] leading-snug text-inkd2">{item.desc}</span></span>
                </label>;
              })}
            </div>

            {d.guarantee !== 'none' && (
              <div className="mt-4 border-t border-paperEdge pt-4">
                {(d.packageName === 'Lead Engine' || d.packageName === 'Growth Engine') ? <p className="font-archivo text-[13px] leading-relaxed text-inkd3">The agreement uses the minimum ad budget entered under Package selection.</p> : <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <Label hint="Condition">Minimum ad spend / mo</Label>
                    <input className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" inputMode="decimal"
                      value={d.minAdSpend} onChange={(e) => set('minAdSpend', e.target.value)} />
                  </label>
                  <label className="block">
                    <Label>Ad spend currency</Label>
                    <select className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" value={d.adSpendCurrency} onChange={(e) => set('adSpendCurrency', e.target.value)}>
                      <option>USD</option><option>CAD</option>
                    </select>
                  </label>
                </div>}
                <div className="mt-2.5 font-archivo text-[13px] leading-relaxed text-inkd3">
                  Keep this ad budget, agreed tracking, and timely lead follow-up active during the guarantee period.
                </div>
              </div>
            )}
          </Group>

          <Group icon={PenLine} title="Your signature">
            <label className="mb-3 block">
              <Label>Signing for {brand.name}</Label>
              <select className="w-full border border-inkd bg-white px-3 py-2.5 font-archivo text-[15px] text-inkd focus:outline-none" value={d.signerIndex}
                onChange={(e) => set('signerIndex', Number(e.target.value))}>
                {SIGNERS.map((s, i) => <option key={s.name} value={i}>{s.name} — {s.title}</option>)}
              </select>
            </label>
            <SignaturePad value={d.signatureData} onChange={(v) => set('signatureData', v)} />
            <div className="mt-3 font-archivo text-[13px] leading-relaxed text-inkd3">
              Your drawn signature appears on the PDF. On the online signing page the client sees your name and
              title attested instead, because a signature image is far too large to travel inside a link.
            </div>
          </Group>

          {/* ---------------- SEND FOR SIGNATURE ---------------- */}
          <Group icon={Link2} title="Send for signature">
            {!readyToSend ? (
              <p className="font-archivo text-[14.5px] leading-relaxed text-inkd2">
                Fill in the blanks listed at the top of this panel and the signing link and covering email will
                appear here, ready to copy.
              </p>
            ) : (
              !isCurrentLinkSaved ? <div className="space-y-3 border-l-[3px] border-brand bg-brand/5 p-4">
                <p className="font-archivo text-[14px] leading-relaxed text-inkd2">This saves the agreement to the client record and emails the signing link to {d.clientEmail}. The link expires after 24 hours. Stripe Checkout follows after the client signs.</p>
                {hasCrmSession
                  ? <button type="button" disabled={saving} onClick={persist} className="inline-flex items-center gap-2 bg-brandink px-4 py-3 font-archivo text-[13px] font-bold text-white disabled:cursor-wait disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? 'Saving & emailing…' : 'Save & email signing link'}</button>
                  : <p className="font-archivo text-[13px] text-inkd2">Sign in to the <a href="/admin" className="font-bold underline">Client CRM</a>, return here, and save the agreement.</p>}
              </div> : (
              <div className="space-y-5">
                <div>
                  <Label hint={`/sign/${slug}`}>Signing link</Label>
                  <div className="border border-paperEdge bg-paper2 p-3">
                    <p className="break-all font-plex text-[11.5px] leading-relaxed text-inkd2">{savedLink || link}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <CopyButton text={savedLink || link} label="Copy link" />
                    <a
                      href={savedLink || link} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 border border-inkd bg-white px-3 py-2 font-archivo text-[13px] font-semibold text-inkd transition-colors hover:bg-inkd hover:text-paper"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Preview it
                    </a>
                  </div>
                </div>

                <div className="border-t border-paperEdge pt-4">
                  <Label hint="Automatic invitation · manual copy available">Invitation email</Label>
                  <div className="border border-paperEdge bg-paper2">
                    <div className="border-b border-paperEdge px-3 py-2">
                      <div className="font-plex text-[10px] font-semibold uppercase tracking-[0.16em] text-inkd3">Subject</div>
                      <div className="mt-1 font-archivo text-[13.5px] font-semibold text-inkd">{email.subject}</div>
                    </div>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap px-3 py-3 font-archivo text-[13px] leading-relaxed text-inkd2">
{email.body}
                    </pre>
                  </div>
                  <p className="mt-2 font-archivo text-[13px] leading-relaxed text-inkd2">{crmNotice || 'The CRM emails this invitation automatically when you save the agreement. Use these copy options only if you need to follow up manually.'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <CopyButton text={email.body} label="Copy email text" />
                    <CopyButton text={email.subject} label="Copy subject" />
                    <a
                      href={mailtoHref}
                      className="inline-flex items-center gap-1.5 border border-inkd bg-white px-3 py-2 font-archivo text-[13px] font-semibold text-inkd transition-colors hover:bg-inkd hover:text-paper"
                    >
                      <Mail className="h-3.5 w-3.5" /> Open in mail app
                    </a>
                  </div>
                </div>

                <p className="border-t border-paperEdge pt-4 font-archivo text-[13.5px] text-inkd2">
                  Filed in the <a href="/contracts" className="font-semibold text-inkd underline decoration-brandink decoration-2 underline-offset-2">contract register</a>
                  {filed ? ` — ${filed} contract${filed === 1 ? '' : 's'} on file.` : '.'}
                </p>
                <ol className="space-y-1.5 border-t border-paperEdge pt-4 font-archivo text-[13.5px] leading-relaxed text-inkd2">
                  <li><strong className="text-inkd">1.</strong> Review the business, package, included services, fees, term, and guarantee.</li>
                  <li><strong className="text-inkd">2.</strong> Save once. The CRM emails the client a secure link that expires after 24 hours.</li>
                  <li><strong className="text-inkd">3.</strong> The client draws their signature, types their full name and business, and enters the signing date.</li>
                  <li><strong className="text-inkd">4.</strong> The signed PDF is filed to the contract record, signed copies are emailed, and the setup Checkout link is sent.</li>
                </ol>
              </div>
              )
            )}
          </Group>
          </>}

          <div className="flex items-center justify-between border-t border-paperEdge pt-3">
            <button type="button" disabled={activeStep === 0} onClick={() => setActiveStep((current) => Math.max(0, current - 1))} className="border border-inkd bg-white px-4 py-2.5 font-archivo text-[13px] font-semibold text-inkd disabled:opacity-40">Back</button>
            {activeStep < steps.length - 1 && <button type="button" disabled={!stepReady} onClick={() => setActiveStep((current) => Math.min(steps.length - 1, current + 1))} className="bg-brandink px-4 py-2.5 font-archivo text-[13px] font-bold text-white disabled:opacity-40">Continue to {steps[activeStep + 1]} →</button>}
          </div>
        </div>

        {/* ---------------- PREVIEW ---------------- */}
        <div className={`print-area ${showPreviewMobile ? '' : 'hidden xl:block'}`}>
          <div className="no-print mb-3 flex items-center gap-2 font-plex text-[10.5px] font-semibold uppercase tracking-[0.18em] text-inkd3">
            <Eye className="h-4 w-4" /> Live preview — this is exactly what prints
          </div>
          <div className="overflow-x-auto pb-4">
            <div className="inline-block border border-inkd">
              <ContractDocument d={d} tlmSignature={d.signatureData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
