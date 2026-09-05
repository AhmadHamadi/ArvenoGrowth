import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FileText, Printer, RotateCcw, Check, Plus, X, PenLine, Save,
  ShieldCheck, AlertCircle, Trash2, Eye, Settings2, Link2, Mail, Copy, ExternalLink
} from 'lucide-react';
import ContractDocument from './ContractDocument.jsx';
import {
  SIGNERS, SERVICE_LIBRARY, TERMS, DEFAULTS, AGENCY,
  todayISO, slugify, signingUrl, coveringEmail, contractGaps
} from './contract-model.js';

/* ============================================================
   TRADE LEADS MARKETING — /contract  (internal tool)

   Fill the panel, a finished agreement renders alongside it. Save as
   PDF for the attachment, then copy the signing link and the covering
   email and send them out. The client signs on /sign and both parties
   get a signed copy by email.
   ============================================================ */

const STORAGE_KEY = 'tlm_contract_v2';

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
      <div className="relative rounded-xl border-2 border-dashed border-line bg-white">
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
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate3">
            <PenLine className="h-5 w-5" />
            <span className="mt-1 text-xs font-medium">Sign here with your mouse, trackpad, or finger</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-8 bottom-4 border-b border-line" />
      </div>
      <button
        type="button" onClick={clear}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate2 transition-colors hover:text-gRed"
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
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink">{children}</span>
      {hint && <span className="text-[10px] font-medium text-slate3">{hint}</span>}
    </span>
  );
}

