import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';

import { TRADES, DEFAULT_BUDGET, BUDGET_PRESETS, CPL_SENSITIVITY_PERCENT } from './calculator-data.js';

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
.calc-page{--deep:var(--rf-navy,#0b2585);--blue:var(--rf-sky-mid,#1e9ddd);--sky:var(--rf-sky,#9fdcff);--ink:var(--rf-ink,#16244a);--muted:var(--rf-muted,#4a5878);--line:var(--rf-line,#d7e5f5);--pale:var(--rf-pale,#eaf4fc);color:var(--ink);font-family:var(--rf-body,Inter,Arial,sans-serif)}
.calc-page *{box-sizing:border-box}
.calc-workspace{display:grid;grid-template-columns:minmax(320px,.9fr) minmax(0,1.1fr);gap:22px;align-items:start}
.calc-mobile-summary{display:none}
.calc-panel{border:1px solid var(--line);border-radius:24px;background:#fff;box-shadow:0 22px 50px -34px rgba(11,37,133,.45);overflow:hidden}
.calc-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 22px;border-bottom:1px solid var(--line);background:var(--rf-pale-2,#f4f9fe);color:var(--deep);font-family:var(--rf-head,inherit);font-size:16px;font-weight:600}
.calc-reset{display:flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--deep);cursor:pointer;font:600 13px/1 var(--rf-body,inherit)}
.calc-inputs{padding:6px 22px 10px}
.calc-trade{display:grid;gap:8px;padding:18px 0;border-bottom:1px solid var(--line);font-weight:600;font-size:14px}
.calc-trade select{height:48px;padding:0 14px;border:1px solid var(--line);border-radius:14px;background:#fff;color:var(--ink);font:inherit;font-weight:500}
.calc-presets{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 0}.calc-presets button{flex:1;min-height:44px;border:1px solid var(--line);border-radius:999px;padding:9px 12px;background:#fff;color:var(--deep);font:600 13px/1 var(--rf-body,inherit);cursor:pointer}.calc-presets button[aria-pressed=true]{background:var(--deep);border-color:var(--deep);color:#fff}
.calc-field{padding:16px 0;border-bottom:1px solid var(--line)}.calc-field:last-child{border:0}
.calc-field-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px}.calc-field-head label{font-size:14px;font-weight:600}.calc-field-head span{font-size:12px;color:var(--muted);text-align:right}
.calc-entry{display:flex;align-items:center;gap:6px;width:170px;margin:10px 0 10px;padding:0 12px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--muted)}
.calc-entry input{width:100%;height:42px;border:0;outline:0;background:transparent;color:var(--deep);font:600 17px/1 var(--rf-head,inherit)}
.calc-field input[type=range]{width:100%;accent-color:var(--deep)}
.calc-fixed-cpl{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0;border-bottom:1px solid var(--line)}.calc-fixed-cpl span{font-size:14px;font-weight:600}.calc-fixed-cpl small{display:block;margin-top:4px;color:var(--muted);font-size:12px}.calc-fixed-cpl output{font-family:var(--rf-head,inherit);font-size:26px;font-weight:700;color:var(--deep)}
.calc-outputs{position:sticky;top:110px;padding:28px;border:0;background:var(--rf-grad,linear-gradient(135deg,#0b2585,#1e4fd1));color:#fff}
.calc-results-title{color:#cfe6ff;font-size:13px;font-weight:600}
.calc-leads{margin:12px 0 4px;color:#fff;font-family:var(--rf-head,inherit);font-size:clamp(44px,6.5vw,68px);font-weight:700;line-height:1}
.calc-leads-label{color:#d9ebff;font-size:15px}.calc-lead-range-note{font-size:12px;line-height:1.6;color:#cfe0f7}
.calc-summary{margin:16px 0 20px;color:#e6f0ff;font-size:15px;line-height:1.6}
.calc-metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.calc-metric{padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.1)}.calc-metric span{display:block;color:#cfe0f7;font-size:12px}.calc-metric strong{display:block;margin-top:6px;color:#fff;font-family:var(--rf-head,inherit);font-size:24px;font-weight:700}
.calc-contribution{margin-top:12px;padding:16px 18px;border-radius:16px;background:#fff;color:var(--deep)}.calc-contribution span{display:block;color:var(--muted);font-size:12px}.calc-contribution strong{display:block;margin-top:4px;color:var(--deep);font-family:var(--rf-head,inherit);font-size:30px;font-weight:700}.calc-contribution.negative strong{color:#b4233c}
.calc-caveat{margin-top:16px;color:#d6e4f8;font-size:12px;line-height:1.6}.calc-caveat strong{color:#fff}
.calc-cta-block{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:18px;padding-top:18px;border-top:1px solid rgba(255,255,255,.22)}.calc-cta-block p{margin:0;color:#e6f0ff;font-size:14px;line-height:1.5}.calc-cta-block a{display:inline-flex;gap:8px;align-items:center;flex:none;padding:13px 18px;border-radius:999px;background:#fff;color:var(--deep);font:600 14px/1 var(--rf-body,inherit);text-decoration:none}
.calc-assumptions{max-width:860px;margin-top:22px;color:var(--muted);font-size:14px;line-height:1.7}.calc-assumptions summary{cursor:pointer;font-weight:600;color:var(--deep);padding:10px 0}.calc-assumptions a{color:var(--deep)}
.calc-page button:focus-visible,.calc-page a:focus-visible,.calc-page input:focus-visible,.calc-page select:focus-visible{outline:3px solid var(--sky);outline-offset:2px}
@media(max-width:900px){.calc-workspace{grid-template-columns:1fr}.calc-outputs{position:static}.calc-mobile-summary{position:sticky;top:104px;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 12px;padding:12px 16px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 10px 26px -18px rgba(11,37,133,.5);color:var(--deep);font-size:13px;font-weight:600}.calc-mobile-summary strong{color:var(--deep);font-size:15px}}
@media(max-width:480px){.calc-inputs{padding:4px 16px 8px}.calc-outputs{padding:20px}.calc-field-head{display:block}.calc-field-head span{display:block;margin-top:4px;text-align:left}.calc-cta-block{align-items:stretch;flex-direction:column}.calc-cta-block a{justify-content:center}.calc-mobile-summary{flex-direction:column;align-items:flex-start;gap:2px}}
    `}</style>
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
          <div className="calc-cta-block"><p>Want to see where more booked jobs can come from in your area?</p><a href="/#audit-form">Get my free growth review <ArrowRight size={15}/></a></div>
        </section>
      </div>
      <details className="calc-assumptions"><summary>How this estimate is calculated</summary><p>Leads = ad budget ÷ the industry lead-cost input. Customers = leads × close rate. Revenue = customers × first-sale value. Gross profit after marketing subtracts ad spend and agency fees from revenue × gross margin. The lead-cost inputs are fixed planning assumptions; reducing a budget does not automatically reduce actual CPL.</p><p><strong>Published comparison: ${selected.cpl.toFixed(2)} per lead.</strong> {selected.basis} <a href={selected.source} target="_blank" rel="noreferrer">Read the source</a>. This reference is separate from the calculator input. For a location-specific forecast, use <a href="https://support.google.com/google-ads/answer/3022575" target="_blank" rel="noreferrer">Google Keyword Planner</a> and your campaign history.</p><p>*Break-even customers rounds up to a whole customer, then calculates the whole leads needed at your close rate. Example job values, margins, and close rates should be replaced with your business figures.</p></details>
  </div>;
}
