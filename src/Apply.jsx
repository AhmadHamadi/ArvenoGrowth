import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Phone } from 'lucide-react';

/* ============================================================
   TRADE LEADS MARKETING — /apply

   Design direction: INDUSTRIAL UTILITARIAN, built as a work order.
   Warm paper ground, warm near-black ink, safety orange as the only
   accent. Ruled rows and hairlines instead of floating rounded cards;
   lettered options and monospaced docket numbers instead of icon grids.
   The site's blue is deliberately absent here.

   Three steps: one tap, one tap, one screen. This is the page every ad
   points at, so the shortest honest path to a phone number wins over
   anything else we might like to know.
   ============================================================ */

const PHONE_DISPLAY = '(289) 489-1167';
const PHONE_HREF    = 'tel:+12894891167';
const EMAIL         = 'info@tradeleadsmarketing.com';
const STORAGE_KEY   = 'tlm_apply_draft_v2';
const TOTAL_STEPS   = 3;

const EMPTY = {
  trade: '', tradeOther: '',
  budget: '',
  name: '', business: '', email: '', phone: '', city: '', siteUrl: '',
  website: '' // honeypot — must stay empty
};

const TRADES = [
  'Concrete', 'Roofing', 'Landscaping', 'HVAC',
  'Plumbing', 'Electrical', 'Renovation / Builder', 'Paving / Excavation',
  'Painting', 'Fencing / Decking', 'Restoration', 'Other trade'
];

const BUDGETS = [
  { v: 'Under $1,000 / mo',    sub: 'Getting started' },
  { v: '$1,000 – $2,500 / mo', sub: 'Most common' },
  { v: '$2,500 – $5,000 / mo', sub: 'Growth mode' },
  { v: '$5,000+ / mo',         sub: 'Scaling hard' },
  { v: 'Not sure yet',         sub: 'We will help you size it' }
];

/* ---------- helpers ---------- */
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(e).trim());

const digits = (s) => String(s).replace(/\D/g, '');

