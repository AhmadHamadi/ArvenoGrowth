import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Phone, ExternalLink, Loader2 } from 'lucide-react';
import brand from './brand-config.json';

/* ============================================================
   TRADE LEADS MARKETING — /apply

   The page every ad points at. One job: get a call on the calendar.
   The multi-step form was replaced by the Calendly booking widget,
   so the visitor picks a time in one sitting instead of filling a
   form and waiting to hear back.

   Design language matches the rest of the funnel: industrial
   utilitarian, warm paper ground, warm near-black ink, safety orange
   as the only accent, hairline rules and square corners.
   ============================================================ */

const PHONE_DISPLAY = '(289) 489-1167';
const PHONE_HREF    = 'tel:+12894891167';
const SMS_HREF      = 'sms:+12894891167';
const EMAIL         = brand.contactEmail;

/* The booking link is public, so it is safe in the bundle. VITE_CALENDLY_URL
   lets it be swapped without a code change; anything VITE_-prefixed is exposed
   to the browser by Vite, which is fine for a public URL and would be a serious
   mistake for the Calendly API token. That token is server-side only and is not
   needed anywhere on this page. */
const CALENDLY_URL =
  import.meta.env?.VITE_CALENDLY_URL || 'https://calendly.com/tradeleadsmarketing-info/30min';

/* Colour parameters are honoured on paid Calendly plans. On the free plan they
   are ignored and the widget falls back to its own palette, which is why the
   frame around it carries the branding rather than the widget itself. */
const EMBED_URL = `${CALENDLY_URL}?${new URLSearchParams({
  hide_event_type_details: '1',
  hide_gdpr_banner: '1',
  background_color: 'F2EFE9',
  text_color: '15140F',
  primary_color: 'F37021'
}).toString()}`;

const WIDGET_SRC = 'https://assets.calendly.com/assets/external/widget.js';

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
    /* Calendly injects an iframe; make it fill the frame we drew for it. */
    .calendly-inline-widget iframe { width: 100% !important; height: 100% !important; }
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
         aria-label="Illustration of the marketing review we walk through on the call">
      <rect x="0.5" y="0.5" width="299" height="175" fill="#F2EFE9" stroke="#15140F" />
      <rect x="0" y="0" width="300" height="24" fill="#15140F" />
      <text x="12" y="16" fill="#F2EFE9" fontFamily="'IBM Plex Mono', monospace" fontSize="9" fontWeight="600" letterSpacing="1.6">
        MARKETING REVIEW
      </text>
      <text x="288" y="16" textAnchor="end" fill="#F37021" fontFamily="'IBM Plex Mono', monospace" fontSize="9" fontWeight="600">
        REV.01
      </text>

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

function GuaranteeStamp({ className = '' }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="90 days to break even, or we work for free, subject to written terms">
      <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="100" cy="100" r="83" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <text x="100" y="56" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="8.5" fontWeight="700" letterSpacing="2.5" fill="currentColor">BREAK EVEN</text>
      <line x1="66" y1="66" x2="134" y2="66" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <text x="100" y="118" textAnchor="middle" fontFamily="Archivo, sans-serif" fontSize="56" fontWeight="800" fill="currentColor">90</text>
      <text x="100" y="138" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="13" fontWeight="700" letterSpacing="4" fill="currentColor">DAYS</text>
      <line x1="66" y1="150" x2="134" y2="150" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <text x="100" y="166" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="8.5" fontWeight="700" letterSpacing="2" fill="currentColor">OR WE WORK FREE</text>
    </svg>
  );
}

/* ============================================================
   THE BOOKING WIDGET

   Calendly is blocked by a fair number of ad and tracker blockers. On a
   page whose only job is a booking, a silently empty iframe is a dead
   page, so if no iframe appears we swap in a panel that still gets the
   visitor to a booking or a phone call.
   ============================================================ */
