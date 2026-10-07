import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Mail, Menu, Phone, RotateCcw, X } from 'lucide-react';
import brand from './brand-config.json';

import { TRADES, DEFAULT_BUDGET, BUDGET_PRESETS, CPL_SENSITIVITY_PERCENT } from './calculator-data.js';

const PHONE_DISPLAY = '(289) 489-1167';
const PHONE_HREF = 'tel:+12894891167';
const fmtMoney = (v) => '$' + Math.round(Math.max(0, Number(v) || 0)).toLocaleString('en-US');
const fmtNum = (v) => (Number.isFinite(v) ? v : 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
const fmtLeadRange = (low, high) => `${fmtNum(low)}–${fmtNum(high)}`;
const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));

function Field({ id, label, hint, value, onChange, min, max, step = 1, prefix = '', suffix = '', disabled = false }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => { const next = clamp(draft, min, max); setDraft(String(next)); onChange(next); };
  return <div className="calc-field">
    <div className="calc-field-head"><label htmlFor={id}>{label}</label><span>{hint}</span></div>
    <div className="calc-entry">
      {prefix && <span aria-hidden="true">{prefix}</span>}
      <input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={draft} disabled={disabled} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} onChange={(e) => { const raw = e.target.value; setDraft(raw); const next = Number(raw); if (raw !== '' && Number.isFinite(next) && next >= min && next <= max) onChange(next); }} />
      {suffix && <span aria-hidden="true">{suffix}</span>}
    </div>
    <input aria-label={`${label} slider`} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
  </div>;
}