function formatPhone(raw) {
  const d = digits(raw).slice(0, 11);
  const n = d.length === 11 && d[0] === '1' ? d.slice(1) : d;
  if (n.length <= 3) return n;
  if (n.length <= 6) return `(${n.slice(0, 3)}) ${n.slice(3)}`;
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6, 10)}`;
}

const isPhone = (p) => {
  const n = digits(p);
  return n.length === 10 || (n.length === 11 && n[0] === '1');
};

const letter = (i) => String.fromCharCode(65 + i);

/* ============================================================
   PAGE-LOCAL STYLE
   Paper grain lives here rather than in Tailwind, because it exists
   only on this funnel.
   ============================================================ */
const PageStyle = () => (
  <style>{`
    .grain::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.5;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.28'/%3E%3C/svg%3E");
    }
    .rule-in { animation: ruleIn 0.7s cubic-bezier(0.22,1,0.36,1) both; transform-origin: left; }
    @keyframes ruleIn { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @media (prefers-reduced-motion: reduce) { .rule-in { animation: none; } }
  `}</style>
);

/* ============================================================
   THE AUDIT, DRAWN AS A MARKED-UP SHEET
   ============================================================ */
function AuditSheet({ className = '' }) {
  const rows = [
    { label: 'Google Ads waste',        score: 34 },
    { label: 'Google Business Profile', score: 52 },
    { label: 'Website conversion',      score: 41 },
    { label: 'Local SEO coverage',      score: 68 }
  ];
  return (
    <svg viewBox="0 0 300 176" className={className} role="img"
         aria-label="Illustration of the marketing audit sheet you receive">
      <rect x="0.5" y="0.5" width="299" height="175" fill="#F2EFE9" stroke="#15140F" />
      <rect x="0" y="0" width="300" height="24" fill="#15140F" />
      <text x="12" y="16" fill="#F2EFE9" fontFamily="'IBM Plex Mono', monospace" fontSize="9" fontWeight="600" letterSpacing="1.6">
        MARKETING AUDIT
      </text>
      <text x="288" y="16" textAnchor="end" fill="#F37021" fontFamily="'IBM Plex Mono', monospace" fontSize="9" fontWeight="600">
        REV.01
      </text>

      {/* Headline score, set like a gauge reading rather than a donut */}
      <text x="14" y="62" fontFamily="Archivo, sans-serif" fontSize="40" fontWeight="800" fill="#15140F">44</text>
      <text x="66" y="49" fontFamily="'IBM Plex Mono', monospace" fontSize="8" letterSpacing="1.2" fill="#726C5C">LEAD-READINESS</text>
      <text x="66" y="61" fontFamily="'IBM Plex Mono', monospace" fontSize="8" letterSpacing="1.2" fill="#726C5C">SCORE / 100</text>
      <rect x="196" y="42" width="90" height="20" fill="#F37021" />
      <text x="241" y="56" textAnchor="middle" fontFamily="'IBM Plex Mono', monospace" fontSize="9" fontWeight="700" fill="#F2EFE9">6 LEAKS FOUND</text>

      <line x1="14" y1="76" x2="286" y2="76" stroke="#15140F" strokeWidth="1" />

      {rows.map((r, i) => {
        const y = 92 + i * 20;
        return (
          <g key={r.label}>
            <text x="14" y={y + 3} fontFamily="'IBM Plex Mono', monospace" fontSize="7.5" fill="#726C5C">
              {String(i + 1).padStart(2, '0')}
            </text>
            <text x="34" y={y + 3} fontFamily="Archivo, sans-serif" fontSize="9" fill="#15140F">{r.label}</text>
            <rect x="196" y={y - 4} width="90" height="7" fill="#D6CFC0" />
            <rect x="196" y={y - 4} width={90 * (r.score / 100)} height="7" fill="#15140F" />
            <line x1="14" y1={y + 11} x2="286" y2={y + 11} stroke="#D6CFC0" />
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================
   CONTROLS
   ============================================================ */
function ChoiceRow({ idx, label, sub, selected, onClick, lastInCol, rightCol }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative flex w-full items-center gap-4 px-4 py-[15px] text-left
        border-b border-paperEdge ${rightCol ? '' : 'sm:border-r sm:border-paperEdge'}
        ${lastInCol ? 'sm:border-b-0' : ''}
        transition-colors duration-100
        focus:outline-none focus-visible:bg-paper2
        ${selected ? 'bg-inkd' : 'hover:bg-paper2'}`}
    >
      <span className={`absolute left-0 top-0 h-full w-[3px] transition-colors ${selected ? 'bg-brand' : 'bg-transparent'}`} />
      <span className={`font-plex text-[11px] font-semibold tabular-nums ${selected ? 'text-brand' : 'text-inkd3'}`}>
        {idx}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-archivo text-[16px] font-semibold leading-snug ${selected ? 'text-paper' : 'text-inkd'}`}>
          {label}
        </span>
        {sub && (
          <span className={`mt-0.5 block font-archivo text-[13.5px] ${selected ? 'text-paper/60' : 'text-inkd3'}`}>
            {sub}
          </span>
        )}
      </span>
      <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center border transition-colors
        ${selected ? 'border-brand bg-brand' : 'border-inkd/25 group-hover:border-inkd/50'}`}>
        {selected && <Check className="h-3 w-3 text-paper" strokeWidth={3.5} />}
      </span>
    </button>
  );
}

function TextField({ label, hint, id, error, value, onChange, ...rest }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between gap-3">
        <span className="font-archivo text-[13.5px] font-semibold text-inkd2">{label}</span>
        {hint && <span className="font-archivo text-[12.5px] text-inkd3">{hint}</span>}
      </label>
      <input
        id={id}
        value={value}
        onChange={onChange}
        className={`mt-1.5 w-full border-0 border-b bg-transparent px-0 pb-2 pt-1
          font-archivo text-[16px] text-inkd placeholder:text-inkd3/55
          transition-colors focus:outline-none focus:ring-0 focus:border-brand
          ${error ? 'border-gRed' : 'border-inkd/25'}`}
        {...rest}
      />
      {error && (
        <p className="mt-1.5 font-archivo text-[13px] text-gRed">{error}</p>
      )}
    </div>
  );
}

function StepHeading({ n, title, sub }) {
  return (
    <div className="mb-7">
      <div className="flex items-baseline gap-3">
        <span className="font-plex text-[11px] font-semibold text-brand">{n}</span>
        <span className="h-px flex-1 bg-paperEdge" />
      </div>
      <h2 className="mt-3 font-archivo text-[26px] font-extrabold leading-[1.1] tracking-[-0.02em] text-inkd sm:text-[32px]">
        {title}
      </h2>
      {sub && <p className="mt-3 max-w-xl font-archivo text-[16px] leading-[1.65] text-inkd2">{sub}</p>}
    </div>
  );
}