function BookingEmbed() {
  const holder = useRef(null);
  const [state, setState] = useState('loading'); // loading | ready | blocked

  const mountWidget = useCallback(() => {
    const el = holder.current;
    if (!el || el.querySelector('iframe')) return;
    if (window.Calendly?.initInlineWidget) {
      window.Calendly.initInlineWidget({ url: EMBED_URL, parentElement: el });
    }
  }, []);

  useEffect(() => {
    const el = holder.current;
    if (!el) return undefined;

    let cancelled = false;
    let poll = null;
    let started = false;

    /* Calendly pulls roughly 9.6MB of its own JavaScript, including Stripe for
       paid bookings this event does not use. Deferring it until the panel is
       near the viewport keeps that off the critical path on a phone, where the
       hero pushes the calendar below the fold. The 600px margin means it is
       almost always ready before anyone reaches it. */
    const begin = () => {
      if (started || cancelled) return;
      started = true;

      let script = document.querySelector(`script[src="${WIDGET_SRC}"]`);
      if (script && window.Calendly) {
        mountWidget();
      } else if (!script) {
        script = document.createElement('script');
        script.src = WIDGET_SRC;
        script.async = true;
        script.addEventListener('load', mountWidget);
        script.addEventListener('error', () => { if (!cancelled) setState('blocked'); });
        document.body.appendChild(script);
      } else {
        script.addEventListener('load', mountWidget);
      }

      /* Poll rather than settle on one timeout, so the loading veil lifts the
         moment the iframe appears instead of covering a working calendar for
         several seconds. Only declare it blocked once the deadline passes. */
      const startedAt = Date.now();
      poll = setInterval(() => {
        if (cancelled) return;
        if (holder.current?.querySelector('iframe')) {
          setState('ready');
          clearInterval(poll);
        } else if (Date.now() - startedAt > 6000) {
          setState('blocked');
          clearInterval(poll);
        }
      }, 200);
    };

    let observer = null;
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { begin(); observer.disconnect(); }
      }, { rootMargin: '600px' });
      observer.observe(el);
    } else {
      begin();
    }

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (observer) observer.disconnect();
    };
  }, [mountWidget]);

  return (
    <div id="book" className="scroll-mt-24">
      <div className="border border-inkd bg-paper">
        <div className="flex items-center justify-between gap-4 border-b border-inkd bg-inkd px-4 py-2.5 sm:px-6">
          <span className="font-plex text-[10px] font-semibold uppercase tracking-[0.2em] text-paper/70">
            Pick a time
          </span>
          <span className="font-plex text-[10px] font-semibold tabular-nums text-brand">30 MIN · FREE</span>
        </div>

        <div className="relative border-b border-inkd">
          {/* The frame carries the branding, so the page still looks right when
              Calendly ignores the colour parameters, which it does on any plan
              below the paid tiers. */}
          <div
            ref={holder}
            className="calendly-inline-widget h-[1000px] w-full bg-white sm:h-[720px]"
            data-url={EMBED_URL}
          />

          {state === 'loading' && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white">
              <Loader2 className="h-5 w-5 animate-spin text-inkd3" />
              <span className="font-archivo text-[14px] text-inkd3">Loading the calendar</span>
            </div>
          )}

          {state === 'blocked' && (
            <div className="absolute inset-0 flex items-center justify-center bg-white px-6">
              <div className="max-w-md text-center">
                <h3 className="font-archivo text-[22px] font-extrabold leading-tight text-inkd">
                  Your browser is blocking the calendar
                </h3>
                <p className="mt-3 font-archivo text-[15px] leading-[1.65] text-inkd2">
                  An ad blocker or privacy extension is stopping it from loading. Open the booking page
                  directly, or just call and we will put you in the book ourselves.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <a
                    href={CALENDLY_URL} target="_blank" rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2.5 bg-brandink px-6 py-3.5 font-archivo text-[13.5px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-brandink2"
                  >
                    Open the booking page <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    href={PHONE_HREF}
                    className="inline-flex items-center justify-center gap-2.5 border border-inkd px-6 py-3.5 font-plex text-[13px] font-semibold tabular-nums text-inkd transition-colors hover:bg-inkd hover:text-paper"
                  >
                    <Phone className="h-4 w-4 text-brandink" /> {PHONE_DISPLAY}
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 max-w-xl font-archivo text-[13px] leading-relaxed text-inkd3">
        Rather not pick a slot? Call or text {PHONE_DISPLAY} and we will find a time that works around
        your job site.
      </p>
    </div>
  );
}

/* ============================================================
   PAGE FURNITURE
   ============================================================ */
function Masthead() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header sticky top-0 z-50">
      <div className="contact-ribbon">
        <div className="shell contact-ribbon-inner">
          <span>AI, marketing, and growth support for service businesses</span>
          <div><a href={PHONE_HREF}>{PHONE_DISPLAY}</a><a href={`mailto:${EMAIL}`}>{EMAIL}</a></div>
        </div>
      </div>
      <div className="shell nav-wrap">
        <a className="brand" href="/" aria-label={`${brand.name}, home`}>
          <img src={brand.mark} alt="" width="48" height="48" />
          <strong>{brand.name}</strong>
        </a>
        <button className="menu-toggle" type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="apply-primary-nav" onClick={() => setOpen((value) => !value)}>
          <span></span><span></span>
        </button>
        <nav className={`primary-nav${open ? ' open' : ''}`} id="apply-primary-nav" aria-label="Primary navigation">
          <a href="/about/">About us</a><a href="/referrals/">Referrals</a>
          <details className="nav-dropdown">
            <summary>Services</summary>
            <div className="nav-dropdown-menu nav-mega">
              <section><b>Growth services</b><a href="/services/">All services</a><a href="/services/google-ads.html">Google Ads</a><a href="/services/websites.html">Websites</a><a href="/services/local-seo.html">Local SEO and AI visibility</a><a href="/services/ai-automation.html">AI consulting and systems</a><a href="/services/lead-tracking.html">Lead tracking</a><a href="/services/growth-consulting.html">Growth consulting</a></section>
              <section><b>Industries</b><a href="/solutions/">All industries</a><a href="/solutions/auto-repair-marketing.html">Auto repair</a><a href="/solutions/hvac-marketing.html">HVAC</a><a href="/solutions/plumbing-marketing.html">Plumbing</a><a href="/solutions/electrical-contractor-marketing.html">Electrical</a><a href="/solutions/med-spa-marketing.html">Med spas</a><a href="/solutions/landscaping-marketing.html">Landscaping</a></section>
            </div>
          </details>
          <details className="nav-dropdown">
            <summary>Resources</summary>
            <div className="nav-dropdown-menu"><a href="/plans/">Growth plans</a><a href="/blog/">Marketing guides</a><a href="/faq/">FAQs</a><a href="/coverage/">US &amp; Canada coverage</a><a href="/case-studies/">Case studies</a><a href="/referrals/">Referral program</a></div>
          </details>
          <a className="nav-calculator" href="/calculator">Revenue calculator</a>
          <a className="button button-small" href="#book">Book a free audit ↗</a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  const specs = [
    ['01', 'Thirty minutes', 'On the phone or a video call, your choice'],
    ['02', 'Completely free', 'You keep everything we find either way'],
    ['03', 'Service businesses', 'Contractors, trades, and local services']
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
              Book your free
              <br />
              contractor
              <br />
              <span className="text-brand">marketing audit</span>
            </h1>

            <p className="mt-7 max-w-xl font-archivo text-[17.5px] leading-[1.7] text-paper/75">
              Pick a time below and we will pull apart your website, your Google Business Profile and your
              ad spend before we speak. Then we walk you through every leak we found, live, in thirty
              minutes. You keep the findings whether or not you ever hire us.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
              <a
                href="#book"
                className="group inline-flex items-center gap-2.5 bg-brandink px-8 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-paper hover:text-inkd"
              >
                Pick a time
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

          <dl className="lg:col-span-5 lg:border-l lg:border-paper/15 lg:pl-12">
            {specs.map(([n, term, desc], i) => (
              <div key={n} className={`flex gap-5 border-t border-paper/15 py-5 ${i === 0 ? 'lg:border-t-0 lg:pt-0' : ''}`}>
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
      <section>
        <div className="flex items-center gap-3">
          <h2 className="font-plex text-[10px] font-semibold uppercase tracking-[0.24em] text-inkd2">
            What we go through
          </h2>
          <span className="h-px flex-1 bg-paperEdge" />
        </div>

        <AuditSheet className="mt-4 w-full" />

        <ol className="mt-5">
          {receives.map((r, i) => (
            <li key={r} className="flex gap-4 border-t border-paperEdge py-3 last:border-b">
              <span className="font-plex text-[10px] font-semibold tabular-nums text-brandink">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-archivo text-[15px] leading-snug text-inkd2">{r}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="border border-inkd bg-inkd text-paper">
        <div className="h-[3px] bg-brand" />
        <div className="px-5 py-6">
          <div className="font-plex text-[9.5px] font-semibold uppercase tracking-[0.28em] text-brand">
            The guarantee
          </div>
          <p className="mt-3 font-archivo text-[22px] font-extrabold leading-[1.1] tracking-[-0.02em]">
            Make your marketing pay for itself. Or we work for free.*
          </p>
          <p className="mt-4 font-archivo text-[15px] leading-relaxed text-paper/90">If your marketing doesn’t cover its costs under our agreed terms, we keep working without a monthly service fee until it does.</p>
          <p className="mt-4 font-archivo text-[13px] leading-relaxed text-paper/50">
            *Applies after 90 days on the agreed budget and tracking. Tracked gross profit must cover ad spend + our fee. Ad spend remains payable; continued service, not a refund. Written eligibility terms apply.
          </p>
        </div>
      </section>
    </aside>
  );
}

function ContactBand() {
  return (
    <section className="mx-auto mt-16 max-w-6xl px-5 md:mt-20 md:px-8">
      <div className="grid border-t border-inkd md:grid-cols-[1fr_auto]">
        <figure className="py-8 md:pr-12">
          <p className="max-w-2xl border-l-[3px] border-brand pl-5 font-archivo text-[18px] leading-[1.6] text-inkd sm:text-[20px]">
            After Arveno Growth rebuilt the landing page and improved the Google Business Profile, the owner reported more quote requests and clearer campaign-to-job tracking.
          </p>
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
            Rather skip the calendar
          </div>
          <a href={PHONE_HREF} className="mt-2 block font-archivo text-[30px] font-extrabold tracking-[-0.02em] text-inkd transition-colors hover:text-brandink">
            {PHONE_DISPLAY}
          </a>
          <a href={SMS_HREF} className="mt-1.5 block font-archivo text-[15px] text-inkd2 underline decoration-paperEdge underline-offset-2 transition-colors hover:decoration-brand">
            Text us instead
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
    ['01', 'You pick a time', 'Takes about twenty seconds. Choose a slot that works around your day.'],
    ['02', 'We do the homework', 'Before the call we go through your site, your Google Business Profile, your ads, and the competitors beating you in the map pack.'],
    ['03', 'We walk you through it', 'Thirty minutes, live. You keep everything we found whether or not you ever hire us.']
  ];
  return (
    <section className="border-t border-inkd bg-paper2">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="flex items-baseline gap-4">
          <h2 className="font-archivo text-[28px] font-extrabold tracking-[-0.02em] text-inkd sm:text-[34px]">
            What happens once you book
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
              className={`border-t border-inkd py-7 md:border-t-0 md:py-0 md:pt-8 ${i === 0 ? 'md:pr-8' : 'md:border-l md:border-inkd md:px-8'}`}
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
              Twenty seconds to book.
              <br />
              <span className="text-brand">Could change your season.</span>
            </h2>
            <p className="mt-4 max-w-md font-archivo text-[16.5px] leading-[1.65] text-paper/70">
              Worst case, you spend thirty minutes finding out exactly where your marketing leaks money.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">
            <a
              href="#book"
              className="group inline-flex items-center justify-center gap-2.5 bg-brandink px-8 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-paper hover:text-inkd"
            >
              Pick a time
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
            <img src={brand.mark} alt="" className="h-12 w-12 object-contain" />
            <span className="leading-tight">
              <span className="block font-archivo text-[13px] font-extrabold uppercase tracking-[0.06em]">
                {brand.name}
              </span>
                <span className="block font-archivo text-[12px] text-paper/45">{brand.contactEmail}</span>
            </span>
          </a>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 font-plex text-[11px] uppercase tracking-[0.12em] [&>a]:py-1.5">
            <a href={PHONE_HREF} className="tabular-nums text-paper/75 transition-colors hover:text-brand">{PHONE_DISPLAY}</a>
            <a href={`mailto:${EMAIL}`} className="text-paper/75 transition-colors hover:text-brand">Email</a>
            <a href="/" className="text-paper/75 transition-colors hover:text-brand">Main site</a>
          </nav>
        </div>

        <p className="mt-9 max-w-4xl border-t border-paper/15 pt-6 font-archivo text-[12.5px] leading-[1.7] text-paper/50">
          <span className="font-semibold text-paper/70">Disclaimer.</span> Except where an explicit written
          guarantee applies under the written terms in your service agreement, Arveno Growth does not guarantee
          specific lead volume, ranking position, or revenue outcomes. Google, Google Ads, and Google Business
          Profile are trademarks of Google LLC, used descriptively; Arveno Growth is not affiliated with or
          endorsed by Google.
        </p>
        <p className="mt-4 font-archivo text-[12.5px] text-paper/50">
          © {new Date().getFullYear()} {brand.name}
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
        <a href={PHONE_HREF} className="shrink-0 bg-brandink px-5 py-3 font-archivo text-[13px] font-bold uppercase tracking-[0.1em] text-paper">
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
            <div className="relative z-10 -mt-20 md:-mt-24 lg:col-span-7 xl:col-span-8">
              <BookingEmbed />
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
