import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FileText, Printer, RotateCcw, Check, Plus, X, PenLine, Save,
  ShieldCheck, AlertCircle, Trash2, Eye, Settings2
} from 'lucide-react';

/* ============================================================
   TRADE LEADS MARKETING — /contract
   Internal tool. Fill the panel on the left, a finished service
   agreement renders on the right, then Save as PDF (the browser's
   print dialog → "Save as PDF") and send it out for signature.
   ============================================================ */

const STORAGE_KEY = 'tlm_contract_v1';

const SIGNERS = [
  { name: 'Ahmad Hamadi', title: 'Founder, Trade Leads Marketing' },
  { name: 'Salman Musa',  title: 'Founder, Trade Leads Marketing' }
];

const SERVICE_LIBRARY = [
  { id: 'ads',       label: 'Google Ads management',              desc: 'Campaign build, keyword and negative-keyword management, ad copy, bid strategy, and ongoing optimization.' },
  { id: 'website',   label: 'Website design or rebuild',          desc: 'Design and build of a conversion-focused website or landing pages, including mobile layout and page speed.' },
  { id: 'seo',       label: 'Local SEO',                          desc: 'Service-area pages, on-page optimization, citations, and review strategy for local search visibility.' },
  { id: 'gbp',       label: 'Google Business Profile optimization',desc: 'Category targeting, photos, posts, service listings, Q&A, and review management for the local map pack.' },
  { id: 'tracking',  label: 'Call and form tracking',             desc: 'Call tracking, form tracking, and conversion tracking installed and attributed to campaign, ad, and keyword.' },
  { id: 'cro',       label: 'Conversion rate optimization',        desc: 'Testing of offers, headlines, and forms to increase the share of visitors who request a quote.' },
  { id: 'aiseo',     label: 'AI search optimization',             desc: 'Structured data and content work targeting AI Overviews, ChatGPT, and similar answer engines.' },
  { id: 'reporting', label: 'Monthly reporting',                  desc: 'A monthly report covering leads, cost per lead, booked estimates, and campaign performance.' }
];

const TERMS = [
  'Month-to-month',
  '3 months',
  '6 months',
  '12 months'
];

const DEFAULTS = {
  // Client
  clientBusiness: '',
  clientContact: '',
  clientTitle: 'Owner',
  clientAddress: '',
  clientEmail: '',
  clientPhone: '',

  // Agreement
  agreementDate: '',
  setupStart: '',
  term: 'Month-to-month',
  currency: 'CAD',
  setupFee: '',
  monthlyFee: '',

  // Services
  services: ['ads', 'gbp', 'tracking', 'reporting'],
  customServices: [],

  // Guarantee
  guarantee: 'none',              // none | bookings | performance | both
  bookingCount: 3,
  bookingRemedy: 'waive',         // waive | untilMet
  qualifiedDefinition:
    'a contact from a property owner in the Client service area who requests a quote or estimate for a service the Client offers and provides valid contact details. Spam, wrong numbers, solicitations, job applicants, and contacts outside the agreed service area do not count.',
  minAdSpend: 500,
  adSpendCurrency: 'USD',

  // Signing
  signerIndex: 0,
  signatureData: ''
};

/* ---------- formatting helpers ---------- */
const money = (value, currency) => {
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(n);
};

/** Parse a yyyy-mm-dd input as a local date, so the day never shifts a timezone. */
const longDate = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
};

const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* ============================================================
   SIGNATURE PAD
   ============================================================ */
function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const [hasInk, setHasInk] = useState(Boolean(value));

  /* Size the backing store to the device pixel ratio so the line is crisp
     and the exported PNG is high enough resolution to print. */
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const prior = value;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0F172A';

    // Resizing clears the canvas — repaint whatever was already signed.
    if (prior) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = prior;
    }
  }, [value]);

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="relative rounded-xl border-2 border-dashed border-line bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block w-full h-[130px] touch-none cursor-crosshair"
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
        <div className="pointer-events-none absolute bottom-4 inset-x-8 border-b border-line" />
      </div>
      <button
        type="button" onClick={clear}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate2 hover:text-gRed transition-colors"
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
    <span className="flex items-baseline justify-between gap-3 mb-1.5">
      <span className="text-[11px] font-bold text-ink uppercase tracking-wider">{children}</span>
      {hint && <span className="text-[10px] text-slate3 font-medium">{hint}</span>}
    </span>
  );
}

