import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, DollarSign, Users, Phone, RotateCcw,
  Wallet, Sparkles, Scale, ChevronDown
} from 'lucide-react';

/* ============================================================
   TRADE LEADS MARKETING — BREAK-EVEN + LEADS CALCULATOR
   Standalone page (/calculator). Dead simple, on purpose.

   Pick a trade → we estimate leads from the ad budget (each trade
   has its own cost-per-lead range). Then:
     leadsRange     = spend / costPerLead(range for the trade)
     jobsToBreakEven= ceil(spend / whatOneJobIsWorth)
   "We bring you the leads. Close this many to make your money back —
    everything after that is profit."
   CPL + typical job values are paid-search benchmarks (see notes at
   bottom of this file). Numbers are estimates, tuned to be honest.
   ============================================================ */

/* ---------- Trade benchmarks: cost-per-lead range + typical job value ----------
   cplLo/cplHi = Google Ads SEARCH cost per lead (USD, a call or form fill) —
   NOT LSA or shared-marketplace leads, which price differently.
   job = typical ticket for a PAID-SEARCH-acquired customer (skews to
   installs/replacements, above the blended consumer average).
   Sourced from 2024-26 benchmarks — LocaliQ Home Services (large-N medians) +
   SearchLight Digital (2026 account aggregates) as anchors, cross-checked
   against trade-specific agency data. Full sourcing in CALCULATOR-BENCHMARKS.md.
   All figures USD (× ~1.37 for CAD).                                            */
const TRADES = [
  { key: 'roofing',    label: 'Roofing',                 cplLo: 150, cplHi: 300, job: 10000 },
  { key: 'hvac',       label: 'HVAC',                    cplLo: 110, cplHi: 220, job: 8000 },
  { key: 'plumbing',   label: 'Plumbing',                cplLo: 110, cplHi: 200, job: 1700 },
  { key: 'electrical', label: 'Electrical',              cplLo: 95,  cplHi: 180, job: 2000 },
  { key: 'solar',      label: 'Solar',                   cplLo: 110, cplHi: 300, job: 25000 },
  { key: 'windows',    label: 'Windows & Doors',         cplLo: 110, cplHi: 280, job: 9500 },
  { key: 'siding',     label: 'Siding',                  cplLo: 120, cplHi: 300, job: 13000 },
  { key: 'landscaping',label: 'Landscaping',             cplLo: 100, cplHi: 180, job: 6500 },
  { key: 'concrete',   label: 'Concrete',                cplLo: 130, cplHi: 250, job: 5500 },
  { key: 'paving',     label: 'Paving / Asphalt',        cplLo: 110, cplHi: 250, job: 5500 },
  { key: 'masonry',    label: 'Masonry',                 cplLo: 120, cplHi: 350, job: 6000 },
  { key: 'fencing',    label: 'Fencing',                 cplLo: 90,  cplHi: 180, job: 6000 },
  { key: 'decks',      label: 'Decks',                   cplLo: 90,  cplHi: 180, job: 16000 },
  { key: 'excavation', label: 'Excavation',              cplLo: 100, cplHi: 250, job: 8000 },
  { key: 'tree',       label: 'Tree Service',            cplLo: 55,  cplHi: 120, job: 2000 },
  { key: 'pools',      label: 'Pools (inground builder)',cplLo: 120, cplHi: 350, job: 60000 },
  { key: 'remodel',    label: 'Kitchen & Bath Remodel',  cplLo: 150, cplHi: 400, job: 27000 },
  { key: 'gc',         label: 'General Contractor / Reno',cplLo: 130,cplHi: 350, job: 45000 },
  { key: 'painting',   label: 'Painting',                cplLo: 120, cplHi: 250, job: 4500 },
  { key: 'flooring',   label: 'Flooring',                cplLo: 90,  cplHi: 180, job: 4000 },
  { key: 'drywall',    label: 'Drywall / Insulation',    cplLo: 100, cplHi: 280, job: 2500 },
  { key: 'garage',     label: 'Garage Doors',            cplLo: 100, cplHi: 220, job: 1300 },
  { key: 'pest',       label: 'Pest Control',            cplLo: 60,  cplHi: 140, job: 550 },
  { key: 'cleaning',   label: 'Cleaning / Janitorial',   cplLo: 50,  cplHi: 120, job: 500 },
  { key: 'handyman',   label: 'Handyman',                cplLo: 55,  cplHi: 110, job: 450 },
  // Cosmetic vertical. CPL = enquiry cost (CPC $5.75–8.25 ÷ 10% landing-page
  // conversion). job = average med-spa first visit — 2026 averages: Botox appt
  // ~$350–583, dermal filler ~$750/syringe, lip ~$650 (RealSelf/AmSpa; Ontario
  // CAD ~$500–600). Selecting this reskins the calculator.
  { key: 'medspa',     label: 'Cosmetic / Med Spa (injectables)', cplLo: 70, cplHi: 100, job: 550 }
];