function Group({ icon: Icon, title, children }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
        <Icon className="h-4 w-4 text-brand" />
        <h2 className="font-display text-sm font-extrabold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Radio({ checked, onChange, label, desc }) {
  return (
    <button
      type="button" onClick={onChange}
      className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-all
        ${checked ? 'border-blue bg-bluesoft' : 'border-line bg-white hover:border-blue/40'}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2
          ${checked ? 'border-blue bg-blue' : 'border-line'}`}>
          {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span>
          <span className={`block text-sm font-semibold ${checked ? 'text-blue' : 'text-ink'}`}>{label}</span>
          {desc && <span className="mt-0.5 block text-xs leading-snug text-slate2">{desc}</span>}
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
      className={`inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-blue/40 hover:text-blue ${className}`}
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
  const [d, setD] = useState(() => ({ ...DEFAULTS, agreementDate: todayISO(), setupStart: todayISO() }));
  const [saved, setSaved] = useState(false);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const prev = JSON.parse(raw);
        if (prev && typeof prev === 'object') setD((cur) => ({ ...cur, ...prev }));
      }
    } catch { /* storage blocked */ }
    hydrated.current = true;
  }, []);

  const set = (k, v) => setD((cur) => ({ ...cur, [k]: v }));

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch { /* ignore */ }
  };

  const reset = () => {
    if (!window.confirm('Clear this contract and start a new one?')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setD({ ...DEFAULTS, agreementDate: todayISO(), setupStart: todayISO() });
  };

  const toggleService = (id) =>
    setD((cur) => ({
      ...cur,
      services: cur.services.includes(id)
        ? cur.services.filter((x) => x !== id)
        : [...cur.services, id]
    }));

  const gaps = useMemo(() => {
    const list = contractGaps(d);
    if (!d.signatureData) list.push('Your signature');
    return list;
  }, [d]);

  const origin = typeof window !== 'undefined' && window.location.origin.startsWith('http')
    ? window.location.origin
    : AGENCY.origin;

  const link = useMemo(() => signingUrl(d, origin), [d, origin]);
  const email = useMemo(() => coveringEmail(d, link), [d, link]);
  const slug = slugify(d.clientBusiness);
  const readyToSend = contractGaps(d).length === 0;

  const mailtoHref =
    `mailto:${encodeURIComponent(d.clientEmail || '')}` +
    `?subject=${encodeURIComponent(email.subject)}` +
    `&body=${encodeURIComponent(email.body)}`;

  return (
    <div className="min-h-screen bg-soft text-ink antialiased">
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
      <header className="no-print sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/tlm-mark.png" alt="" className="h-11 w-11 shrink-0 object-contain" />
            <div className="min-w-0">
              <div className="truncate font-display font-extrabold leading-tight text-ink">Contract Generator</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">Internal tool</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreviewMobile((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink xl:hidden"
            >
              {showPreviewMobile ? <Settings2 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPreviewMobile ? 'Edit' : 'Preview'}
            </button>
            <button onClick={reset} className="hidden items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate1 transition-colors hover:border-gRed/30 hover:text-gRed sm:inline-flex">
              <Trash2 className="h-4 w-4" /> New
            </button>
            <button onClick={persist} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-blue/40 hover:text-blue">
              {saved ? <Check className="h-4 w-4 text-gGreen" /> : <Save className="h-4 w-4" />} {saved ? 'Saved' : 'Save'}
            </button>
            <button onClick={() => window.print()} className="btn-primary px-5 py-2.5 text-sm">
              <Printer className="h-4 w-4" /> Save as PDF
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 md:px-6 xl:grid-cols-[460px_minmax(0,1fr)]">
        {/* ---------------- CONTROLS ---------------- */}
        <div className={`no-print space-y-4 ${showPreviewMobile ? 'hidden xl:block' : ''}`}>
          {gaps.length > 0 && (
            <div className="rounded-2xl border border-gReview/40 bg-gReview/10 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8a6d00]">
                <AlertCircle className="h-4 w-4" /> Still blank
              </div>
              <ul className="mt-2 space-y-0.5 text-sm text-[#6b5500]">
                {gaps.map((p) => <li key={p}>• {p}</li>)}
              </ul>
            </div>
          )}

          <Group icon={FileText} title="Client">
            <div className="space-y-3">
              <label className="block">
                <Label hint="Required">Business name</Label>
                <input className="form-input" placeholder="Smith Concrete Co."
                  value={d.clientBusiness} onChange={(e) => set('clientBusiness', e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label hint="Signs">Contact name</Label>
                  <input className="form-input" placeholder="John Smith"
                    value={d.clientContact} onChange={(e) => set('clientContact', e.target.value)} />
                </label>
                <label className="block">
                  <Label>Title</Label>
                  <input className="form-input" placeholder="Owner"
                    value={d.clientTitle} onChange={(e) => set('clientTitle', e.target.value)} />
                </label>
              </div>
              <label className="block">
                <Label hint="Optional">Address</Label>
                <input className="form-input" placeholder="123 Main St, Hamilton, ON"
                  value={d.clientAddress} onChange={(e) => set('clientAddress', e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label hint="Required">Email</Label>
                  <input className="form-input" type="email" placeholder="john@smithconcrete.ca"
                    value={d.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} />
                </label>
                <label className="block">
                  <Label>Phone</Label>
                  <input className="form-input" type="tel" placeholder="(905) 555-0134"
                    value={d.clientPhone} onChange={(e) => set('clientPhone', e.target.value)} />
                </label>
              </div>
            </div>
          </Group>

          <Group icon={Settings2} title="Dates, term, and money">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label>Agreement date</Label>
                  <input className="form-input" type="date"
                    value={d.agreementDate} onChange={(e) => set('agreementDate', e.target.value)} />
                </label>
                <label className="block">
                  <Label>Setup start date</Label>
                  <input className="form-input" type="date"
                    value={d.setupStart} onChange={(e) => set('setupStart', e.target.value)} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label>Term length</Label>
                  <select className="form-input" value={d.term} onChange={(e) => set('term', e.target.value)}>
                    {TERMS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block">
                  <Label>Currency</Label>
                  <select className="form-input" value={d.currency} onChange={(e) => set('currency', e.target.value)}>
                    <option>CAD</option><option>USD</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label hint="One time">Setup fee</Label>
                  <input className="form-input" inputMode="decimal" placeholder="1500"
                    value={d.setupFee} onChange={(e) => set('setupFee', e.target.value)} />
                </label>
                <label className="block">
                  <Label hint="Per month">Monthly fee</Label>
                  <input className="form-input" inputMode="decimal" placeholder="1200"
                    value={d.monthlyFee} onChange={(e) => set('monthlyFee', e.target.value)} />
                </label>
              </div>

              <div className="rounded-lg border border-blue/15 bg-bluesoft px-3 py-2.5 text-[11px] leading-snug text-blue">
                The contract states the monthly subscription starts on the day setup is completed and the
                campaigns go live, not on the signing date. Enter 0 for a waived setup fee.
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
                    className={`w-full rounded-xl border-2 px-3.5 py-2.5 text-left transition-all
                      ${on ? 'border-blue bg-bluesoft' : 'border-line bg-white hover:border-blue/40'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2
                        ${on ? 'border-blue bg-blue' : 'border-line'}`}>
                        {on && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
                      </span>
                      <span className={`text-sm font-semibold ${on ? 'text-blue' : 'text-ink'}`}>{s.label}</span>
                    </div>
                  </button>
                );
              })}

              {d.customServices.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="form-input" placeholder="Custom service line"
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
                    className="shrink-0 rounded-lg border border-line px-3 text-slate2 hover:border-gRed/30 hover:text-gRed"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => set('customServices', [...d.customServices, ''])}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line px-3.5 py-2.5 text-sm font-semibold text-slate2 transition-colors hover:border-blue/40 hover:text-blue"
              >
                <Plus className="h-4 w-4" /> Add a custom service
              </button>
            </div>
          </Group>

          <Group icon={ShieldCheck} title="Guarantee">
            <div className="space-y-2">
              <Radio checked={d.guarantee === 'none'} onChange={() => set('guarantee', 'none')}
                label="No guarantee clause" desc="Standard agreement with no performance promise." />
              <Radio checked={d.guarantee === 'bookings'} onChange={() => set('guarantee', 'bookings')}
                label="30-day booking guarantee" desc="A set number of qualified bookings in the first 30 days, or they don't pay." />
              <Radio checked={d.guarantee === 'performance'} onChange={() => set('guarantee', 'performance')}
                label="No-trap performance clause" desc="If we're not delivering after launch, they can walk with no further fees." />
              <Radio checked={d.guarantee === 'both'} onChange={() => set('guarantee', 'both')}
                label="Both clauses" desc="Strongest offer. Both require the minimum ad spend below." />
            </div>

            {(d.guarantee === 'bookings' || d.guarantee === 'both') && (
              <div className="mt-4 space-y-3 border-t border-line pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <Label>Bookings promised</Label>
                    <input className="form-input" type="number" min="1" max="50"
                      value={d.bookingCount}
                      onChange={(e) => set('bookingCount', Math.max(1, Number(e.target.value) || 1))} />
                  </label>
                  <label className="block">
                    <Label>If we miss it</Label>
                    <select className="form-input" value={d.bookingRemedy} onChange={(e) => set('bookingRemedy', e.target.value)}>
                      <option value="waive">They don't pay that month</option>
                      <option value="untilMet">They don't pay until we hit it</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <Label hint="Prints in the contract">What counts as a qualified booking</Label>
                  <textarea className="form-input resize-none text-sm" rows="4"
                    value={d.qualifiedDefinition}
                    onChange={(e) => set('qualifiedDefinition', e.target.value)} />
                </label>
              </div>
            )}

            {d.guarantee !== 'none' && (
              <div className="mt-4 border-t border-line pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <Label hint="Condition">Minimum ad spend / mo</Label>
                    <input className="form-input" inputMode="decimal"
                      value={d.minAdSpend} onChange={(e) => set('minAdSpend', e.target.value)} />
                  </label>
                  <label className="block">
                    <Label>Ad spend currency</Label>
                    <select className="form-input" value={d.adSpendCurrency} onChange={(e) => set('adSpendCurrency', e.target.value)}>
                      <option>USD</option><option>CAD</option>
                    </select>
                  </label>
                </div>
                <div className="mt-2 text-[11px] leading-snug text-slate2">
                  Both guarantees are conditional on this minimum being maintained every month.
                </div>
              </div>
            )}
          </Group>

          <Group icon={PenLine} title="Your signature">
            <label className="mb-3 block">
              <Label>Signing for Trade Leads Marketing</Label>
              <select className="form-input" value={d.signerIndex}
                onChange={(e) => set('signerIndex', Number(e.target.value))}>
                {SIGNERS.map((s, i) => <option key={s.name} value={i}>{s.name} — {s.title}</option>)}
              </select>
            </label>
            <SignaturePad value={d.signatureData} onChange={(v) => set('signatureData', v)} />
            <div className="mt-3 text-[11px] leading-snug text-slate2">
              Your drawn signature appears on the PDF. On the online signing page the client sees your name and
              title attested instead, because a signature image is far too large to travel inside a link.
            </div>
          </Group>

          {/* ---------------- SEND FOR SIGNATURE ---------------- */}
          <Group icon={Link2} title="Send for signature">
            {!readyToSend ? (
              <p className="text-sm leading-relaxed text-slate2">
                Fill in the blanks listed at the top of this panel and the signing link and covering email will
                appear here, ready to copy.
              </p>
            ) : (
              <div className="space-y-5">
                <div>
                  <Label hint={`/sign/${slug}`}>Signing link</Label>
                  <div className="rounded-lg border border-line bg-soft p-3">
                    <p className="break-all font-mono text-[11px] leading-relaxed text-slate1">{link}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <CopyButton text={link} label="Copy link" />
                    <a
                      href={link} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-blue/40 hover:text-blue"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Preview it
                    </a>
                  </div>
                </div>

                <div className="border-t border-line pt-4">
                  <Label hint="Ready to paste">Covering email</Label>
                  <div className="rounded-lg border border-line bg-soft">
                    <div className="border-b border-line px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate3">Subject</div>
                      <div className="mt-0.5 text-[12px] font-semibold text-ink">{email.subject}</div>
                    </div>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap px-3 py-3 font-sans text-[12px] leading-relaxed text-slate1">
{email.body}
                    </pre>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <CopyButton text={email.body} label="Copy email text" />
                    <CopyButton text={email.subject} label="Copy subject" />
                    <a
                      href={mailtoHref}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-blue/40 hover:text-blue"
                    >
                      <Mail className="h-3.5 w-3.5" /> Open in mail app
                    </a>
                  </div>
                </div>

                <ol className="space-y-1.5 border-t border-line pt-4 text-[12px] leading-relaxed text-slate2">
                  <li><strong className="text-ink">1.</strong> Hit <em>Save as PDF</em> above and keep the file.</li>
                  <li><strong className="text-ink">2.</strong> Paste the email, attach that PDF, and send it.</li>
                  <li><strong className="text-ink">3.</strong> They open the link, scroll down, and sign.</li>
                  <li><strong className="text-ink">4.</strong> You both get the signed copy by email automatically.</li>
                </ol>
              </div>
            )}
          </Group>
        </div>

        {/* ---------------- PREVIEW ---------------- */}
        <div className={`print-area ${showPreviewMobile ? '' : 'hidden xl:block'}`}>
          <div className="no-print mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate2">
            <Eye className="h-4 w-4" /> Live preview — this is exactly what prints
          </div>
          <div className="overflow-x-auto pb-4">
            <div className="inline-block rounded-sm shadow-lifted">
              <ContractDocument d={d} tlmSignature={d.signatureData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
