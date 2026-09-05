import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, Check, CheckCircle2, XCircle, Phone, Mail, Clock,
  ShieldCheck, Star, Users, MapPin, Globe, Lock, Loader2, Send, Sparkles,
  HardHat, Hammer, Wrench, PaintRoller, Home, Truck, Flame, Droplets, Zap,
  TreePine, Layers, Construction, Wallet, Timer, Target, TrendingUp,
  BarChart3, Search, Eye, ClipboardList, PhoneCall, AlertCircle
} from 'lucide-react';

/* ============================================================
   TRADE LEADS MARKETING — /apply
   A 5-step application funnel. One question per screen, big tap
   targets, progress saved locally, then a POST to /api/lead and
   a redirect to /thank-you.
   ============================================================ */

const PHONE_DISPLAY = '(289) 489-1167';
const PHONE_HREF    = 'tel:+12894891167';
const EMAIL         = 'info@tradeleadsmarketing.com';
const STORAGE_KEY   = 'tlm_apply_draft_v1';
const TOTAL_STEPS   = 5;

const EMPTY = {
  trade: '', tradeOther: '',
  city: '', team: '',
  bottlenecks: [],
  budget: '', timeline: '',
  name: '', business: '', email: '', phone: '', siteUrl: '', notes: '',
  website: '' // honeypot — must stay empty
};

const TRADES = [
  { v: 'Concrete',             icon: Layers },
  { v: 'Roofing',              icon: Home },
  { v: 'Landscaping',          icon: TreePine },
  { v: 'HVAC',                 icon: Flame },
  { v: 'Plumbing',             icon: Droplets },
  { v: 'Electrical',           icon: Zap },
  { v: 'Renovation / Builder', icon: Hammer },
  { v: 'Paving / Excavation',  icon: Truck },
  { v: 'Painting',             icon: PaintRoller },
  { v: 'Fencing / Decking',    icon: Construction },
  { v: 'Restoration',          icon: Wrench },
  { v: 'Other trade',          icon: HardHat }
];

const TEAM = [
  { v: 'Just me', sub: 'Owner-operator' },
  { v: '2 – 5',   sub: 'Small crew' },
  { v: '6 – 15',  sub: 'Multiple crews' },
  { v: '16+',     sub: 'Full operation' }
];

const BOTTLENECKS = [
  { v: 'Not enough leads coming in',            icon: Search },
  { v: 'Leads are tire-kickers / low ball',     icon: Target },
  { v: 'Wasting money on ads',                  icon: Wallet },
  { v: 'Website looks dated or converts badly', icon: Globe },
  { v: 'Not showing up on Google Maps',         icon: MapPin },
  { v: 'Busy summers, dead winters',            icon: TrendingUp },
  { v: 'No idea what my marketing is doing',    icon: BarChart3 },
  { v: 'Just parted ways with an agency',       icon: Eye }
];

const BUDGETS = [
  { v: 'Under $1,000 / mo',      sub: 'Getting started' },
  { v: '$1,000 – $2,500 / mo',   sub: 'Most common' },
  { v: '$2,500 – $5,000 / mo',   sub: 'Growth mode' },
  { v: '$5,000 – $10,000 / mo',  sub: 'Multi-service' },
  { v: '$10,000+ / mo',          sub: 'Scaling hard' },
  { v: 'Not sure yet',           sub: "We'll help you size it" }
];