/* ---------- Formatting helpers ---------- */
const money = (v) => '$' + Math.round(Math.max(0, v)).toLocaleString('en-US');
const whole = (v) => Math.round(Math.max(0, v)).toLocaleString('en-US');
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/* ---------- Animated number (re-animates whenever value changes) ---------- */
function AnimatedValue({ value, format }) {
  const mv = useMotionValue(value);
  const out = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, mv]);
  return <motion.span>{out}</motion.span>;
}

/* ---------- Number input — value sits centered, never "jumps" while typing ---------- */
function NumberField({ value, onChange, min, max, prefix }) {
  const fmt = (v) => String(Math.round(v));
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value]);

  const commit = (raw) => {
    const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
    if (!isNaN(n)) onChange(clamp(n, min, max));
  };

  return (
    <div className="inline-flex items-center h-11 w-32 rounded-lg border border-line bg-white overflow-hidden focus-within:border-blue focus-within:ring-4 focus-within:ring-blue/10 transition-all">
      {prefix && <span className="pl-3 text-slate2 font-semibold select-none">{prefix}</span>}
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onFocus={() => { focused.current = true; }}
        onBlur={() => {
          focused.current = false;
          commit(text);
          setText(fmt(clamp(parseFloat(text.replace(/[^0-9.]/g, '')) || min, min, max)));
        }}
        onChange={(e) => { setText(e.target.value); commit(e.target.value); }}
        className="w-full h-full px-2 bg-transparent text-ink font-black text-center focus:outline-none"
        aria-label="value"
      />
    </div>
  );
}

/* ---------- One slider row: label + centered value + slider ---------- */
function InputRow({ icon: Icon, label, hint, value, onChange, min, max, step, prefix, tint, iconColor, sliderColor }) {
  return (
    <div className="py-5 border-b border-line last:border-0">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center" style={{ background: tint }}>
            <Icon className="h-5 w-5" style={{ color: iconColor }} />
          </div>
          <div>
            <div className="font-bold text-ink leading-tight text-[15px]">{label}</div>
            {hint && <div className="text-xs text-slate2 mt-0.5">{hint}</div>}
          </div>
        </div>
        <NumberField value={value} onChange={onChange} min={min} max={max} prefix={prefix} />
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-line"
        style={{ accentColor: sliderColor }}
        aria-label={label}
      />
      <div className="flex justify-between text-[11px] text-slate3 font-semibold mt-1.5">
        <span>{prefix}{whole(min)}</span>
        <span>{prefix}{whole(max)}</span>
      </div>
    </div>
  );
}

/* ---------- A big stat tile ---------- */
function Tile({ icon: Icon, label, children, chipBg, chipFg }) {
  return (
    <div className="bg-white rounded-2xl border border-line shadow-soft p-5 text-center sm:text-left">
      <div className="flex items-center gap-2 justify-center sm:justify-start">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: chipBg, color: chipFg }}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate2">{label}</div>
      </div>
      <div className="mt-3 text-3xl md:text-4xl font-black text-ink">{children}</div>
    </div>
  );
}