/* ============================================================
   THE FUNNEL
   ============================================================ */
function Funnel() {
  const [step, setStep]         = useState(1);
  const [data, setData]         = useState(EMPTY);
  const [errors, setErrors]     = useState({});
  const [status, setStatus]     = useState({ state: 'idle', error: null });
  const [dir, setDir]           = useState(1);
  const [restored, setRestored] = useState(false);
  const cardRef  = useRef(null);
  const advanceT = useRef(null);
  const hydrated = useRef(false);

  /* Restore a half-finished application */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object' && saved.data) {
          setData({ ...EMPTY, ...saved.data, website: '' });
          setStep(Math.min(Math.max(Number(saved.step) || 1, 1), TOTAL_STEPS));
          setRestored(true);
        }
      }
    } catch { /* storage blocked — carry on */ }
    hydrated.current = true;
  }, []);

  /* Persist as they go — but never before the restore above has run, or the
     first empty render would overwrite the draft we just read back. */
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      const { website, ...keep } = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data: keep }));
    } catch { /* ignore */ }
  }, [step, data]);

  useEffect(() => () => clearTimeout(advanceT.current), []);

  const set = (k, v) => {
    setData((d) => ({ ...d, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: null } : e));
  };

  const scrollToCard = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 84;
    if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'smooth' });
  }, []);

  const validate = (s) => {
    const e = {};
    if (s === 1 && !data.trade) e.trade = 'Pick the trade that fits best';
    if (s === 2 && !data.budget) e.budget = 'Pick a range — a ballpark is fine';
    if (s === 3) {
      if (data.name.trim().length < 2) e.name = 'Your name, please';
      if (!isEmail(data.email))        e.email = 'That email does not look right';
      if (!isPhone(data.phone))        e.phone = 'A 10-digit number so we can call';
      if (data.city.trim().length < 2) e.city = 'City and province or state';
    }
    return e;
  };

  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step < TOTAL_STEPS) {
      setDir(1);
      setStep((s) => s + 1);
      scrollToCard();
    }
  };

  const back = () => {
    if (step === 1) return;
    clearTimeout(advanceT.current);
    setDir(-1);
    setErrors({});
    setStep((s) => s - 1);
    scrollToCard();
  };

  /* The two tap steps advance themselves — one tap, no hunting for a button. */
  const autoAdvance = (fromStep) => {
    clearTimeout(advanceT.current);
    advanceT.current = setTimeout(() => {
      setDir(1);
      setStep((s) => (s === fromStep && s < TOTAL_STEPS ? s + 1 : s));
      scrollToCard();
    }, 260);
  };

  const submit = async (ev) => {
    ev?.preventDefault?.();
    if (data.website) return; // honeypot tripped
    const e = validate(3);
    setErrors(e);
    if (Object.keys(e).length) return;

    setStatus({ state: 'sending', error: null });

    const trade = data.trade === 'Other trade' && data.tradeOther.trim()
      ? data.tradeOther.trim()
      : data.trade;

    const payload = {
      name: data.name,
      business: data.business,
      email: data.email,
      phone: data.phone,
      city: data.city,
      service: trade,
      source: 'apply',
      trade,
      budget: data.budget,
      siteUrl: data.siteUrl,
      website: ''
    };

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Something went wrong on our end. Call or text us and we will take it from there:');
      }
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      const first = data.name.trim().split(/\s+/)[0] || '';
      window.location.href = `/thank-you?name=${encodeURIComponent(first)}`;
    } catch (err) {
      setStatus({ state: 'error', error: err.message });
    }
  };

  const onKeyDown = (ev) => {
    if (ev.key === 'Enter' && ev.target.tagName !== 'TEXTAREA' && step < TOTAL_STEPS) {
      ev.preventDefault();
      next();
    }
  };

  const variants = {
    enter:  (d) => ({ opacity: 0, x: d > 0 ? 26 : -26 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
    exit:   (d) => ({ opacity: 0, x: d > 0 ? -26 : 26, transition: { duration: 0.15 } })
  };

  const chosenTrade = data.trade === 'Other trade' && data.tradeOther.trim()
    ? data.tradeOther.trim()
    : data.trade;

  return (
    <div ref={cardRef} id="apply-form" className="scroll-mt-24">
      <div className="border border-inkd bg-paper">
        {/* Docket strip */}
        <div className="flex items-center justify-between gap-4 border-b border-inkd bg-inkd px-4 py-2.5 sm:px-6">
          <span className="font-plex text-[10px] font-semibold uppercase tracking-[0.2em] text-paper/70">
            Contractor application
          </span>
          <div className="flex items-center gap-3">
            <span className="font-plex text-[10px] font-semibold tabular-nums text-paper/70">
              STEP {String(step).padStart(2, '0')} / {String(TOTAL_STEPS).padStart(2, '0')}
            </span>
            <span className="flex gap-1" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <span key={i} className={`h-[5px] w-6 transition-colors duration-300 ${i <= step ? 'bg-brand' : 'bg-paper/20'}`} />
              ))}
            </span>
          </div>
        </div>

        {restored && step > 1 && status.state === 'idle' && (
          <div className="border-b border-paperEdge bg-paper2 px-4 py-2 font-archivo text-[13px] text-inkd2 sm:px-6">
            Picked up where you left off
          </div>
        )}

        <form onSubmit={submit} onKeyDown={onKeyDown}>
          {/* Honeypot */}
          <input
            type="text" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true"
            value={data.website} onChange={(e) => set('website', e.target.value)}
            className="hidden"
          />

          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div key={step} custom={dir} variants={variants} initial="enter" animate="center" exit="exit">

              {/* ---------- STEP 1 — trade ---------- */}
              {step === 1 && (
                <div>
                  <div className="px-4 pt-7 sm:px-6">
                    <StepHeading
                      n="QUESTION 01"
                      title="What kind of work do you do?"
                      sub="We only take contractors, so this tells us straight away whether we can help you."
                    />
                  </div>
                  <div className="grid border-t border-paperEdge sm:grid-cols-2">
                    {TRADES.map((t, i) => (
                      <ChoiceRow
                        key={t}
                        idx={letter(i)}
                        label={t}
                        selected={data.trade === t}
                        rightCol={i % 2 === 1}
                        lastInCol={i >= TRADES.length - 2}
                        onClick={() => {
                          set('trade', t);
                          if (t !== 'Other trade') autoAdvance(1);
                        }}
                      />
                    ))}
                  </div>
                  {data.trade === 'Other trade' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className="overflow-hidden border-t border-paperEdge bg-paper2"
                    >
                      <div className="px-4 py-5 sm:px-6">
                        <TextField
                          label="Which trade" id="tradeOther" type="text" autoFocus
                          placeholder="Septic, drywall, garage doors…"
                          value={data.tradeOther} onChange={(e) => set('tradeOther', e.target.value)}
                        />
                      </div>
                    </motion.div>
                  )}
                  {errors.trade && (
                    <p className="border-t border-paperEdge px-4 py-3 font-archivo text-[13.5px] text-gRed sm:px-6">
                      {errors.trade}
                    </p>
                  )}
                </div>
              )}

              {/* ---------- STEP 2 — budget ---------- */}
              {step === 2 && (
                <div>
                  <div className="px-4 pt-7 sm:px-6">
                    <StepHeading
                      n="QUESTION 02"
                      title="What is your monthly marketing budget?"
                      sub="A ballpark is fine. It decides what we can honestly promise you, and nothing here is committed."
                    />
                  </div>
                  <div className="border-t border-paperEdge">
                    {BUDGETS.map((b, i) => (
                      <ChoiceRow
                        key={b.v}
                        idx={letter(i)}
                        label={b.v}
                        sub={b.sub}
                        rightCol
                        lastInCol={false}
                        selected={data.budget === b.v}
                        onClick={() => { set('budget', b.v); autoAdvance(2); }}
                      />
                    ))}
                  </div>
                  {errors.budget && (
                    <p className="px-4 py-3 font-archivo text-[13.5px] text-gRed sm:px-6">
                      {errors.budget}
                    </p>
                  )}
                </div>
              )}

              {/* ---------- STEP 3 — contact ---------- */}
              {step === 3 && (
                <div className="px-4 pt-7 sm:px-6">
                  <StepHeading
                    n="LAST STEP"
                    title="Where should we send the audit?"
                    sub="We build the audit first, then walk you through it on a short call. No sales script, no slide deck."
                  />

                  {(chosenTrade || data.budget) && (
                    <div className="mb-7 border-y border-paperEdge py-3">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                        <span className="font-plex text-[9.5px] uppercase tracking-[0.2em] text-inkd3">On file</span>
                        {[chosenTrade, data.budget].filter(Boolean).map((chip) => (
                          <span key={chip} className="font-archivo text-[13px] font-semibold text-inkd">
                            <span className="mr-1.5 text-brand">/</span>{chip}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                    <TextField
                      label="Your name" hint="Required" id="name" type="text" autoFocus
                      autoComplete="name" placeholder="John Smith" error={errors.name}
                      value={data.name} onChange={(e) => set('name', e.target.value)}
                    />
                    <TextField
                      label="Business name" id="business" type="text"
                      autoComplete="organization" placeholder="Smith Concrete Co."
                      value={data.business} onChange={(e) => set('business', e.target.value)}
                    />
                    <TextField
                      label="Email" hint="Required" id="email" type="email" inputMode="email"
                      autoComplete="email" placeholder="you@yourcompany.com" error={errors.email}
                      value={data.email} onChange={(e) => set('email', e.target.value)}
                    />
                    <TextField
                      label="Mobile" hint="Required" id="phone" type="tel" inputMode="tel"
                      autoComplete="tel" placeholder="(555) 123-4567" error={errors.phone}
                      value={data.phone} onChange={(e) => set('phone', formatPhone(e.target.value))}
                    />
                    <TextField
                      label="City / service area" hint="Required" id="city" type="text"
                      autoComplete="address-level2" placeholder="Hamilton, ON" error={errors.city}
                      value={data.city} onChange={(e) => set('city', e.target.value)}
                    />
                    <TextField
                      label="Current website" hint="Optional" id="siteUrl" type="text" inputMode="url"
                      autoComplete="url" placeholder="yourcompany.ca"
                      value={data.siteUrl} onChange={(e) => set('siteUrl', e.target.value)}
                    />
                  </div>

                  {status.state === 'error' && (
                    <div className="mt-6 border-l-[3px] border-gRed bg-gRed/5 px-4 py-3 font-archivo text-[13.5px] text-inkd">
                      {status.error}{' '}
                      <a href={PHONE_HREF} className="font-semibold underline decoration-brand decoration-2 underline-offset-2">
                        {PHONE_DISPLAY}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* ---------- Action bar ---------- */}
          <div className="mt-8 flex items-center justify-between gap-4 border-t border-inkd px-4 py-4 sm:px-6">
            <button
              type="button" onClick={back} disabled={step === 1}
              className="inline-flex items-center gap-1.5 font-plex text-[11px] font-semibold uppercase tracking-[0.14em] text-inkd3 transition-colors hover:text-inkd disabled:pointer-events-none disabled:opacity-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>

            {step < TOTAL_STEPS ? (
              <button
                type="button" onClick={next}
                className="group inline-flex items-center gap-2.5 bg-inkd px-7 py-3.5 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-brand"
              >
                Continue
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <button
                type="submit" disabled={status.state === 'sending'}
                className="group inline-flex items-center gap-2.5 bg-brand px-7 py-3.5 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-brandpress disabled:opacity-60"
              >
                {status.state === 'sending' ? 'Sending' : 'Submit application'}
                {status.state !== 'sending' && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                )}
              </button>
            )}
          </div>
        </form>
      </div>

      <p className="mt-3 max-w-xl font-archivo text-[13px] leading-relaxed text-inkd3">
        {step < TOTAL_STEPS
          ? 'No card, no commitment. Contact details are only asked on the last step.'
          : 'By submitting you agree we may contact you about your audit. We never sell or share your information.'}
      </p>
    </div>
  );
}

/* ============================================================
   PAGE FURNITURE
   ============================================================ */
function Masthead() {
  return (
    <header className="sticky top-0 z-40 border-b border-inkd bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-8">
        <a href="/" className="flex items-center gap-4" aria-label="Trade Leads Marketing, home">
          <img src="/tlm-mark.png" alt="Trade Leads Marketing" className="h-14 w-14 object-contain md:h-16 md:w-16" />
          <span className="hidden h-10 w-px bg-paperEdge sm:block" />
          <span className="hidden leading-tight sm:block">
            <span className="block font-archivo text-[15px] font-extrabold uppercase tracking-[0.06em] text-inkd">
              Trade Leads Marketing
            </span>
            <span className="block font-archivo text-[12.5px] text-inkd3">
              Lead generation for trades
            </span>
          </span>
        </a>

        <a href={PHONE_HREF} className="group flex items-center gap-2.5 border border-inkd px-4 py-2.5 transition-colors hover:bg-inkd">
          <Phone className="h-4 w-4 text-brand" />
          <span className="hidden font-plex text-[12px] font-semibold tabular-nums text-inkd transition-colors group-hover:text-paper sm:block">
            {PHONE_DISPLAY}
          </span>
          <span className="font-plex text-[12px] font-semibold uppercase tracking-[0.1em] text-inkd transition-colors group-hover:text-paper sm:hidden">
            Call
          </span>
        </a>
      </div>
    </header>
  );
}

function Hero() {
  const specs = [
    ['01', 'Three questions', 'About thirty seconds'],
    ['02', 'A free audit', 'Yours to keep either way'],
    ['03', 'Contractors only', 'No agencies, no e-commerce']
  ];
  return (
    <section className="grain relative overflow-hidden border-b border-inkd bg-inkd text-paper">
      <div className="relative mx-auto max-w-6xl px-5 pb-28 pt-14 md:px-8 md:pb-36 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-4">
              <span className="font-plex text-[10.5px] font-semibold uppercase tracking-[0.3em] text-brand">
                2026 Intake
              </span>
              <span className="rule-in h-px w-24 bg-paper/25" />
            </div>

            <h1 className="mt-6 font-archivo text-[2.9rem] font-extrabold leading-[0.96] tracking-[-0.03em] sm:text-6xl md:text-[4.4rem]">
              Apply for your
              <br />
              free contractor
              <br />
              <span className="text-brand">marketing audit</span>
            </h1>

            <p className="mt-7 max-w-xl font-archivo text-[17.5px] leading-[1.7] text-paper/75">
              Three questions, about thirty seconds. If you are a fit, we pull apart your website, your
              Google Business Profile and your ad spend, then walk you through every leak on a
              fifteen-minute call.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
              <a
                href="#apply-form"
                className="group inline-flex items-center gap-2.5 bg-brand px-8 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-paper hover:text-inkd"
              >
                Start application
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href={PHONE_HREF}
                className="inline-flex items-center gap-2.5 border border-paper/25 px-8 py-4 font-plex text-[13px] font-semibold tabular-nums text-paper transition-colors hover:border-paper"
              >
                <Phone className="h-4 w-4 text-brand" /> {PHONE_DISPLAY}
              </a>
            </div>
          </div>

          {/* Spec column — hairline rows, not cards */}
          <dl className="lg:col-span-5 lg:border-l lg:border-paper/15 lg:pl-12">
            {specs.map(([n, term, desc], i) => (
              <div
                key={n}
                className={`flex gap-5 border-t border-paper/15 py-5 ${i === 0 ? 'lg:border-t-0 lg:pt-0' : ''}`}
              >
                <span className="font-plex text-[11px] font-semibold text-brand">{n}</span>
                <div>
                  <dt className="font-archivo text-[17px] font-bold leading-tight">{term}</dt>
                  <dd className="mt-1 font-archivo text-[14.5px] text-paper/55">{desc}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-brand" />
    </section>
  );
}

function SpecRail() {
  const receives = [
    'Every keyword and click your ads are wasting money on',
    'Why your Google Business Profile is losing the map pack',
    'The exact points where your website drops a ready-to-buy homeowner',
    'What a realistic cost per lead looks like in your city'
  ];
  return (
    <aside className="space-y-9 lg:sticky lg:top-28">
      {/* What you receive */}
      <section>
        <div className="flex items-center gap-3">
          <h2 className="font-plex text-[10px] font-semibold uppercase tracking-[0.24em] text-inkd2">
            What you receive
          </h2>
          <span className="h-px flex-1 bg-paperEdge" />
        </div>

        <AuditSheet className="mt-4 w-full" />

        <ol className="mt-5">
          {receives.map((r, i) => (
            <li key={r} className="flex gap-4 border-t border-paperEdge py-3 last:border-b">
              <span className="font-plex text-[10px] font-semibold tabular-nums text-brand">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-archivo text-[15px] leading-snug text-inkd2">{r}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Guarantee — set as a stamped block */}
      <section className="border border-inkd bg-inkd text-paper">
        <div className="h-[3px] bg-brand" />
        <div className="px-5 py-6">
          <div className="font-plex text-[9.5px] font-semibold uppercase tracking-[0.28em] text-brand">
            The guarantee
          </div>
          <p className="mt-3 font-archivo text-[22px] font-extrabold leading-[1.1] tracking-[-0.02em]">
            Three qualified bookings in thirty days, or you do not pay.
          </p>
          <dl className="mt-5 border-t border-paper/15">
            {[
              ['Term', 'Month to month'],
              ['Tracking', 'Installed before a dollar is spent'],
              ['Qualified', 'You set the definition']
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-paper/15 py-2.5">
                <dt className="font-archivo text-[13.5px] text-paper/50">{k}</dt>
                <dd className="text-right font-archivo text-[13.5px] font-semibold text-paper/90">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 font-archivo text-[13px] leading-relaxed text-paper/50">
            Full terms are set out in your service agreement.
          </p>
        </div>
      </section>

    </aside>
  );
}

/* Quote and direct line sit full width below the two columns, so the short
   form step does not leave a canyon of empty paper beside a tall rail. */
function ContactBand() {
  return (
    <section className="mx-auto mt-16 max-w-6xl px-5 md:mt-20 md:px-8">
      <div className="grid border-t border-inkd md:grid-cols-[1fr_auto]">
        <figure className="py-8 md:pr-12">
          <blockquote className="max-w-2xl border-l-[3px] border-brand pl-5 font-archivo text-[18px] leading-[1.6] text-inkd sm:text-[20px]">
            Trade Leads Marketing rebuilt our landing page, cleaned up our Google Business Profile, and our
            quote requests jumped within weeks. We can finally see exactly which jobs came from which campaign.
          </blockquote>
          <figcaption className="mt-4 pl-5 font-archivo text-[14px] text-inkd3">
            John Scime
            {' · '}
            <a href="https://sevenstoneslandscape.ca" target="_blank" rel="noreferrer" className="text-inkd underline decoration-brand decoration-2 underline-offset-2">
              Seven Stones Landscape
            </a>
          </figcaption>
        </figure>

        <div className="border-t border-paperEdge py-8 md:border-l md:border-t-0 md:border-paperEdge md:pl-12">
          <div className="font-plex text-[9.5px] font-semibold uppercase tracking-[0.24em] text-inkd3">
            Rather skip the form
          </div>
          <a href={PHONE_HREF} className="mt-2 block font-archivo text-[30px] font-extrabold tracking-[-0.02em] text-inkd transition-colors hover:text-brand">
            {PHONE_DISPLAY}
          </a>
          <a href={`mailto:${EMAIL}`} className="mt-1.5 block break-all font-archivo text-[15px] text-inkd2 underline decoration-paperEdge underline-offset-2 transition-colors hover:decoration-brand">
            {EMAIL}
          </a>
          <p className="mt-2 font-archivo text-[13.5px] text-inkd3">
            Same-day reply during business hours.
          </p>
        </div>
      </div>
    </section>
  );
}

function Process() {
  const steps = [
    ['01', 'You apply', 'Three questions, about half a minute. A person reads every one of them.'],
    ['02', 'We build the audit', 'Within one business day we go through your site, your Google Business Profile, your ads and the competitors beating you in the map pack.'],
    ['03', 'We walk you through it', 'Fifteen minutes on the phone. You keep the audit whether or not you ever hire us.']
  ];
  return (
    <section className="border-t border-inkd bg-paper2">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="flex items-baseline gap-4">
          <h2 className="font-archivo text-[28px] font-extrabold tracking-[-0.02em] text-inkd sm:text-[34px]">
            What happens after you hit submit
          </h2>
          <span className="hidden h-px flex-1 bg-paperEdge sm:block" />
        </div>
        <p className="mt-3 max-w-xl font-archivo text-[16.5px] leading-[1.65] text-inkd2">
          No drip campaign, and no account executive chasing you for a month.
        </p>

        <div className="mt-12 grid border-t border-inkd md:grid-cols-3">
          {steps.map(([n, title, body], i) => (
            <div
              key={n}
              className={`border-t border-inkd py-7 md:py-0 md:pt-8 ${i === 0 ? 'md:pr-8' : 'md:border-l md:px-8'}`}
            >
              <div className="font-archivo text-[44px] font-extrabold leading-none tracking-[-0.04em] text-paperEdge">
                {n}
              </div>
              <h3 className="mt-4 font-archivo text-[19px] font-bold text-inkd">{title}</h3>
              <p className="mt-2.5 max-w-xs font-archivo text-[15.5px] leading-[1.65] text-inkd2">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingBand() {
  return (
    <section className="grain relative overflow-hidden border-t border-inkd bg-inkd text-paper">
      <div className="relative mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="max-w-xl font-archivo text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[42px]">
              Half a minute now.
              <br />
              <span className="text-brand">Could change your season.</span>
            </h2>
            <p className="mt-4 max-w-md font-archivo text-[16.5px] leading-[1.65] text-paper/70">
              Worst case, you walk away with a free audit showing exactly where your marketing leaks money.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">
            <a
              href="#apply-form"
              className="group inline-flex items-center justify-center gap-2.5 bg-brand px-8 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-paper hover:text-inkd"
            >
              Start application
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href={PHONE_HREF}
              className="inline-flex items-center justify-center gap-2.5 border border-paper/25 px-8 py-4 font-plex text-[13px] font-semibold tabular-nums text-paper transition-colors hover:border-paper"
            >
              <Phone className="h-4 w-4 text-brand" /> {PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Colophon() {
  return (
    <footer className="border-t border-paper/15 bg-inkd text-paper">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <a href="/" className="flex items-center gap-4">
            <img src="/tlm-mark.png" alt="" className="h-12 w-12 object-contain" />
            <span className="leading-tight">
              <span className="block font-archivo text-[13px] font-extrabold uppercase tracking-[0.06em]">
                Trade Leads Marketing
              </span>
              <span className="block font-plex text-[9.5px] uppercase tracking-[0.2em] text-paper/40">
                tradeleadsmarketing.com
              </span>
            </span>
          </a>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 font-plex text-[11px] uppercase tracking-[0.12em]">
            <a href={PHONE_HREF} className="tabular-nums text-paper/75 transition-colors hover:text-brand">{PHONE_DISPLAY}</a>
            <a href={`mailto:${EMAIL}`} className="text-paper/75 transition-colors hover:text-brand">Email</a>
            <a href="/" className="text-paper/75 transition-colors hover:text-brand">Main site</a>
          </nav>
        </div>

        <p className="mt-9 max-w-4xl border-t border-paper/15 pt-6 font-archivo text-[12.5px] leading-[1.7] text-paper/50">
          <span className="font-semibold text-paper/70">Disclaimer.</span> Except where an explicit written guarantee applies (such as our 30-day guarantee, which is
          subject to its own qualifying terms and the definition of a qualified booking agreed in your service
          agreement), Trade Leads Marketing does not guarantee specific lead volume, ranking position, or revenue
          outcomes. Google, Google Ads, and Google Business Profile are trademarks of Google LLC, used
          descriptively; Trade Leads Marketing is not affiliated with or endorsed by Google.
        </p>
        <p className="mt-4 font-archivo text-[12.5px] text-paper/50">
          © {new Date().getFullYear()} Trade Leads Marketing
        </p>
      </div>
    </footer>
  );
}

function CallBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-inkd bg-paper px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] lg:hidden">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-archivo text-[12px] text-inkd3">Rather just talk?</div>
          <div className="truncate font-plex text-[14px] font-semibold tabular-nums text-inkd">{PHONE_DISPLAY}</div>
        </div>
        <a href={PHONE_HREF} className="shrink-0 bg-brand px-5 py-3 font-archivo text-[13px] font-bold uppercase tracking-[0.1em] text-paper">
          Call now
        </a>
      </div>
    </div>
  );
}

/* ============================================================
   PAGE
   ============================================================ */
export default function Apply() {
  return (
    <div className="min-h-screen bg-paper pb-20 font-archivo text-inkd antialiased lg:pb-0">
      <PageStyle />
      <Masthead />
      <main>
        <Hero />

        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
            {/* Only the form overlaps the hero. The rail must start below it,
                or its ink-coloured heading lands on the dark band and vanishes. */}
            <div className="relative z-10 -mt-20 md:-mt-24 lg:col-span-7 xl:col-span-8">
              <Funnel />
            </div>
            <div className="lg:col-span-5 xl:col-span-4 lg:pt-10">
              <SpecRail />
            </div>
          </div>
        </div>

        <ContactBand />

        <Process />
        <ClosingBand />
      </main>
      <Colophon />
      <CallBar />
    </div>
  );
}
