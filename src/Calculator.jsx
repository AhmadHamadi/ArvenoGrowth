import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ArrowRight, ArrowLeft, Phone, RotateCcw } from 'lucide-react';

/* ============================================================
   TRADE LEADS MARKETING — BREAK-EVEN + LEADS CALCULATOR
   Standalone page (/calculator). Dead simple, on purpose.

   Pick a trade → we estimate leads from the ad budget (each trade
   has its own cost-per-lead range). Then:
     leadsRange      = spend / costPerLead(range for the trade)
     jobsToBreakEven = ceil(spend / whatOneJobIsWorth)
   "We bring you the leads. Close this many to make your money back —
    everything after that is profit."

   Same design language as the rest of the site: warm paper, warm ink,
   one accent, hairline rules, no floating cards.
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

const PHONE_DISPLAY = '(289) 489-1167';
const PHONE_HREF    = 'tel:+12894891167';

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

/* ---------- Number input — value stays put while you type ---------- */
function NumberField({ value, onChange, min, max, prefix, accent }) {
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
    <div
      className="flex h-11 w-full items-center border border-inkd bg-white sm:w-36"
      style={{ outlineColor: accent }}
    >
      {prefix && <span className="pl-3 font-plex text-[14px] text-inkd3">{prefix}</span>}
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
        className="h-full w-full bg-transparent px-2 text-center font-plex text-[16px] font-semibold tabular-nums text-inkd focus:outline-none"
        aria-label="value"
      />
    </div>
  );
}