export default function Calculator() {
  const [tradeKey, setTradeKey] = useState('roofing');
  const [spend, setSpend] = useState(3000);
  const trade = TRADES.find((t) => t.key === tradeKey) || TRADES[0];
  const [jobValue, setJobValue] = useState(trade.job);

  const pickTrade = (key) => {
    setTradeKey(key);
    const t = TRADES.find((x) => x.key === key);
    if (t) setJobValue(t.job);
  };
  const reset = () => { setTradeKey('roofing'); setSpend(3000); setJobValue(TRADES[0].job); };

  /* ---- Estimate leads from the trade's cost-per-lead range ---- */
  const leadsLo = Math.max(1, Math.round(spend / trade.cplHi)); // conservative (higher CPL = fewer)
  const leadsHi = Math.max(leadsLo, Math.round(spend / trade.cplLo));
  const leadsN = leadsLo; // conservative number used for the break-even story + bar

  /* ---- Break-even: how many jobs to make the money back ---- */
  const breakEvenExact = jobValue > 0 ? spend / jobValue : 0;
  const jobsToBreakEven = breakEvenExact > 0 ? Math.ceil(breakEvenExact) : 0; // whole jobs
  const feasible = leadsN > 0 && jobsToBreakEven <= leadsN;
  const extraJobs = Math.max(0, leadsN - jobsToBreakEven);

  const bePct = leadsN > 0 ? clamp((jobsToBreakEven / leadsN) * 100, 0, 100) : 0;
  const extraPct = 100 - bePct;

  /* ---- Theme: cosmetic vertical (Aura) reskins to plum/mauve ---- */
  const isCosmetic = trade.key === 'medspa';
  const th = isCosmetic
    ? {
        accentDark: '#D796B4',                       // accent on the dark card (light mauve)
        accent: '#9B5C7A',                           // accent on white
        deep: '#7C4763',
        sec: '#9B5C7A', secBg: '#F4E7EE',            // secondary (replaces blue)
        accentChip: 'rgba(155,92,122,0.12)',
        secChip: 'rgba(155,92,122,0.12)',
        greenChip: 'rgba(94,129,104,0.12)', green: '#5E8168',
        gradient: 'linear-gradient(to bottom right, #2E1E33, #241A28, #160E19)',
        glow: '0 10px 40px -10px rgba(155,92,122,0.5)'
      }
    : {
        accentDark: '#F37021',
        accent: '#F37021',
        deep: '#D85A0F',
        sec: '#1E55C7', secBg: '#EAF1FE',
        accentChip: 'rgba(243,112,33,0.12)',
        secChip: 'rgba(30,85,199,0.12)',
        greenChip: 'rgba(52,168,83,0.12)', green: '#34A853',
        gradient: 'linear-gradient(to bottom right, #0A1B3D, #0F1A33, #06122B)',
        glow: undefined
      };

  return (
    <div className="min-h-screen bg-soft text-ink antialiased">
      {/* ---- Top bar ---- */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-6xl px-5 md:px-8 flex items-center justify-between py-3">
          <a href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white border border-line flex items-center justify-center shadow-soft p-1">
              <img src="/tlmlogo.png" alt="Trade Leads Marketing" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight text-ink">Trade Leads</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-brand font-bold -mt-0.5">Lead Calculator</div>
            </div>
          </a>
          <div className="flex items-center gap-2">
            <a href="tel:+12894891167" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-blue">
              <Phone className="h-4 w-4" /> (289) 489-1167
            </a>
            <a href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate1 hover:text-ink border border-line rounded-lg px-3 py-2 bg-white">
              <ArrowLeft className="h-4 w-4" /> Back to site
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 md:px-8 py-10 md:py-14">
        {/* ---- Heading ---- */}
        <div className="max-w-2xl">
          <span className="eyebrow-light" style={{ color: th.sec, background: th.secBg, borderColor: th.secChip }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: th.sec }} /> The math is simple
          </span>
          <h1 className="h-display text-4xl md:text-5xl text-ink mt-4">
            How many leads can we get you — and <span style={{ color: th.sec }}>how fast does it pay off?</span>
          </h1>
          <p className="mt-4 text-slate1 text-lg leading-relaxed">
            Pick your trade and your budget. We'll estimate the leads that budget brings in, and how few
            jobs it takes to make your money back. <span className="font-semibold text-ink">Everything after that is profit.</span>
          </p>
        </div>

        {/* ---- Grid: inputs + result ---- */}
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 mt-10 items-start">
          {/* INPUTS */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-line shadow-lifted p-6 md:p-8 lg:sticky lg:top-24">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-extrabold text-xl text-ink">Your numbers</h2>
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate2 hover:text-blue border border-line rounded-lg px-2.5 py-1.5 bg-white transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>

            {/* Trade dropdown */}
            <div className="py-5 border-b border-line">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center" style={{ background: th.secBg }}>
                  <Scale className="h-5 w-5" style={{ color: th.sec }} />
                </div>
                <div className="font-bold text-ink text-[15px]">What kind of work do you do?</div>
              </div>
              <div className="relative">
                <select
                  value={tradeKey}
                  onChange={(e) => pickTrade(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-line bg-white pl-4 pr-10 py-3 text-ink font-bold focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition-all cursor-pointer"
                  aria-label="Type of business"
                >
                  {TRADES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <ChevronDown className="h-5 w-5 text-slate2 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <InputRow
              icon={Wallet} label="What you spend a month" hint="Your monthly Google Ads budget"
              value={spend} onChange={setSpend} min={500} max={25000} step={100} prefix="$"
              tint={th.secBg} iconColor={th.sec} sliderColor={th.accent}
            />
            <InputRow
              icon={DollarSign} label={isCosmetic ? 'What one visit is worth' : 'What one job is worth'}
              hint={isCosmetic ? 'Average first visit — edit to match' : `Typical ${trade.label.toLowerCase()} job — edit to match yours`}
              value={jobValue} onChange={setJobValue} min={300} max={80000} step={250} prefix="$"
              tint={th.secBg} iconColor={th.sec} sliderColor={th.accent}
            />
          </div>

          {/* RESULT */}
          <div className="lg:col-span-7 space-y-6">
            {/* Headline */}
            <div className="relative rounded-2xl overflow-hidden text-white shadow-glow p-7 md:p-10" style={{ background: th.gradient }}>
              <div className="absolute inset-0 grid-bg-dark opacity-40" />
              <div className="relative">
                <div className="text-xs font-bold uppercase tracking-widest text-white/60">
                  {trade.label} · {money(spend)}/mo in ads
                </div>
                <div className="text-white/70 mt-3">We'd aim to bring you about</div>
                <div className="flex items-end gap-3 mt-1">
                  <div className="text-6xl md:text-7xl font-black leading-none flex items-end" style={{ color: th.accentDark }}>
                    <AnimatedValue value={leadsLo} format={whole} />
                    <span className="text-white/40 mx-1">–</span>
                    <AnimatedValue value={leadsHi} format={whole} />
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-white mb-1">{isCosmetic ? 'enquiries' : 'leads'}<span className="text-white/50 text-lg font-bold">/mo</span></div>
                </div>
                <div className="text-[12px] text-white/45 mt-2">
                  Based on {trade.label.toLowerCase()} {isCosmetic ? 'enquiries' : 'leads'} at about {money(trade.cplLo)}–{money(trade.cplHi)} each on Google Ads
                </div>

                <div className="text-white/75 mt-5 text-lg leading-relaxed max-w-xl">
                  {feasible ? (
                    <>You'd only need to {isCosmetic ? 'book' : 'close'} <span className="font-bold" style={{ color: th.accentDark }}>{whole(jobsToBreakEven)}</span> of
                    them to make your <span className="font-bold text-white">{money(spend)}</span> back.</>
                  ) : (
                    <>At this {isCosmetic ? 'visit' : 'job'} size you'd need <span className="font-bold" style={{ color: th.accentDark }}>{whole(jobsToBreakEven)}</span> {isCosmetic ? 'clients' : 'jobs'}
                    to make your <span className="font-bold text-white">{money(spend)}</span> back — worth raising the budget or targeting bigger {isCosmetic ? 'treatments' : 'jobs'}.</>
                  )}
                </div>

                {/* Leads bar */}
                <div className="mt-8">
                  <div className="flex justify-between text-[11px] font-semibold text-white/55 mb-2">
                    <span>Your ~{whole(leadsN)} {isCosmetic ? 'enquiries' : 'leads'} this month</span>
                    <span>{feasible ? `${whole(extraJobs)} left over` : 'need more leads'}</span>
                  </div>
                  <div className="h-5 rounded-full bg-white/10 overflow-hidden flex">
                    <motion.div className="h-full bg-white/35"
                      animate={{ width: `${bePct}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
                    <motion.div className="h-full" style={{ background: `linear-gradient(to right, ${th.accentDark}, ${th.deep})` }}
                      animate={{ width: `${extraPct}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                  <div className="flex justify-between text-[11px] mt-2">
                    <span className="text-white/55">■ Pays back your spend</span>
                    <span className="font-semibold" style={{ color: th.accentDark }}>■ Every extra {isCosmetic ? 'client' : 'job'} = more money</span>
                  </div>
                </div>

                {/* Punch line */}
                <div className="mt-7 flex items-start gap-2.5 rounded-xl bg-white/5 border border-white/10 px-4 py-3.5">
                  <Sparkles className="h-5 w-5 shrink-0 mt-0.5" style={{ color: th.accentDark }} />
                  <p className="text-white/85 leading-snug">
                    Every {isCosmetic ? 'client you book' : 'job you close'} is worth about{' '}
                    <span className="font-black text-white">{money(jobValue)}</span>
                    {isCosmetic ? <> the first visit — and far more once they come back.</> : <> — the rest is upside.</>}
                  </p>
                </div>
              </div>
            </div>

            {/* Simple stat tiles */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <Tile icon={Users} chipBg={th.accentChip} chipFg={th.accent} label={isCosmetic ? 'Enquiries a month' : 'Leads a month'}>
                <AnimatedValue value={leadsLo} format={whole} />–<AnimatedValue value={leadsHi} format={whole} />
              </Tile>
              <Tile icon={Scale} chipBg={th.secChip} chipFg={th.sec} label={isCosmetic ? 'Clients to break even' : 'Jobs to break even'}>
                <AnimatedValue value={jobsToBreakEven} format={whole} />
              </Tile>
              <Tile icon={DollarSign} chipBg={th.greenChip} chipFg={th.green} label={isCosmetic ? 'Each visit worth' : 'Each job worth'}>
                <AnimatedValue value={jobValue} format={money} />
              </Tile>
            </div>

            {isCosmetic && (
              <div className="rounded-2xl bg-white border border-line shadow-soft p-5 text-sm text-slate1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate2 mb-2">Typical med-spa prices · 2026</div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  <span><span className="font-bold text-ink">Botox</span> ~$350–$583 / visit</span>
                  <span><span className="font-bold text-ink">Dermal filler</span> ~$750 / syringe</span>
                  <span><span className="font-bold text-ink">Lip filler</span> ~$650</span>
                  <span><span className="font-bold text-ink">Sculptra</span> ~$900 / vial</span>
                </div>
                <div className="text-xs text-slate2 mt-2">Set "what one visit is worth" above to match the clinic's real average.</div>
              </div>
            )}

            {/* CTA */}
            <div className="rounded-2xl bg-white border border-line shadow-soft p-6 md:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="font-display font-extrabold text-lg text-ink flex items-center gap-2">
                  <Sparkles className="h-5 w-5" style={{ color: th.accent }} /> Want us to bring you those {isCosmetic ? 'clients' : 'leads'}?
                </div>
                <p className="text-slate1 text-sm mt-1">Start with a free audit — no obligation, no pressure.</p>
              </div>
              <a href="/#audit" className="btn-primary shrink-0" style={{ backgroundColor: th.accent, boxShadow: th.glow }}>
                Get a Free Audit <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="mt-10 text-xs text-slate2 leading-relaxed max-w-3xl">
          <span className="font-bold text-slate1">Estimate only.</span> Lead counts use real 2024–26 paid-search
          cost-per-lead ranges for each trade; the higher end assumes a strong campaign blended with Local Services Ads
          and organic. Actual results vary with your market, competition, and season — and in smaller markets or
          lower-demand trades (e.g. fencing, concrete, remodeling), local search volume, not budget, can cap how many
          leads are available. Break-even is what you spend ÷ what one job is worth, rounded up to a whole job. We
          deliver the leads; whether they become jobs depends on your pricing and sales process. These numbers
          illustrate the idea — not a promise of a specific result.
        </p>
      </main>
    </div>
  );
}