export default function Calculator() {
  const [tradeKey, setTradeKey] = useState('roofing');
  const selected = TRADES.find((x) => x.key === tradeKey) || TRADES[0];
  const [spend, setSpend] = useState(DEFAULT_BUDGET);
  const cpl = selected.planningCpl;
  const [jobValue, setJobValue] = useState(TRADES[0].jobValue);
  const [closeRate, setCloseRate] = useState(25);
  const [margin, setMargin] = useState(40);
  const [fee, setFee] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const pick = (key) => { const trade = TRADES.find((item) => item.key === key); setTradeKey(key); setJobValue(trade.jobValue); };
  const reset = () => { const trade = TRADES[0]; setTradeKey(trade.key); setSpend(DEFAULT_BUDGET); setJobValue(trade.jobValue); setCloseRate(25); setMargin(40); setFee(0); };
  const calc = useMemo(() => {
    const leads = cpl > 0 ? spend / cpl : 0;
    const jobs = leads * closeRate / 100;
    const revenue = jobs * jobValue;
    const grossProfit = revenue * margin / 100;
    const marketingCost = spend + fee;
    const contribution = grossProfit - marketingCost;
    const gpPerJob = jobValue * margin / 100;
    const breakevenJobs = gpPerJob > 0 ? Math.ceil(marketingCost / gpPerJob) : 0;
    const breakevenLeads = closeRate > 0 ? Math.ceil(breakevenJobs / (closeRate / 100)) : 0;
    return { leads, jobs, revenue, grossProfit, marketingCost, contribution, breakevenJobs, breakevenLeads };
  }, [spend, cpl, jobValue, closeRate, margin, fee]);
  const leadRange = CPL_SENSITIVITY_PERCENT ? {
    low: spend / (cpl * (1 + CPL_SENSITIVITY_PERCENT / 100)),
    high: spend / (cpl * (1 - CPL_SENSITIVITY_PERCENT / 100))
  } : null;
  const leadDisplay = leadRange ? fmtLeadRange(leadRange.low, leadRange.high) : fmtNum(calc.leads);
  const positive = calc.contribution >= 0;

  return <div className="calc-page">
    <style>{`
      .calc-page{--deep:#041a63;--blue:#0f59f5;--sky:#39b8ff;--ink:#11234c;--muted:#65728f;--line:#e5eaf4;--pale:#f4f7ff;min-height:100vh;background:#f8faff;color:var(--ink);font-family:'DM Sans',Inter,Arial,sans-serif}
      .calc-page *{box-sizing:border-box}.calc-topbar{background:var(--deep);color:#fff;font-size:11px}.calc-topbar>div{max-width:1180px;margin:auto;padding:8px 24px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.calc-topbar a{color:#fff;text-decoration:none}.calc-toplinks{display:flex;gap:18px;flex-wrap:wrap}.calc-header{position:sticky;top:0;z-index:30;background:#ffffffed;backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}.calc-nav{max-width:1180px;min-height:70px;margin:auto;padding:9px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}.calc-brand{display:flex;align-items:center;gap:10px;color:var(--deep);font-weight:800;text-decoration:none}.calc-brand img{width:42px;height:42px;object-fit:contain}.calc-links{display:flex;align-items:center;gap:18px;font-size:12px;font-weight:650}.calc-links a{color:var(--deep);text-decoration:none}.calc-cta{padding:12px 16px!important;background:var(--blue);color:white!important;border-radius:5px}.calc-toggle{display:none;border:1px solid var(--line);background:white;padding:9px;color:var(--deep)}.calc-main{max-width:1180px;margin:auto;padding:55px 24px 65px}.calc-eyebrow{font-size:11px;color:var(--blue);font-weight:800;text-transform:uppercase;letter-spacing:.14em}.calc-main h1{max-width:800px;margin:12px 0;color:var(--deep);font-size:clamp(38px,5vw,58px);line-height:1.04;letter-spacing:-.045em}.calc-lede{max-width:780px;color:var(--muted);line-height:1.75}.calc-workspace{display:grid;grid-template-columns:minmax(320px,.9fr) minmax(0,1.1fr);gap:26px;margin-top:35px;align-items:start}.calc-mobile-summary{display:none}.calc-panel{border:1px solid var(--line);border-radius:12px;background:white;box-shadow:0 12px 38px #142d6410;overflow:hidden}.calc-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 18px;background:var(--deep);color:white;font-size:12px;font-weight:750}.calc-reset{display:flex;align-items:center;gap:6px;border:0;background:transparent;color:#fff;cursor:pointer;font:inherit}.calc-inputs{padding:8px 20px}.calc-trade{display:grid;gap:8px;padding:17px 0;border-bottom:1px solid var(--line);font-weight:750;font-size:13px}.calc-trade select{height:44px;padding:0 12px;border:1px solid #aab8d0;border-radius:6px;background:#fff;color:var(--ink);font:inherit}.calc-field{padding:16px 0;border-bottom:1px solid var(--line)}.calc-field-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px}.calc-field-head label{font-size:13px;font-weight:750}.calc-field-head span{font-size:10px;color:var(--muted);text-align:right}.calc-entry{display:flex;align-items:center;gap:5px;width:155px;margin:10px 0 9px;padding:0 9px;border:1px solid #aab8d0;border-radius:6px;background:white;color:var(--muted)}.calc-entry input{width:100%;height:38px;border:0;outline:0;color:var(--deep);font-size:16px;font-weight:750}.calc-entry input:disabled{background:white}.calc-field input[type=range]{width:100%;accent-color:var(--blue)}.calc-field:last-child{border:0}.calc-outputs{padding:25px;background:var(--deep);color:white}.calc-results-title{font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#b6c9f3}.calc-leads{margin:12px 0 3px;color:var(--sky);font-size:clamp(42px,7vw,68px);font-weight:850;line-height:1;letter-spacing:-.05em}.calc-leads-label{color:#d8e4fb;font-size:14px}.calc-summary{margin:16px 0 22px;color:#e1e9f7;font-size:13px;line-height:1.65}.calc-metrics{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #ffffff30}.calc-metric{padding:17px 10px 15px 0;border-bottom:1px solid #ffffff30}.calc-metric:nth-child(even){padding-left:14px;border-left:1px solid #ffffff30}.calc-metric span{display:block;color:#bdcbed;font-size:11px}.calc-metric strong{display:block;margin-top:6px;color:#fff;font-size:24px;letter-spacing:-.03em}.calc-contribution{margin-top:19px;padding:16px;border:1px solid #ffffff45;border-radius:7px;background:#ffffff0d}.calc-contribution span{display:block;color:#ccdaf1;font-size:11px}.calc-contribution strong{display:block;margin-top:5px;color:var(--sky);font-size:29px}.calc-contribution.negative strong{color:#ffb5c0}.calc-caveat{margin-top:16px;color:#d1dcf0;font-size:11px;line-height:1.65}.calc-caveat strong{color:white}.calc-cta-block{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:20px;padding-top:20px;border-top:1px solid #ffffff30}.calc-cta-block p{margin:0;color:#e2eafa;font-size:12px;line-height:1.5}.calc-cta-block a{display:inline-flex;gap:8px;align-items:center;flex:none;padding:12px 15px;border-radius:5px;background:var(--sky);color:var(--deep);font-size:12px;font-weight:800;text-decoration:none}.calc-assumptions{max-width:860px;margin-top:27px;color:var(--muted);font-size:12px;line-height:1.75}.calc-assumptions a{color:var(--blue)}.calc-footer{padding:25px 24px;background:#071640;color:#d1dced;font-size:11px}.calc-footer-inner{max-width:1180px;margin:auto;display:grid;grid-template-columns:1fr auto;align-items:center;gap:15px 28px}.calc-footer-brand{display:grid;gap:5px}.calc-footer-brand strong{color:#fff;font-size:13px}.calc-footer-brand span{color:#c0cee7;font-size:10px}.calc-footer-links{display:flex;align-items:center;justify-content:flex-end;gap:8px 18px;flex-wrap:wrap}.calc-footer-links a{color:#fff;text-decoration:none}.calc-footer-links a:hover{color:var(--sky)}.calc-footer-legal{grid-column:1/-1;display:flex;justify-content:space-between;gap:8px 18px;flex-wrap:wrap;padding-top:13px;border-top:1px solid #ffffff24;color:#a9bad9;font-size:10px}.calc-page button:focus-visible,.calc-page a:focus-visible,.calc-page input:focus-visible,.calc-page select:focus-visible{outline:3px solid #42b8fa;outline-offset:2px}
      .calc-presets{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 0}.calc-presets button{flex:1;min-height:44px;border:1px solid #b5c4df;border-radius:6px;padding:9px 10px;background:#fff;color:var(--deep);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.calc-presets button[aria-pressed=true]{background:var(--deep);border-color:var(--deep);color:white}.calc-reference-note{font-size:11px;line-height:1.6;color:var(--muted);margin:12px 0 0}.calc-reference-note a{color:var(--blue)}.calc-lead-range-note{font-size:12px;line-height:1.6;color:#d1dcf0}
      .calc-fixed-cpl{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0;border-bottom:1px solid var(--line)}.calc-fixed-cpl span{font-size:13px;font-weight:750}.calc-fixed-cpl small{display:block;margin-top:4px;color:var(--muted);font-size:11px}.calc-fixed-cpl output{font-size:24px;font-weight:800;color:var(--blue)}.calc-assumptions summary{cursor:pointer;font-weight:750;color:var(--deep);padding:10px 0}
      @media(max-width:800px){.calc-footer-inner{grid-template-columns:1fr}.calc-footer-links{justify-content:flex-start}.calc-footer-legal{grid-column:1}.calc-mobile-summary{position:sticky;top:128px;z-index:20;display:flex;justify-content:space-between;gap:12px;margin:15px 0 -20px;padding:11px 13px;border:1px solid var(--line);border-radius:8px;background:#fffffff2;box-shadow:0 8px 24px #142d641a;color:var(--deep);font-size:11px;font-weight:750}.calc-mobile-summary strong{color:var(--blue);font-size:14px}.calc-links{display:none}.calc-toggle{display:grid;place-items:center}.calc-links.mobile{display:grid;position:absolute;top:100%;left:0;right:0;padding:15px 24px;background:white;border-bottom:1px solid var(--line);gap:0;max-height:calc(100dvh - 100px);overflow:auto}.calc-links.mobile a{padding:12px 0;border-bottom:1px solid var(--line)}.calc-workspace{grid-template-columns:1fr}.calc-outputs{order:2}.calc-inputs-wrap{order:1}.calc-main{padding-top:38px}}
      @media(max-width:440px){.calc-mobile-summary{top:136px}.calc-topbar>div{padding:8px 14px}.calc-topbar>div>span{width:100%}.calc-nav{padding:8px 15px}.calc-brand img{width:36px;height:36px}.calc-main{padding:31px 15px 48px}.calc-inputs{padding:7px 14px}.calc-outputs{padding:18px}.calc-field-head{display:block}.calc-field-head span{display:block;margin-top:4px;text-align:left}.calc-cta-block{align-items:stretch;flex-direction:column}.calc-cta-block a{justify-content:center}}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;transition-duration:.01ms!important}}
    `}</style>
    <header className="calc-header">
      <div className="calc-topbar"><div><span>Remote growth support · United States and Canada</span><div className="calc-toplinks"><a href={PHONE_HREF}><Phone size={12} /> {PHONE_DISPLAY}</a><a href={`mailto:${brand.contactEmail}`}><Mail size={12} /> {brand.contactEmail}</a></div></div></div>
      <div className="calc-nav"><a className="calc-brand" href="/" aria-label={`${brand.name} home`}><img src={brand.mark} alt=""/><span>{brand.name}</span></a>
        <nav className={`calc-links ${navOpen ? 'mobile' : ''}`} aria-label="Primary navigation"><a href="/about/">About us</a><a href="/referrals/">Referrals</a><a href="/services/">Services</a><a href="/blog/">Resources</a><a href="/case-studies/">Case studies</a><a className="calc-cta" href="/#audit-form">Get a free audit</a></nav>
        <button type="button" className="calc-toggle" aria-label={navOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={navOpen} onClick={() => setNavOpen((x) => !x)}>{navOpen ? <X size={20}/> : <Menu size={20}/>}</button>
      </div>
    </header>
    <main className="calc-main">
      <div className="calc-eyebrow">Paid search planning tool</div>
      <h1>See what paid ads could return for your business.</h1>
      <p className="calc-lede">Choose your industry and monthly budget to explore potential leads and revenue. Start with $700–$1,100 a month, then add your typical job value and close rate. <strong>All dollar inputs are USD.</strong> If you track costs in CAD, convert them before entering.</p>
      <div className="calc-mobile-summary" aria-live="polite"><span>{leadDisplay} estimated leads</span><span>Gross profit after marketing <strong>{positive ? '+' : '−'}{fmtMoney(Math.abs(calc.contribution))}</strong></span></div>
      <div className="calc-workspace">
        <section className="calc-panel calc-inputs-wrap" aria-label="Your business assumptions">
          <div className="calc-panel-head"><span>Your business assumptions</span><button className="calc-reset" type="button" onClick={reset}><RotateCcw size={13}/> Reset</button></div>
          <div className="calc-inputs">
            <label className="calc-trade" htmlFor="trade"><span>What kind of business do you run?</span><select id="trade" value={tradeKey} onChange={(e) => pick(e.target.value)}>{TRADES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
            <div className="calc-presets" role="group" aria-label="Monthly ad budget shortcuts">{BUDGET_PRESETS.map((budget) => <button type="button" key={budget} aria-pressed={spend === budget} onClick={() => setSpend(budget)}>{fmtMoney(budget)} / month</button>)}</div>
            <Field id="spend" label="Monthly ad budget" hint="Try $700–$1,100 · maximum $5,000" value={spend} onChange={setSpend} min={500} max={5000} step={100} prefix="$"/>
            <div className="calc-fixed-cpl"><div><span id="cpl-label">Estimated cost per lead</span><small>Based on the selected industry</small></div><output id="cpl" aria-labelledby="cpl-label">{fmtMoney(cpl)}</output></div>
            <Field id="job-value" label="Average sold-job revenue" hint="Example first sale · enter your actual value" value={jobValue} onChange={setJobValue} min={100} max={100000} step={100} prefix="$"/>
            <Field id="close-rate" label="Lead-to-customer close rate" hint="Share of leads that become customers" value={closeRate} onChange={setCloseRate} min={1} max={100} suffix="%"/>
            <Field id="margin" label="Gross margin on sold work" hint="After direct job costs" value={margin} onChange={setMargin} min={1} max={100} suffix="%"/>
            <Field id="fee" label="Monthly agency fee (optional)" hint="Include it to see the full marketing cost" value={fee} onChange={setFee} min={0} max={10000} step={50} prefix="$"/>
          </div>
        </section>
        <section className="calc-panel calc-outputs" aria-live="polite" aria-label="Estimated results">
          <div className="calc-results-title">Monthly estimate · {selected.label}</div>
          <div className={`calc-leads${leadRange ? ' is-range' : ''}`} aria-label={`${leadDisplay} estimated leads per month`}>{leadDisplay}</div><div className="calc-leads-label">estimated leads per month</div>
          {leadRange && <p className="calc-lead-range-note">Range calculated with ±{CPL_SENSITIVITY_PERCENT}% variation in lead cost. Actual results can fall outside this range.</p>}
          <p className="calc-summary">At a {fmtMoney(cpl)} estimated cost per lead and a {closeRate}% close rate, that’s about {fmtNum(calc.jobs)} customers and {fmtMoney(calc.revenue)} in estimated first-sale revenue.</p>
          <div className="calc-metrics">
            <div className="calc-metric"><span>Estimated gross profit</span><strong>{fmtMoney(calc.grossProfit)}</strong></div>
            <div className="calc-metric"><span>Ad spend + agency fee</span><strong>{fmtMoney(calc.marketingCost)}</strong></div>
            <div className="calc-metric"><span>Break-even customers*</span><strong>{fmtNum(calc.breakevenJobs)}</strong></div>
            <div className="calc-metric"><span>Break-even leads*</span><strong>{fmtNum(calc.breakevenLeads)}</strong></div>
          </div>
          <div className={`calc-contribution ${positive ? '' : 'negative'}`}><span>Estimated gross profit after marketing costs</span><strong>{positive ? '+' : '−'}{fmtMoney(Math.abs(calc.contribution))}</strong></div>
          <p className="calc-caveat">Lead costs are preset assumptions, not measured results. Actual costs and results vary. Estimates use your inputs and exclude overhead, taxes, and repeat sales. Include your agency fee for a fuller picture.</p>
          <div className="calc-cta-block"><p>Want to compare your actual numbers and service area?</p><a href="/#audit-form">Request a free audit <ArrowRight size={15}/></a></div>
        </section>
      </div>
      <details className="calc-assumptions"><summary>How this estimate is calculated</summary><p>Leads = ad budget ÷ the industry lead-cost input. Customers = leads × close rate. Revenue = customers × first-sale value. Gross profit after marketing subtracts ad spend and agency fees from revenue × gross margin. The lead-cost inputs are fixed planning assumptions; reducing a budget does not automatically reduce actual CPL.</p><p><strong>Published comparison: ${selected.cpl.toFixed(2)} per lead.</strong> {selected.basis} <a href={selected.source} target="_blank" rel="noreferrer">Read the source</a>. This reference is separate from the calculator input. For a location-specific forecast, use <a href="https://support.google.com/google-ads/answer/3022575" target="_blank" rel="noreferrer">Google Keyword Planner</a> and your campaign history.</p><p>*Break-even customers rounds up to a whole customer, then calculates the whole leads needed at your close rate. Example job values, margins, and close rates should be replaced with your business figures.</p></details>
    </main>
    <footer className="calc-footer" aria-label="Site footer"><div className="calc-footer-inner"><div className="calc-footer-brand"><strong>{brand.name}</strong><span>Marketing, AI systems, and growth consulting</span></div><nav className="calc-footer-links" aria-label="Footer navigation"><a href="/services/">Services</a><a href="/solutions/">Industries</a><a href="/blog/">Guides</a><a href="/faq/">FAQs</a><a href="/contract">Contract generator</a><a href="/">Home</a></nav><div className="calc-footer-legal"><span>© {new Date().getFullYear()} {brand.name}. This calculator provides estimates; actual campaign results vary.</span><span>Questions? <a href={`mailto:${brand.contactEmail}`}>{brand.contactEmail}</a></span></div></div></footer>
  </div>;
}