function Group({ icon: Icon, title, children }) {
  return (
    <section className="rounded-2xl border border-line bg-white shadow-soft p-5">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-line">
        <Icon className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-display font-extrabold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Radio({ checked, onChange, label, desc }) {
  return (
    <button
      type="button" onClick={onChange}
      className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all
        ${checked ? 'border-blue bg-bluesoft' : 'border-line bg-white hover:border-blue/40'}`}
    >
      <div className="flex items-start gap-3">
        <span className={`shrink-0 mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center
          ${checked ? 'border-blue bg-blue' : 'border-line'}`}>
          {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span>
          <span className={`block text-sm font-semibold ${checked ? 'text-blue' : 'text-ink'}`}>{label}</span>
          {desc && <span className="block text-xs text-slate2 mt-0.5 leading-snug">{desc}</span>}
        </span>
      </div>
    </button>
  );
}

/* ============================================================
   THE DOCUMENT
   ============================================================ */
function Clause({ n, title, children }) {
  return (
    <section className="contract-clause mb-4">
      <h3 className="text-[11.5pt] font-bold text-black mb-1">{n}. {title}</h3>
      <div className="text-[10pt] leading-[1.55] text-black space-y-2">{children}</div>
    </section>
  );
}

function ContractDocument({ d }) {
  const signer = SIGNERS[d.signerIndex] || SIGNERS[0];

  const services = [
    ...SERVICE_LIBRARY.filter((s) => d.services.includes(s.id)),
    ...d.customServices.filter(Boolean).map((label) => ({ id: label, label, desc: '' }))
  ];

  const setupFee   = money(d.setupFee, d.currency);
  const monthlyFee = money(d.monthlyFee, d.currency);
  const adSpend    = money(d.minAdSpend, d.adSpendCurrency);

  const agreementDate = longDate(d.agreementDate);
  const setupStart    = longDate(d.setupStart);

  const showBookings    = d.guarantee === 'bookings' || d.guarantee === 'both';
  const showPerformance = d.guarantee === 'performance' || d.guarantee === 'both';
  const anyGuarantee    = showBookings || showPerformance;

  const blank = (text) => <span className="text-slate3 italic">{text}</span>;

  // Clause numbers shift depending on which optional clauses are included.
  let n = 0;
  const num = () => ++n;

  return (
    <article className="contract-sheet bg-white text-black">
      {/* Letterhead */}
      <header className="flex items-start justify-between pb-4 mb-6 border-b-2 border-black">
        <div className="flex items-center gap-3">
          <img src="/tlmlogo.png" alt="" className="h-12 w-12 object-contain" />
          <div>
            <div className="text-[13pt] font-extrabold tracking-tight leading-none">Trade Leads Marketing</div>
            <div className="text-[7.5pt] uppercase tracking-[0.22em] text-[#F37021] font-bold mt-1">
              Marketing for Contractors
            </div>
          </div>
        </div>
        <div className="text-right text-[8pt] leading-[1.5] text-[#333]">
          <div>tradeleadsmarketing.ca</div>
          <div>info@tradeleadsmarketing.com</div>
          <div>(289) 489-1167</div>
        </div>
      </header>

      <h1 className="text-[16pt] font-extrabold text-center tracking-tight">Marketing Services Agreement</h1>
      <p className="text-center text-[9pt] text-[#555] mt-1 mb-6">
        {agreementDate ? `Dated ${agreementDate}` : blank('Dated ____________________')}
      </p>

      {/* Parties */}
      <Clause n={num()} title="Parties">
        <p>
          This Marketing Services Agreement (the <strong>"Agreement"</strong>) is entered into on{' '}
          {agreementDate || blank('____________________')} between:
        </p>
        <table className="w-full text-[9.5pt] mt-2 border border-[#ddd]">
          <tbody>
            <tr className="border-b border-[#ddd]">
              <td className="w-[110px] align-top p-2 bg-[#f7f7f7] font-bold">Service Provider</td>
              <td className="p-2">
                <strong>Trade Leads Marketing</strong> (&ldquo;TLM&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)<br />
                info@tradeleadsmarketing.com &middot; (289) 489-1167
              </td>
            </tr>
            <tr>
              <td className="align-top p-2 bg-[#f7f7f7] font-bold">Client</td>
              <td className="p-2">
                <strong>{d.clientBusiness || blank('[Client business name]')}</strong> (&ldquo;Client&rdquo;, &ldquo;you&rdquo;)<br />
                {d.clientContact || blank('[Contact name]')}{d.clientTitle ? `, ${d.clientTitle}` : ''}<br />
                {d.clientAddress && <>{d.clientAddress}<br /></>}
                {[d.clientEmail, d.clientPhone].filter(Boolean).join(' · ') || blank('[Email · Phone]')}
              </td>
            </tr>
          </tbody>
        </table>
      </Clause>

      {/* Services */}
      <Clause n={num()} title="Services">
        <p>TLM will provide the Client with the following services (the <strong>&ldquo;Services&rdquo;</strong>):</p>
        {services.length ? (
          <ul className="list-disc pl-5 space-y-1 mt-1">
            {services.map((s) => (
              <li key={s.id}>
                <strong>{s.label}.</strong>{s.desc ? ` ${s.desc}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p>{blank('[No services selected — choose at least one in the panel]')}</p>
        )}
        <p>
          Work outside this list is not included and will be quoted separately in writing before it begins.
        </p>
      </Clause>

      {/* Setup and start */}
      <Clause n={num()} title="Setup and Start Date">
        <p>
          Setup begins on {setupStart || blank('____________________')} and covers the build work required to launch
          the Services: account access and configuration, tracking installation, campaign or page build, and any
          design work included above.
        </p>
        <p>
          <strong>The monthly subscription starts on the date setup is completed and the Services go live,
          not on the date this Agreement is signed.</strong> TLM will confirm that date to the Client in writing,
          and it becomes the monthly billing date for the remainder of the Agreement.
        </p>
      </Clause>

      {/* Fees */}
      <Clause n={num()} title="Fees and Payment">
        <table className="w-full text-[9.5pt] border border-[#ddd] my-1">
          <tbody>
            <tr className="border-b border-[#ddd]">
              <td className="w-[190px] p-2 bg-[#f7f7f7] font-bold align-top">Initial setup fee</td>
              <td className="p-2">
                {setupFee ? <strong>{setupFee}</strong> : blank('[Setup fee]')}
                <span className="text-[#555]"> — one time, payable before setup work begins.</span>
              </td>
            </tr>
            <tr className="border-b border-[#ddd]">
              <td className="p-2 bg-[#f7f7f7] font-bold align-top">Monthly service fee</td>
              <td className="p-2">
                {monthlyFee ? <strong>{monthlyFee} per month</strong> : blank('[Monthly fee]')}
                <span className="text-[#555]"> — first payment due on the setup completion date, then monthly on the same day.</span>
              </td>
            </tr>
            <tr>
              <td className="p-2 bg-[#f7f7f7] font-bold align-top">Term</td>
              <td className="p-2"><strong>{d.term}</strong></td>
            </tr>
          </tbody>
        </table>
        <p>
          All amounts are in {d.currency} and exclusive of applicable taxes. Invoices are payable on receipt.
          Advertising spend paid to Google, Meta, or any other platform is billed by that platform directly to the
          Client and is not included in the fees above.
        </p>
      </Clause>

      {/* Advertising budget — only relevant when a guarantee is attached */}
      {anyGuarantee && (
        <Clause n={num()} title="Advertising Budget">
          <p>
            The Client will maintain a minimum advertising budget of{' '}
            <strong>{adSpend || blank('[minimum ad spend]')} per month</strong>, paid directly to the advertising
            platform. This minimum is a condition of the guarantee{d.guarantee === 'both' ? 's' : ''} in this
            Agreement: if the Client&rsquo;s advertising budget falls below it in any month, the
            guarantee{d.guarantee === 'both' ? 's do' : ' does'} not apply for that month.
          </p>
        </Clause>
      )}

      {/* Guarantees */}
      {showBookings && (
        <Clause n={num()} title="30-Day Booking Guarantee">
          <p>
            TLM guarantees the Client will receive at least <strong>{d.bookingCount} qualified booking
            {d.bookingCount === 1 ? '' : 's'}</strong> within the first 30 days after the Services go live.
          </p>
          <p>
            {d.bookingRemedy === 'untilMet' ? (
              <>
                If that target is not met within the first 30 days, <strong>the Client owes no monthly service fee
                and none becomes payable until the target is met.</strong> TLM continues to work at no monthly cost
                to the Client until it is.
              </>
            ) : (
              <>
                If that target is not met within the first 30 days, <strong>the Client does not pay the monthly
                service fee for that period.</strong> Any monthly fee already paid for that period is refunded or
                credited at the Client&rsquo;s choice.
              </>
            )}
          </p>
          <p>
            A <strong>qualified booking</strong> means {d.qualifiedDefinition}
          </p>
          <p>
            This guarantee applies only where the Client has: maintained the minimum advertising budget above;
            given TLM the account access and approvals needed to run and track the Services; and responded to
            incoming leads within one business day. The setup fee is not covered by this guarantee.
          </p>
        </Clause>
      )}

      {showPerformance && (
        <Clause n={num()} title="No-Trap Performance Clause">
          <p>
            The Client is never locked into paying for work that is not performing. If, after the Services go live,
            TLM is not delivering against the performance expectations agreed at kickoff, the Client may end this
            Agreement immediately by written notice.
          </p>
          <p>
            On that notice, <strong>no further monthly service fees are payable</strong> beyond the month in which
            notice is given, and there is no early-termination charge, penalty, or remaining-term liability. The
            Client keeps ownership of the accounts and assets described below.
          </p>
          <p>
            This clause applies only while the Client maintains the minimum advertising budget above and provides
            the access and approvals TLM needs to do the work.
          </p>
        </Clause>
      )}

      {/* Client responsibilities */}
      <Clause n={num()} title="Client Responsibilities">
        <p>The Client agrees to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>provide timely access to the website, domain, ad accounts, Google Business Profile, and analytics;</li>
          <li>review and approve drafts, ad copy, and page content within a reasonable time;</li>
          <li>respond to leads promptly — TLM can generate a lead, but only the Client can close it;</li>
          <li>supply photos, service details, and any licence or insurance information needed for ads; and</li>
          <li>pay advertising platforms directly and keep those accounts in good standing.</li>
        </ul>
        <p>
          Where a delay in the above prevents TLM from delivering the Services, timelines and any guarantee period
          shift by the length of that delay.
        </p>
      </Clause>

      {/* Term and termination */}
      <Clause n={num()} title="Term, Renewal, and Termination">
        <p>
          The term of this Agreement is <strong>{d.term}</strong>, beginning on the setup completion date.
          {d.term === 'Month-to-month'
            ? ' It continues month to month until either party ends it.'
            : ' At the end of the term it continues month to month unless either party gives notice.'}
        </p>
        <p>
          Either party may end this Agreement with <strong>30 days&rsquo; written notice</strong>. TLM will complete
          any work already paid for. Fees for the final month are payable in full and setup fees are not refundable,
          except where a clause of this Agreement expressly says otherwise.
        </p>
      </Clause>

      {/* Ownership */}
      <Clause n={num()} title="Ownership and Confidentiality">
        <p>
          The Client owns its ad accounts, Google Business Profile, domain, website content, lead data, and any
          creative produced specifically for the Client and paid for in full. TLM keeps ownership of its own
          templates, internal processes, tools, and anything built before this Agreement.
        </p>
        <p>
          Each party will keep the other&rsquo;s non-public business information confidential and use it only to
          perform this Agreement. TLM may reference the Client&rsquo;s business name and campaign results as a case
          study unless the Client asks in writing that it not.
        </p>
      </Clause>

      {/* Results */}
      <Clause n={num()} title="Results">
        <p>
          {anyGuarantee
            ? 'Apart from the guarantee terms expressly set out above, TLM does not guarantee any specific lead volume, ranking position, cost per lead, or revenue outcome.'
            : 'TLM does not guarantee any specific lead volume, ranking position, cost per lead, or revenue outcome.'}{' '}
          Results depend on market competition, advertising budget, service area, seasonality, pricing, and the
          Client&rsquo;s own sales process. TLM is not affiliated with or endorsed by Google, and cannot control
          changes those platforms make to their policies, algorithms, or pricing.
        </p>
        <p>
          Neither party is liable to the other for indirect or consequential loss. TLM&rsquo;s total liability under
          this Agreement is limited to the fees the Client paid TLM in the three months before the claim arose.
        </p>
      </Clause>

      {/* Governing law */}
      <Clause n={num()} title="General">
        <p>
          This Agreement is governed by the laws of the Province of Ontario and the federal laws of Canada that
          apply in it. It is the entire agreement between the parties on this subject and replaces any earlier
          discussion or proposal. Changes must be in writing and signed by both parties. If any clause is found
          unenforceable, the rest of the Agreement stays in force.
        </p>
      </Clause>

      {/* Signatures */}
      <section className="contract-signatures mt-8 pt-5 border-t-2 border-black">
        <p className="text-[9.5pt] mb-5">
          The parties agree to the terms above and have signed on the dates shown.
        </p>

        <div className="grid grid-cols-2 gap-8">
          {/* TLM */}
          <div>
            <div className="text-[8pt] font-bold uppercase tracking-[0.15em] text-[#555] mb-2">
              For Trade Leads Marketing
            </div>
            <div className="h-[64px] flex items-end">
              {d.signatureData
                ? <img src={d.signatureData} alt="Signature" className="max-h-[62px] object-contain object-left" />
                : <span className="text-slate3 text-[8pt] italic pb-1">(signature)</span>}
            </div>
            <div className="border-b border-black" />
            <div className="mt-1.5 text-[9.5pt] font-bold">{signer.name}</div>
            <div className="text-[8.5pt] text-[#555]">{signer.title}</div>
            <div className="mt-4">
              <div className="text-[9.5pt]">{agreementDate || <span className="inline-block w-[150px] border-b border-black">&nbsp;</span>}</div>
              <div className="border-b border-black mt-0.5" />
              <div className="mt-1 text-[8pt] uppercase tracking-wider text-[#555]">Date</div>
            </div>
          </div>

          {/* Client */}
          <div>
            <div className="text-[8pt] font-bold uppercase tracking-[0.15em] text-[#555] mb-2">
              For {d.clientBusiness || 'the Client'}
            </div>
            <div className="h-[64px] flex items-end">
              <span className="text-slate3 text-[8pt] italic pb-1">(signature)</span>
            </div>
            <div className="border-b border-black" />
            <div className="mt-1.5 text-[9.5pt] font-bold">
              {d.clientContact || <span className="text-slate3 italic">Print name</span>}
            </div>
            <div className="text-[8.5pt] text-[#555]">
              {d.clientTitle || 'Title'}{d.clientBusiness ? `, ${d.clientBusiness}` : ''}
            </div>
            <div className="mt-4">
              <div className="h-[18px]" />
              <div className="border-b border-black mt-0.5" />
              <div className="mt-1 text-[8pt] uppercase tracking-wider text-[#555]">Date</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-8 pt-3 border-t border-[#ddd] text-[7.5pt] text-[#777] flex justify-between">
        <span>Trade Leads Marketing — Marketing Services Agreement</span>
        <span>{d.clientBusiness || 'Client'}{agreementDate ? ` · ${agreementDate}` : ''}</span>
      </footer>
    </article>
  );
}

/* ============================================================
   PAGE
   ============================================================ */
export default function Contract() {
  const [d, setD] = useState(() => ({ ...DEFAULTS, agreementDate: todayISO(), setupStart: todayISO() }));
  const [saved, setSaved] = useState(false);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);

  /* Restore the last contract so a half-filled one survives a refresh */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const prev = JSON.parse(raw);
        if (prev && typeof prev === 'object') {
          setD((cur) => ({ ...cur, ...prev }));
        }
      }
    } catch { /* storage blocked */ }
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

  const problems = useMemo(() => {
    const list = [];
    if (!d.clientBusiness.trim()) list.push('Client business name');
    if (!d.clientContact.trim())  list.push('Client contact name (who signs)');
    if (!d.setupFee)              list.push('Setup fee');
    if (!d.monthlyFee)            list.push('Monthly fee');
    if (!d.services.length && !d.customServices.filter(Boolean).length) list.push('At least one service');
    if (!d.signatureData)         list.push('Your signature');
    return list;
  }, [d]);

  return (
    <div className="min-h-screen bg-soft text-ink antialiased">
      {/* Print rules live with the component so the sheet is the only thing that prints */}
      <style>{`
        @page { size: Letter portrait; margin: 14mm 14mm 12mm; }
        .contract-sheet {
          width: 8.5in;
          padding: 0.55in 0.6in;
          font-family: 'Inter', system-ui, sans-serif;
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
      <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-white border border-line flex items-center justify-center p-1 shrink-0">
              <img src="/tlmlogo.png" alt="" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-ink leading-tight truncate">Contract Generator</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-brand font-bold">Internal tool</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreviewMobile((v) => !v)}
              className="xl:hidden inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
            >
              {showPreviewMobile ? <Settings2 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPreviewMobile ? 'Edit' : 'Preview'}
            </button>
            <button onClick={reset} className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate1 hover:text-gRed hover:border-gRed/30 transition-colors">
              <Trash2 className="h-4 w-4" /> New
            </button>
            <button onClick={persist} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-blue/40 hover:text-blue transition-colors">
              {saved ? <Check className="h-4 w-4 text-gGreen" /> : <Save className="h-4 w-4" />} {saved ? 'Saved' : 'Save'}
            </button>
            <button onClick={() => window.print()} className="btn-primary text-sm py-2.5 px-5">
              <Printer className="h-4 w-4" /> Save as PDF
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-6 grid xl:grid-cols-[440px_minmax(0,1fr)] gap-6">
        {/* ---------------- CONTROLS ---------------- */}
        <div className={`no-print space-y-4 ${showPreviewMobile ? 'hidden xl:block' : ''}`}>
          {problems.length > 0 && (
            <div className="rounded-2xl border border-gReview/40 bg-gReview/10 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8a6d00]">
                <AlertCircle className="h-4 w-4" /> Still blank
              </div>
              <ul className="mt-2 text-sm text-[#6b5500] space-y-0.5">
                {problems.map((p) => <li key={p}>• {p}</li>)}
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
                  <Label>Email</Label>
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

              <div className="rounded-lg bg-bluesoft border border-blue/15 px-3 py-2.5 text-[11px] text-blue leading-snug">
                The contract states the monthly subscription starts on the day setup is completed and the
                campaigns go live — not on the signing date.
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
                    className={`w-full text-left rounded-xl border-2 px-3.5 py-2.5 transition-all
                      ${on ? 'border-blue bg-bluesoft' : 'border-line bg-white hover:border-blue/40'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center
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
                    className="shrink-0 rounded-lg border border-line px-3 text-slate2 hover:text-gRed hover:border-gRed/30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => set('customServices', [...d.customServices, ''])}
                className="w-full rounded-xl border-2 border-dashed border-line px-3.5 py-2.5 text-sm font-semibold text-slate2 hover:border-blue/40 hover:text-blue transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> Add a custom service
              </button>
            </div>
          </Group>

          <Group icon={ShieldCheck} title="Guarantee">
            <div className="space-y-2">
              <Radio
                checked={d.guarantee === 'none'} onChange={() => set('guarantee', 'none')}
                label="No guarantee clause"
                desc="Standard agreement with no performance promise."
              />
              <Radio
                checked={d.guarantee === 'bookings'} onChange={() => set('guarantee', 'bookings')}
                label="30-day booking guarantee"
                desc="A set number of qualified bookings in the first 30 days, or they don't pay."
              />
              <Radio
                checked={d.guarantee === 'performance'} onChange={() => set('guarantee', 'performance')}
                label="No-trap performance clause"
                desc="If we're not delivering after launch, they can walk with no further fees."
              />
              <Radio
                checked={d.guarantee === 'both'} onChange={() => set('guarantee', 'both')}
                label="Both clauses"
                desc="Strongest offer. Both require the minimum ad spend below."
              />
            </div>

            {(d.guarantee === 'bookings' || d.guarantee === 'both') && (
              <div className="mt-4 pt-4 border-t border-line space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <Label>Bookings promised</Label>
                    <input
                      className="form-input" type="number" min="1" max="50"
                      value={d.bookingCount}
                      onChange={(e) => set('bookingCount', Math.max(1, Number(e.target.value) || 1))}
                    />
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
                  <textarea
                    className="form-input resize-none text-sm" rows="4"
                    value={d.qualifiedDefinition}
                    onChange={(e) => set('qualifiedDefinition', e.target.value)}
                  />
                </label>
              </div>
            )}

            {d.guarantee !== 'none' && (
              <div className="mt-4 pt-4 border-t border-line">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <Label hint="Condition">Minimum ad spend / mo</Label>
                    <input
                      className="form-input" inputMode="decimal"
                      value={d.minAdSpend} onChange={(e) => set('minAdSpend', e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <Label>Ad spend currency</Label>
                    <select className="form-input" value={d.adSpendCurrency} onChange={(e) => set('adSpendCurrency', e.target.value)}>
                      <option>USD</option><option>CAD</option>
                    </select>
                  </label>
                </div>
                <div className="mt-2 text-[11px] text-slate2 leading-snug">
                  Both guarantees are conditional on this minimum being maintained every month.
                </div>
              </div>
            )}
          </Group>

          <Group icon={PenLine} title="Your signature">
            <label className="block mb-3">
              <Label>Signing for Trade Leads Marketing</Label>
              <select
                className="form-input"
                value={d.signerIndex}
                onChange={(e) => set('signerIndex', Number(e.target.value))}
              >
                {SIGNERS.map((s, i) => <option key={s.name} value={i}>{s.name} — {s.title}</option>)}
              </select>
            </label>
            <SignaturePad value={d.signatureData} onChange={(v) => set('signatureData', v)} />
            <div className="mt-3 text-[11px] text-slate2 leading-snug">
              The client signs and dates their side after you send the PDF.
            </div>
          </Group>
        </div>

        {/* ---------------- PREVIEW ---------------- */}
        <div className={`print-area ${showPreviewMobile ? '' : 'hidden xl:block'}`}>
          <div className="no-print mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate2">
            <Eye className="h-4 w-4" /> Live preview — this is exactly what prints
          </div>
          <div className="overflow-x-auto pb-4">
            <div className="shadow-lifted rounded-sm inline-block">
              <ContractDocument d={d} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