/* ---------- One input row: label, value, slider ---------- */
function InputRow({ label, hint, value, onChange, min, max, step, prefix, accent }) {
  return (
    <div className="border-b border-paperEdge py-6 last:border-b-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="font-archivo text-[16px] font-bold text-inkd">{label}</div>
          <div className="mt-1 font-archivo text-[13.5px] text-inkd3">{hint}</div>
        </div>
        <NumberField value={value} onChange={onChange} min={min} max={max} prefix={prefix} accent={accent} />
      </div>

      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tlm-range mt-5 w-full"
        style={{ '--accent': accent }}
        aria-label={label}
      />
      <div className="mt-2 flex justify-between font-plex text-[10.5px] tabular-nums text-inkd3">
        <span>{prefix}{whole(min)}</span>
        <span>{prefix}{whole(max)}</span>
      </div>
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
  const jobsToBreakEven = breakEvenExact > 0 ? Math.ceil(breakEvenExact) : 0;
  const feasible = leadsN > 0 && jobsToBreakEven <= leadsN;
  const extraJobs = Math.max(0, leadsN - jobsToBreakEven);

  const bePct = leadsN > 0 ? clamp((jobsToBreakEven / leadsN) * 100, 0, 100) : 0;
  const extraPct = 100 - bePct;

  /* ---- The cosmetic vertical swaps the accent only. Structure, ground and
          ink stay identical, so the page never stops looking like ours. ---- */
  const isCosmetic = trade.key === 'medspa';
  const accent = isCosmetic ? '#9B5C7A' : '#F37021';
  const accentDeep = isCosmetic ? '#7C4763' : '#C24700';
  const unit = isCosmetic ? 'enquiries' : 'leads';

  return (
    <div className="min-h-screen bg-paper font-archivo text-inkd antialiased">
      <style>{`
        .grain::before {
          content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.28'/%3E%3C/svg%3E");
        }
        .tlm-range { -webkit-appearance: none; appearance: none; height: 3px; background: #D6CFC0; outline: none; }
        .tlm-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 22px; height: 22px; background: var(--accent);
          border: 2px solid #15140F; cursor: pointer;
        }
        .tlm-range::-moz-range-thumb {
          width: 22px; height: 22px; background: var(--accent);
          border: 2px solid #15140F; cursor: pointer; border-radius: 0;
        }
        .tlm-range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 4px rgba(21,20,15,0.15); }
      `}</style>

      {/* ---- Masthead ---- */}
      <header className="sticky top-0 z-40 border-b border-inkd bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-8">
          <a href="/" className="flex items-center gap-4" aria-label="Trade Leads Marketing, home">
            <img src="/tlm-mark.png" alt="Trade Leads Marketing" className="h-14 w-14 object-contain md:h-16 md:w-16" />
            <span className="hidden h-10 w-px bg-paperEdge sm:block" />
            <span className="hidden leading-tight sm:block">
              <span className="block font-archivo text-[15px] font-extrabold uppercase tracking-[0.06em] text-inkd">
                Trade Leads Marketing
              </span>
              <span className="block font-archivo text-[12.5px] text-inkd3">Lead calculator</span>
            </span>
          </a>
          <div className="flex items-center gap-2.5">
            <a href={PHONE_HREF} className="group hidden items-center gap-2.5 border border-inkd px-4 py-2.5 transition-colors hover:bg-inkd sm:flex">
              <Phone className="h-4 w-4" style={{ color: accent }} />
              <span className="font-plex text-[12px] font-semibold tabular-nums text-inkd transition-colors group-hover:text-paper">
                {PHONE_DISPLAY}
              </span>
            </a>
            <a href="/" className="inline-flex items-center gap-1.5 border border-inkd px-4 py-2.5 font-archivo text-[13px] font-bold uppercase tracking-[0.08em] text-inkd transition-colors hover:bg-inkd hover:text-paper">
              <ArrowLeft className="h-4 w-4" /> Site
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
        {/* ---- Heading ---- */}
        <div className="max-w-3xl">
          <div className="flex items-center gap-4">
            <span className="font-plex text-[10.5px] font-semibold uppercase tracking-[0.28em]" style={{ color: accent }}>
              The math is simple
            </span>
            <span className="h-px w-20 bg-paperEdge" />
          </div>
          <h1 className="mt-5 font-archivo text-[2.4rem] font-extrabold leading-[1.02] tracking-[-0.03em] text-inkd sm:text-5xl">
            How many {unit} can we get you, and{' '}
            <span style={{ color: accent }}>how fast does it pay off?</span>
          </h1>
          <p className="mt-5 font-archivo text-[17px] leading-[1.65] text-inkd2">
            Pick your trade and your budget. We estimate the {unit} that budget brings in, and how few
            {isCosmetic ? ' clients' : ' jobs'} it takes to make your money back.{' '}
            <span className="font-semibold text-inkd">Everything after that is profit.</span>
          </p>
        </div>

        <div className="mt-12 grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
          {/* ---- INPUTS ---- */}
          <div className="lg:col-span-5 lg:sticky lg:top-28">
            <div className="border border-inkd bg-paper">
              <div className="flex items-center justify-between gap-4 border-b border-inkd bg-inkd px-5 py-2.5">
                <span className="font-plex text-[10px] font-semibold uppercase tracking-[0.2em] text-paper/70">
                  Your numbers
                </span>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 font-plex text-[10px] font-semibold uppercase tracking-[0.14em] text-paper/60 transition-colors hover:text-paper"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>

              <div className="px-5 md:px-6">
                <div className="border-b border-paperEdge py-6">
                  <label htmlFor="trade" className="font-archivo text-[16px] font-bold text-inkd">
                    What kind of work do you do?
                  </label>
                  <select
                    id="trade"
                    value={tradeKey}
                    onChange={(e) => pickTrade(e.target.value)}
                    className="mt-3 w-full cursor-pointer border border-inkd bg-white px-3 py-3 font-archivo text-[15px] font-semibold text-inkd focus:outline-none"
                  >
                    {TRADES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>

                <InputRow
                  label="What you spend a month"
                  hint="Your monthly Google Ads budget"
                  value={spend} onChange={setSpend}
                  min={500} max={25000} step={100} prefix="$" accent={accent}
                />
                <InputRow
                  label={isCosmetic ? 'What one visit is worth' : 'What one job is worth'}
                  hint={isCosmetic ? 'Average first visit, edit to match' : `Typical ${trade.label.toLowerCase()} job, edit to match yours`}
                  value={jobValue} onChange={setJobValue}
                  min={300} max={80000} step={250} prefix="$" accent={accent}
                />
              </div>
            </div>
          </div>

          {/* ---- RESULT ---- */}
          <div className="space-y-8 lg:col-span-7">
            <div className="grain relative overflow-hidden border border-inkd bg-inkd text-paper">
              <div className="h-[3px]" style={{ background: accent }} />
              <div className="relative px-6 py-8 md:px-9 md:py-10">
                <div className="font-plex text-[10px] font-semibold uppercase tracking-[0.2em] text-paper/50">
                  {trade.label} · {money(spend)}/mo in ads
                </div>

                <div className="mt-6 font-archivo text-[15px] text-paper/65">We would aim to bring you about</div>
                <div className="mt-1 flex flex-wrap items-end gap-x-3">
                  <div className="flex items-end font-archivo text-[3.4rem] font-extrabold leading-none tracking-[-0.04em] sm:text-[4.4rem]" style={{ color: accent }}>
                    <AnimatedValue value={leadsLo} format={whole} />
                    <span className="mx-1.5 text-paper/30">–</span>
                    <AnimatedValue value={leadsHi} format={whole} />
                  </div>
                  <div className="mb-1 font-archivo text-[22px] font-extrabold sm:text-[26px]">
                    {unit}<span className="font-archivo text-[16px] text-paper/45">/mo</span>
                  </div>
                </div>
                <div className="mt-2 font-archivo text-[13px] text-paper/45">
                  Based on {trade.label.toLowerCase()} {unit} at about {money(trade.cplLo)}–{money(trade.cplHi)} each on Google Ads
                </div>

                <p className="mt-6 max-w-xl font-archivo text-[17px] leading-[1.6] text-paper/80">
                  {feasible ? (
                    <>You would only need to {isCosmetic ? 'book' : 'close'}{' '}
                    <span className="font-bold" style={{ color: accent }}>{whole(jobsToBreakEven)}</span> of them
                    to make your <span className="font-bold text-paper">{money(spend)}</span> back.</>
                  ) : (
                    <>At this {isCosmetic ? 'visit' : 'job'} size you would need{' '}
                    <span className="font-bold" style={{ color: accent }}>{whole(jobsToBreakEven)}</span>{' '}
                    {isCosmetic ? 'clients' : 'jobs'} to make your{' '}
                    <span className="font-bold text-paper">{money(spend)}</span> back. Worth raising the budget or
                    targeting bigger {isCosmetic ? 'treatments' : 'jobs'}.</>
                  )}
                </p>

                {/* Leads bar */}
                <div className="mt-9">
                  <div className="mb-2 flex justify-between font-archivo text-[13px] text-paper/55">
                    <span>Your roughly {whole(leadsN)} {unit} this month</span>
                    <span>{feasible ? `${whole(extraJobs)} left over` : 'need more leads'}</span>
                  </div>
                  <div className="flex h-5 overflow-hidden border border-paper/20">
                    <motion.div className="h-full bg-paper/25"
                      animate={{ width: `${bePct}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
                    <motion.div className="h-full" style={{ background: accent }}
                      animate={{ width: `${extraPct}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                  <div className="mt-2 flex flex-wrap justify-between gap-2 font-archivo text-[12.5px]">
                    <span className="text-paper/55">Pays back your spend</span>
                    <span className="font-semibold" style={{ color: accent }}>
                      Every extra {isCosmetic ? 'client' : 'job'} is profit
                    </span>
                  </div>
                </div>

                <p className="mt-8 border-l-[3px] pl-4 font-archivo text-[15px] leading-[1.6] text-paper/85" style={{ borderColor: accent }}>
                  Every {isCosmetic ? 'client you book' : 'job you close'} is worth about{' '}
                  <span className="font-bold text-paper">{money(jobValue)}</span>
                  {isCosmetic ? ' on the first visit, and far more once they come back.' : ', and the rest is upside.'}
                </p>
              </div>
            </div>

            {/* Stat row */}
            <dl className="grid grid-cols-1 border-t border-inkd sm:grid-cols-3">
              {[
                [isCosmetic ? 'Enquiries a month' : 'Leads a month',
                  <><AnimatedValue value={leadsLo} format={whole} />–<AnimatedValue value={leadsHi} format={whole} /></>],
                [isCosmetic ? 'Clients to break even' : 'Jobs to break even',
                  <AnimatedValue value={jobsToBreakEven} format={whole} />],
                [isCosmetic ? 'Each visit worth' : 'Each job worth',
                  <AnimatedValue value={jobValue} format={money} />]
              ].map(([label, val], i) => (
                <div
                  key={label}
                  className={`border-b border-paperEdge py-5 sm:border-b-0 ${i > 0 ? 'sm:border-l sm:border-paperEdge sm:pl-6' : 'sm:pr-6'} ${i === 1 ? 'sm:px-6' : ''}`}
                >
                  <dt className="font-archivo text-[13px] text-inkd3">{label}</dt>
                  <dd className="mt-1.5 font-archivo text-[30px] font-extrabold leading-none tracking-[-0.03em] text-inkd">
                    {val}
                  </dd>
                </div>
              ))}
            </dl>

            {isCosmetic && (
              <div className="border border-paperEdge bg-paper2 px-5 py-5">
                <div className="font-plex text-[10px] font-semibold uppercase tracking-[0.2em] text-inkd3">
                  Typical med-spa prices, 2026
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 font-archivo text-[14.5px] text-inkd2">
                  <span><span className="font-bold text-inkd">Botox</span> about $350–$583 a visit</span>
                  <span><span className="font-bold text-inkd">Dermal filler</span> about $750 a syringe</span>
                  <span><span className="font-bold text-inkd">Lip filler</span> about $650</span>
                  <span><span className="font-bold text-inkd">Sculptra</span> about $900 a vial</span>
                </div>
                <div className="mt-2 font-archivo text-[13px] text-inkd3">
                  Set what one visit is worth above to match the clinic's real average.
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="flex flex-col justify-between gap-5 border-t border-inkd pt-7 sm:flex-row sm:items-center">
              <div>
                <div className="font-archivo text-[19px] font-extrabold text-inkd">
                  Want us to bring you those {unit}?
                </div>
                <p className="mt-1 font-archivo text-[14.5px] text-inkd2">
                  Book a free 30-minute call. No obligation, no pressure.
                </p>
              </div>
              <a
                href="/apply"
                className="group inline-flex shrink-0 items-center justify-center gap-2.5 px-7 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-opacity hover:opacity-90"
                style={{ background: accent }}
                onMouseEnter={(e) => { e.currentTarget.style.background = accentDeep; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = accent; }}
              >
                Book a call
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </div>

        <p className="mt-14 max-w-3xl border-t border-paperEdge pt-6 font-archivo text-[13px] leading-[1.7] text-inkd3">
          <span className="font-semibold text-inkd2">Estimate only.</span> Lead counts use real 2024–26
          paid-search cost-per-lead ranges for each trade; the higher end assumes a strong campaign blended
          with Local Services Ads and organic. Actual results vary with your market, competition, and season,
          and in smaller markets or lower-demand trades such as fencing, concrete, or remodelling, local search
          volume rather than budget can cap how many leads are available. Break-even is what you spend divided
          by what one job is worth, rounded up to a whole job. We deliver the leads; whether they become jobs
          depends on your pricing and sales process. These numbers illustrate the idea, they are not a promise
          of a specific result.
        </p>
      </main>
    </div>
  );
}