const TIMELINES = [
  { v: 'As soon as possible', sub: 'Ready to move now' },
  { v: 'Within 30 days',      sub: 'Planning ahead' },
  { v: 'Next quarter',        sub: 'Getting organized' },
  { v: 'Just researching',    sub: 'No pressure' }
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

/* ---------- The audit deliverable, drawn rather than described ---------- */
function AuditPreview({ className = '' }) {
  const rows = [
    { label: 'Google Ads waste',        score: 34, tone: '#EA4335' },
    { label: 'Google Business Profile', score: 52, tone: '#FBBC05' },
    { label: 'Website conversion',      score: 41, tone: '#EA4335' },
    { label: 'Local SEO coverage',      score: 68, tone: '#34A853' }
  ];
  return (
    <svg viewBox="0 0 320 210" className={className} role="img" aria-label="Example of the free marketing audit report you receive">
      <defs>
        <linearGradient id="ap-sheet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F8FAFC" />
        </linearGradient>
      </defs>

      {/* Sheet */}
      <rect x="8" y="8" width="304" height="194" rx="10" fill="url(#ap-sheet)" stroke="#E2E8F0" />
      <rect x="8" y="8" width="304" height="34" rx="10" fill="#0A1B3D" />
      <rect x="8" y="32" width="304" height="10" fill="#0A1B3D" />
      <circle cx="26" cy="25" r="5" fill="#F37021" />
      <text x="38" y="29" fill="#FFFFFF" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="800" letterSpacing="0.6">
        YOUR FREE MARKETING AUDIT
      </text>

      {/* Overall score dial */}
      <g transform="translate(30,56)">
        <circle cx="30" cy="30" r="25" fill="none" stroke="#E2E8F0" strokeWidth="7" />
        <circle
          cx="30" cy="30" r="25" fill="none" stroke="#F37021" strokeWidth="7" strokeLinecap="round"
          strokeDasharray="157" strokeDashoffset="88" transform="rotate(-90 30 30)"
        />
        <text x="30" y="36" textAnchor="middle" fontFamily="'Plus Jakarta Sans', sans-serif" fontSize="19" fontWeight="800" fill="#0F172A">44</text>
      </g>
      <text x="100" y="72" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="700" fill="#0F172A">Lead-readiness score</text>
      <text x="100" y="86" fontFamily="Inter, sans-serif" fontSize="8.5" fill="#64748B">Scored against 40+ checks</text>
      <rect x="100" y="94" width="92" height="16" rx="8" fill="#FEF2F2" stroke="#FCA5A5" />
      <text x="110" y="105" fontFamily="Inter, sans-serif" fontSize="8" fontWeight="700" fill="#EA4335">6 leaks found</text>

      {/* Scored rows */}
      <g>
        {rows.map((r, i) => {
          const y = 130 + i * 18;
          return (
            <g key={r.label}>
              <text x="24" y={y + 4} fontFamily="Inter, sans-serif" fontSize="8.5" fill="#475569">{r.label}</text>
              <rect x="176" y={y - 2} width="120" height="6" rx="3" fill="#E2E8F0" />
              <rect x="176" y={y - 2} width={120 * (r.score / 100)} height="6" rx="3" fill={r.tone} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ---------- Guarantee stamp (same mark as the main site) ---------- */
function GuaranteeStamp({ className = '' }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="30-day guarantee: 3 bookings or you don't pay">
      <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="100" cy="100" r="83" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <text x="100" y="56" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="8.5" fontWeight="700" letterSpacing="2.5" fill="currentColor">OR YOU DON'T PAY</text>
      <line x1="66" y1="66" x2="134" y2="66" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <text x="100" y="118" textAnchor="middle" fontFamily="'Plus Jakarta Sans', sans-serif" fontSize="60" fontWeight="800" fill="currentColor">3</text>
      <text x="100" y="138" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="13" fontWeight="700" letterSpacing="4" fill="currentColor">BOOKINGS</text>
      <line x1="66" y1="150" x2="134" y2="150" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <text x="100" y="166" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="8.5" fontWeight="700" letterSpacing="2" fill="currentColor">30-DAY GUARANTEE</text>
    </svg>
  );
}

/* ---------- Reusable controls ---------- */
function OptionCard({ selected, onClick, icon: Icon, label, sub, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative w-full text-left rounded-xl border-2 transition-all duration-150 outline-none
        focus-visible:ring-4 focus-visible:ring-blue/15
        ${compact ? 'px-4 py-3.5' : 'px-4 py-4'}
        ${selected
          ? 'border-blue bg-bluesoft shadow-[0_0_0_4px_rgba(30,85,199,0.08)]'
          : 'border-line bg-white hover:border-blue/50 hover:bg-soft active:scale-[0.99]'}`}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <span className={`shrink-0 h-10 w-10 rounded-lg flex items-center justify-center transition-colors
            ${selected ? 'bg-blue text-white' : 'bg-soft text-slate1 group-hover:text-blue'}`}>
            <Icon className="h-5 w-5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold leading-snug ${selected ? 'text-blue' : 'text-ink'}`}>{label}</span>
          {sub && <span className="block text-xs text-slate2 mt-0.5">{sub}</span>}
        </span>
        <span className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all
          ${selected ? 'border-blue bg-blue' : 'border-line group-hover:border-blue/40'}`}>
          {selected && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
        </span>
      </div>
    </button>
  );
}

function Field({ label, hint, htmlFor, error, children }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-bold text-ink uppercase tracking-wider">{label}</span>
        {hint && <span className="text-[11px] text-slate3 font-medium">{hint}</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {error && (
        <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-gRed">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </span>
      )}
    </label>
  );
}

function StepHead({ eyebrow, title, sub }) {
  return (
    <div className="mb-6">
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand">{eyebrow}</div>
      <h2 className="h-display text-2xl md:text-[2rem] text-ink mt-2">{title}</h2>
      {sub && <p className="mt-2 text-slate1 leading-relaxed">{sub}</p>}
    </div>
  );
}

function InlineError({ children }) {
  return (
    <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-gRed">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {children}
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
  }, []);

  /* Persist as they go */
  useEffect(() => {
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

  const toggleBottleneck = (v) => {
    setData((d) => {
      const has = d.bottlenecks.includes(v);
      return { ...d, bottlenecks: has ? d.bottlenecks.filter((x) => x !== v) : [...d.bottlenecks, v] };
    });
    setErrors((e) => (e.bottlenecks ? { ...e, bottlenecks: null } : e));
  };

  const scrollToCard = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 92;
    if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'smooth' });
  }, []);

  const validate = (s) => {
    const e = {};
    if (s === 1 && !data.trade) e.trade = 'Pick the trade that fits best.';
    if (s === 2) {
      if (data.city.trim().length < 2) e.city = 'Where do you work? City and province or state is enough.';
      if (!data.team) e.team = 'Pick a crew size.';
    }
    if (s === 3 && data.bottlenecks.length === 0) e.bottlenecks = 'Pick at least one. Choose as many as you like.';
    if (s === 4) {
      if (!data.budget)   e.budget = 'Pick a range. A ballpark is fine.';
      if (!data.timeline) e.timeline = 'When would you want to start?';
    }
    if (s === 5) {
      if (data.name.trim().length < 2) e.name = 'Your name, please.';
      if (!isEmail(data.email))        e.email = 'That email does not look right.';
      if (!isPhone(data.phone))        e.phone = 'A 10-digit number so we can call you.';
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

  /* Single-select steps move forward on their own — one tap, no hunting for a button */
  const autoAdvance = (fromStep) => {
    clearTimeout(advanceT.current);
    advanceT.current = setTimeout(() => {
      setDir(1);
      setStep((s) => (s === fromStep && s < TOTAL_STEPS ? s + 1 : s));
      scrollToCard();
    }, 280);
  };

  const submit = async (ev) => {
    ev?.preventDefault?.();
    if (data.website) return; // honeypot tripped
    const e = validate(5);
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
      message: data.notes,
      // application-specific
      source: 'apply',
      trade,
      team: data.team,
      bottlenecks: data.bottlenecks.join(' · '),
      budget: data.budget,
      timeline: data.timeline,
      siteUrl: data.siteUrl,
      website: '' // honeypot
    };

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Something went wrong on our end. Call or text us and we'll take it from there:");
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

  const pct = Math.round(((step - 1) / TOTAL_STEPS) * 100);

  const variants = {
    enter:  (d) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
    exit:   (d) => ({ opacity: 0, x: d > 0 ? -40 : 40, transition: { duration: 0.18 } })
  };

  return (
    <div ref={cardRef} id="apply-form" className="scroll-mt-24">
      <div className="rounded-2xl border border-line bg-white shadow-lifted overflow-hidden">
        {/* Progress */}
        <div className="px-6 md:px-9 pt-6 md:pt-7">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-bold uppercase tracking-[0.18em] text-slate2">
              Step {step} <span className="text-slate3">of {TOTAL_STEPS}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate2">
              <Clock className="h-3.5 w-3.5 text-blue" /> About 60 seconds
            </span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-soft overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue to-brand"
              initial={false}
              animate={{ width: `${Math.max(pct, 6)}%` }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          {restored && step > 1 && status.state === 'idle' && (
            <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-slate2">
              <CheckCircle2 className="h-3.5 w-3.5 text-gGreen" /> We saved where you left off.
            </div>
          )}
        </div>

        <form onSubmit={submit} onKeyDown={onKeyDown} className="px-6 md:px-9 pb-7 md:pb-9 pt-6">
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
                <>
                  <StepHead
                    eyebrow="Question 1"
                    title="What kind of work do you do?"
                    sub="We only take on contractors, so this tells us right away whether we can help."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {TRADES.map((t) => (
                      <OptionCard
                        key={t.v}
                        icon={t.icon}
                        label={t.v}
                        selected={data.trade === t.v}
                        onClick={() => {
                          set('trade', t.v);
                          if (t.v !== 'Other trade') autoAdvance(1);
                        }}
                      />
                    ))}
                  </div>
                  {data.trade === 'Other trade' && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                      <Field label="What trade is it?" htmlFor="tradeOther">
                        <input
                          id="tradeOther" type="text" autoFocus className="form-input"
                          placeholder="e.g. Septic, drywall, garage doors…"
                          value={data.tradeOther} onChange={(e) => set('tradeOther', e.target.value)}
                        />
                      </Field>
                    </motion.div>
                  )}
                  {errors.trade && <InlineError>{errors.trade}</InlineError>}
                </>
              )}

              {/* ---------- STEP 2 — where + crew ---------- */}
              {step === 2 && (
                <>
                  <StepHead
                    eyebrow="Question 2"
                    title="Where do you work, and how big is the crew?"
                    sub="Your service area decides what a realistic lead volume actually looks like."
                  />
                  <Field label="City / service area" hint="Required" htmlFor="city" error={errors.city}>
                    <input
                      id="city" type="text" autoFocus className="form-input text-lg"
                      placeholder="e.g. Hamilton, ON or Austin, TX"
                      autoComplete="address-level2"
                      value={data.city} onChange={(e) => set('city', e.target.value)}
                    />
                  </Field>
                  <div className="mt-6">
                    <div className="text-xs font-bold text-ink uppercase tracking-wider mb-2.5">How many people on the tools?</div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {TEAM.map((t) => (
                        <OptionCard
                          key={t.v} label={t.v} sub={t.sub} compact
                          selected={data.team === t.v}
                          onClick={() => {
                            set('team', t.v);
                            if (data.city.trim().length >= 2) autoAdvance(2);
                          }}
                        />
                      ))}
                    </div>
                    {errors.team && <InlineError>{errors.team}</InlineError>}
                  </div>
                </>
              )}

              {/* ---------- STEP 3 — bottlenecks ---------- */}
              {step === 3 && (
                <>
                  <StepHead
                    eyebrow="Question 3"
                    title="What's actually holding you back?"
                    sub="Pick everything that sounds like your last six months. This is the part we dig into on the audit."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {BOTTLENECKS.map((b) => (
                      <OptionCard
                        key={b.v} icon={b.icon} label={b.v}
                        selected={data.bottlenecks.includes(b.v)}
                        onClick={() => toggleBottleneck(b.v)}
                      />
                    ))}
                  </div>
                  {errors.bottlenecks && <InlineError>{errors.bottlenecks}</InlineError>}
                  {data.bottlenecks.length > 0 && (
                    <div className="mt-4 text-xs font-medium text-slate2">
                      {data.bottlenecks.length} selected — pick as many as apply.
                    </div>
                  )}
                </>
              )}

              {/* ---------- STEP 4 — budget + timing ---------- */}
              {step === 4 && (
                <>
                  <StepHead
                    eyebrow="Question 4"
                    title="Budget and timing"
                    sub="Straight answers here save us both a call. Nothing is locked in — you are not committing to a number."
                  />
                  <div className="text-xs font-bold text-ink uppercase tracking-wider mb-2.5">
                    Monthly marketing budget you're comfortable with
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {BUDGETS.map((b) => (
                      <OptionCard
                        key={b.v} label={b.v} sub={b.sub} compact icon={Wallet}
                        selected={data.budget === b.v}
                        onClick={() => set('budget', b.v)}
                      />
                    ))}
                  </div>
                  {errors.budget && <InlineError>{errors.budget}</InlineError>}

                  <div className="mt-7">
                    <div className="text-xs font-bold text-ink uppercase tracking-wider mb-2.5">When would you want to start?</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {TIMELINES.map((t) => (
                        <OptionCard
                          key={t.v} label={t.v} sub={t.sub} compact icon={Timer}
                          selected={data.timeline === t.v}
                          onClick={() => {
                            set('timeline', t.v);
                            if (data.budget) autoAdvance(4);
                          }}
                        />
                      ))}
                    </div>
                    {errors.timeline && <InlineError>{errors.timeline}</InlineError>}
                  </div>
                </>
              )}

              {/* ---------- STEP 5 — contact ---------- */}
              {step === 5 && (
                <>
                  <StepHead
                    eyebrow="Last step"
                    title="Where should we send the audit?"
                    sub="We build the audit first, then walk you through it on a short call. No sales script, no slide deck."
                  />

                  {/* Recap — everything they already told us */}
                  <div className="mb-6 rounded-xl border border-line bg-soft p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate2 mb-2.5">Your answers</div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        data.trade === 'Other trade' && data.tradeOther.trim() ? data.tradeOther.trim() : data.trade,
                        data.city, data.team, data.budget, data.timeline,
                        data.bottlenecks.length ? `${data.bottlenecks.length} pain point${data.bottlenecks.length > 1 ? 's' : ''}` : ''
                      ].filter(Boolean).map((chip) => (
                        <span key={chip} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-slate1">
                          <Check className="h-3 w-3 text-gGreen" /> {chip}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Your name" hint="Required" htmlFor="name" error={errors.name}>
                      <input
                        id="name" type="text" autoFocus className="form-input" placeholder="John Smith"
                        autoComplete="name" value={data.name} onChange={(e) => set('name', e.target.value)}
                      />
                    </Field>
                    <Field label="Business name" htmlFor="business">
                      <input
                        id="business" type="text" className="form-input" placeholder="Smith Concrete Co."
                        autoComplete="organization" value={data.business} onChange={(e) => set('business', e.target.value)}
                      />
                    </Field>
                    <Field label="Email" hint="Required" htmlFor="email" error={errors.email}>
                      <input
                        id="email" type="email" inputMode="email" className="form-input" placeholder="you@yourcompany.com"
                        autoComplete="email" value={data.email} onChange={(e) => set('email', e.target.value)}
                      />
                    </Field>
                    <Field label="Mobile" hint="Required" htmlFor="phone" error={errors.phone}>
                      <input
                        id="phone" type="tel" inputMode="tel" className="form-input" placeholder="(555) 123-4567"
                        autoComplete="tel" value={data.phone}
                        onChange={(e) => set('phone', formatPhone(e.target.value))}
                      />
                    </Field>
                  </div>

                  <div className="mt-4">
                    <Field label="Current website" hint="Optional" htmlFor="siteUrl">
                      <input
                        id="siteUrl" type="text" inputMode="url" className="form-input"
                        placeholder="yourcompany.ca — or leave blank if you don't have one"
                        autoComplete="url" value={data.siteUrl} onChange={(e) => set('siteUrl', e.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="mt-4">
                    <Field label="Anything else we should know?" hint="Optional" htmlFor="notes">
                      <textarea
                        id="notes" rows="3" className="form-input resize-none"
                        placeholder="Best time to reach you, what you've already tried, the jobs you want more of…"
                        value={data.notes} onChange={(e) => set('notes', e.target.value)}
                      />
                    </Field>
                  </div>

                  {status.state === 'error' && (
                    <div className="mt-5 rounded-lg border border-gRed/30 bg-gRed/5 px-4 py-3 text-sm text-gRed flex items-start gap-2">
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        {status.error}{' '}
                        <a href={PHONE_HREF} className="font-bold underline">{PHONE_DISPLAY}</a>
                      </span>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* ---------- Nav ---------- */}
          <div className="mt-8 pt-6 border-t border-line flex items-center justify-between gap-3">
            <button
              type="button" onClick={back} disabled={step === 1}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate2 hover:text-ink disabled:opacity-0 disabled:pointer-events-none transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {step < TOTAL_STEPS ? (
              <button type="button" onClick={next} className="btn-primary text-base px-7 py-3.5">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit" disabled={status.state === 'sending'}
                className="btn-primary text-base px-7 py-3.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status.state === 'sending'
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                  : <>Submit my application <Send className="h-4 w-4" /></>}
              </button>
            )}
          </div>

          <div className="mt-4 flex items-start gap-2 text-[11px] text-slate2">
            <Lock className="h-3.5 w-3.5 text-slate3 shrink-0 mt-px" />
            <span>
              {step < TOTAL_STEPS
                ? 'No card, no commitment. We only ask for contact details on the last step.'
                : 'By submitting you agree we may contact you about your audit. We never sell or share your information.'}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   PAGE FURNITURE
   ============================================================ */
function ApplyHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-line">
      <div className="mx-auto max-w-6xl px-5 md:px-8 flex items-center justify-between py-3">
        <a href="/" className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-white border border-line flex items-center justify-center shadow-soft p-1">
            <img src="/tlmlogo.png" alt="" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-extrabold tracking-tight text-ink text-[15px]">Trade Leads</div>
            <div className="text-[9px] uppercase tracking-[0.25em] text-brand font-bold -mt-0.5">Marketing</div>
          </div>
        </a>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs font-semibold text-slate2">Prefer to talk?</span>
          <a href={PHONE_HREF} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-ink hover:border-blue/40 hover:text-blue transition-colors">
            <Phone className="h-4 w-4 text-brand" />
            <span className="hidden sm:inline">{PHONE_DISPLAY}</span>
            <span className="sm:hidden">Call</span>
          </a>
        </div>
      </div>
    </header>
  );
}

function HeroBand() {
  const points = [
    { icon: Clock,       t: '60 seconds',       s: '5 quick questions' },
    { icon: ShieldCheck, t: 'Free audit',       s: 'Yours to keep either way' },
    { icon: Users,       t: 'Contractors only', s: 'No agencies, no e-comm' }
  ];
  return (
    <section className="relative bg-navy text-white overflow-hidden">
      <div className="absolute inset-0 grid-bg-dark opacity-50" />
      <div className="absolute -top-32 left-1/4 h-[420px] w-[560px] rounded-full bg-blue/20 blur-[130px]" />
      <div className="absolute top-10 -right-20 h-[360px] w-[360px] rounded-full bg-brand/20 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-5 md:px-8 pt-14 md:pt-20 pb-32 md:pb-40 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="eyebrow-dark mx-auto"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
          Now accepting contractor applications
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.06 }}
          className="h-display text-[2.6rem] leading-[1.05] sm:text-5xl md:text-6xl mt-5 max-w-3xl mx-auto"
        >
          Apply for your free{' '}
          <span className="text-brand">contractor marketing audit</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.12 }}
          className="mt-5 text-base md:text-lg text-white/75 max-w-2xl mx-auto leading-relaxed"
        >
          Answer five quick questions. If you're a fit, we tear apart your website, Google Business Profile,
          and ad spend — then get on a 15-minute call and show you exactly where the leads are leaking.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.18 }}
          className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto"
        >
          {points.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.t} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur text-left">
                <Icon className="h-5 w-5 text-brand shrink-0" />
                <div className="leading-tight">
                  <div className="text-sm font-bold">{p.t}</div>
                  <div className="text-[11px] text-white/55">{p.s}</div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function ProofRail() {
  return (
    <div className="space-y-4 lg:sticky lg:top-24">
      {/* What you actually get */}
      <div className="rounded-2xl border border-line bg-white shadow-soft overflow-hidden">
        <div className="px-5 pt-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue">What you get, free</div>
          <div className="mt-1 font-display font-extrabold text-lg text-ink leading-snug">
            A real audit — not a sales deck
          </div>
        </div>
        <div className="px-5 pt-4">
          <AuditPreview className="w-full h-auto rounded-lg border border-line" />
        </div>
        <ul className="px-5 py-5 space-y-2.5">
          {[
            'Every keyword and click your ads are wasting money on',
            'Why your Google Business Profile is losing the map pack',
            'The exact spots your website drops a ready-to-buy homeowner',
            'What a realistic cost per lead looks like in your city'
          ].map((x) => (
            <li key={x} className="flex gap-2.5 text-sm text-slate1 leading-snug">
              <CheckCircle2 className="h-4 w-4 text-gGreen shrink-0 mt-0.5" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Guarantee */}
      <div className="rounded-2xl bg-[#0A0B0D] text-white overflow-hidden">
        <div className="h-[3px] w-full bg-brand" />
        <div className="p-5 flex items-center gap-4">
          <GuaranteeStamp className="h-24 w-24 shrink-0 text-brand -rotate-6" />
          <div>
            <div className="font-mono text-[10px] tracking-[0.28em] text-brand uppercase">Our guarantee</div>
            <div className="mt-1.5 font-display font-extrabold text-lg leading-tight">
              3 qualified bookings in 30 days, or you don't pay.
            </div>
            <div className="mt-2 text-[11px] text-white/45 leading-relaxed">
              Month to month. You approve what counts as qualified. Full terms in your service agreement.
            </div>
          </div>
        </div>
      </div>

      {/* One testimonial, doing the heavy lifting */}
      <div className="rounded-2xl border border-line bg-white shadow-soft p-5">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((i) => <Star key={i} className="h-4 w-4 fill-gReview text-gReview" />)}
        </div>
        <p className="mt-3 text-sm text-ink leading-relaxed">
          "Trade Leads Marketing rebuilt our landing page, cleaned up our Google Business Profile, and our
          quote requests jumped within weeks. We can finally see exactly which jobs came from which campaign."
        </p>
        <div className="mt-4 pt-4 border-t border-line flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue flex items-center justify-center text-white font-extrabold text-sm">JS</div>
          <div>
            <div className="text-sm font-bold text-ink">John Scime</div>
            <a href="https://sevenstoneslandscape.ca" target="_blank" rel="noreferrer" className="text-[11px] text-blue hover:underline flex items-center gap-1 font-medium">
              <Globe className="h-3 w-3" /> Seven Stones Landscape
            </a>
          </div>
        </div>
      </div>

      {/* Talk to a human */}
      <div className="rounded-2xl border border-line bg-soft p-5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate2">
          <PhoneCall className="h-4 w-4 text-brand" /> Rather skip the form?
        </div>
        <a href={PHONE_HREF} className="mt-2 block font-display font-extrabold text-xl text-ink hover:text-blue transition-colors">
          {PHONE_DISPLAY}
        </a>
        <a href={`mailto:${EMAIL}`} className="mt-1 block text-sm text-slate1 hover:text-blue transition-colors break-all">
          {EMAIL}
        </a>
        <div className="mt-2 text-[11px] text-slate2">Same-day reply during business hours.</div>
      </div>
    </div>
  );
}

function WhatHappensNext() {
  const steps = [
    { n: '01', icon: Send,          t: 'You apply',              d: 'Five questions, about a minute. A person reads every one.' },
    { n: '02', icon: ClipboardList, t: 'We build your audit',    d: 'Within one business day we go through your site, your Google Business Profile, your ads, and your competitors.' },
    { n: '03', icon: PhoneCall,     t: 'We walk you through it', d: 'A 15-minute call. You keep the audit whether or not you ever hire us. No pitch deck, no pressure.' }
  ];
  return (
    <section className="bg-soft border-y border-line py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="eyebrow-light">After you hit submit</span>
          <h2 className="h-display text-3xl md:text-4xl text-ink mt-4">
            Here's exactly what happens next
          </h2>
          <p className="mt-4 text-slate1">No mystery, no drip campaign, no account executive chasing you for a month.</p>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              // Deliberately not scroll-animated: a conversion page must never
              // risk showing an empty section if the observer does not fire.
              <div
                key={s.n}
                className="relative rounded-2xl border border-line bg-white p-6 shadow-soft"
              >
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-xl bg-bluesoft flex items-center justify-center">
                    <Icon className="h-5 w-5 text-blue" />
                  </div>
                  <span className="font-mono text-2xl font-extrabold text-line">{s.n}</span>
                </div>
                <h3 className="mt-4 font-display font-extrabold text-lg text-ink">{s.t}</h3>
                <p className="mt-2 text-sm text-slate1 leading-relaxed">{s.d}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="bg-soft border-t border-line py-16">
      <div className="mx-auto max-w-3xl px-5 md:px-8 text-center">
        <Sparkles className="h-6 w-6 text-brand mx-auto" />
        <h2 className="h-display text-3xl md:text-4xl text-ink mt-4">
          Takes a minute. Could change your season.
        </h2>
        <p className="mt-4 text-slate1">
          Worst case, you walk away with a free audit that shows you exactly where your marketing is leaking money.
        </p>
        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="#apply-form" className="btn-primary text-base px-7 py-3.5 w-full sm:w-auto">
            Start my application <ArrowRight className="h-4 w-4" />
          </a>
          <a href={PHONE_HREF} className="btn-ghost-light text-base px-7 py-3.5 w-full sm:w-auto">
            <Phone className="h-4 w-4" /> Call {PHONE_DISPLAY}
          </a>
        </div>
      </div>
    </section>
  );
}

function ApplyFooter() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto max-w-6xl px-5 md:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <a href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white p-1.5 flex items-center justify-center">
              <img src="/tlmlogo.png" alt="" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight text-sm">Trade Leads Marketing</div>
              <div className="text-[9px] uppercase tracking-[0.25em] text-brand font-bold">tradeleadsmarketing.ca</div>
            </div>
          </a>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <a href={PHONE_HREF} className="text-white/85 hover:text-brand flex items-center gap-1.5"><Phone className="h-4 w-4" /> {PHONE_DISPLAY}</a>
            <a href={`mailto:${EMAIL}`} className="text-white/85 hover:text-brand flex items-center gap-1.5"><Mail className="h-4 w-4" /> Email us</a>
            <a href="/" className="text-white/85 hover:text-brand">Main site</a>
          </div>
        </div>
        <p className="mt-8 pt-6 border-t border-white/10 text-[11px] text-white/45 leading-relaxed">
          <span className="font-bold text-white/60">Disclaimer:</span> Except where an explicit written guarantee
          applies (such as our 30-day guarantee, which is subject to its own qualifying terms and the definition of a
          qualified booking agreed in your service agreement), Trade Leads Marketing does not guarantee specific lead
          volume, ranking position, or revenue outcomes. Google&trade;, Google Ads&trade;, and Google Business
          Profile&trade; are trademarks of Google LLC, used descriptively; Trade Leads Marketing is not affiliated
          with or endorsed by Google.
        </p>
        <div className="mt-4 text-[11px] text-white/45">© {new Date().getFullYear()} Trade Leads Marketing. All rights reserved.</div>
      </div>
    </footer>
  );
}

/* ---------- Mobile: always-visible way out to a phone call ---------- */
function MobileCallBar() {
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-white/95 backdrop-blur px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate2">Rather just talk?</div>
          <div className="text-sm font-extrabold text-ink truncate">{PHONE_DISPLAY}</div>
        </div>
        <a href={PHONE_HREF} className="btn-primary text-sm py-2.5 px-5 shrink-0">
          <Phone className="h-4 w-4" /> Call now
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
    <div className="min-h-screen bg-white text-ink antialiased overflow-x-hidden pb-20 lg:pb-0">
      <ApplyHeader />
      <main>
        <HeroBand />

        <div className="mx-auto max-w-6xl px-5 md:px-8 -mt-24 md:-mt-28 relative z-10">
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 xl:col-span-8">
              <Funnel />
            </div>
            <div className="lg:col-span-5 xl:col-span-4">
              <ProofRail />
            </div>
          </div>
        </div>

        <div className="mt-16 md:mt-20">
          <WhatHappensNext />
          <FinalCTA />
        </div>
      </main>
      <ApplyFooter />
      <MobileCallBar />
    </div>
  );
}
